begin;

alter table public.portal_recepciones
    add column documento_canonico_id uuid references public.documentos(id),
    add column causa_correccion text,
    add column sustituye_recepcion_id uuid references public.portal_recepciones(id),
    drop constraint portal_recepciones_estado_check,
    add constraint portal_recepciones_estado_check check (estado in ('recibido', 'en_revision', 'aceptado', 'rechazado')),
    drop constraint portal_recepciones_recibo_check,
    add constraint portal_recepciones_recibo_check check (recibo ~ '^REC-([0-9A-F]{6}|[0-9A-F]{12})$');

create unique index portal_recepciones_canonico_idx on public.portal_recepciones(documento_canonico_id);
create index portal_recepciones_versiones_idx on public.portal_recepciones(folio, documento_id, creado_en desc, id desc);
revoke all on public.portal_recepciones from public, anon, service_role, authenticated;
revoke update (estado, motivo_rechazo, revisado_por, revisado_en) on public.portal_recepciones from authenticated;
grant select on public.portal_recepciones to service_role, authenticated;

-- La escritura directa de usuarios del personal sobre otros archivos permanece disponible.
create policy expedientes_portal_solo_backend on storage.objects as restrictive
    for all to authenticated
    using (bucket_id <> 'expedientes' or (storage.foldername(name))[2] is distinct from 'portal')
    with check (bucket_id <> 'expedientes' or (storage.foldername(name))[2] is distinct from 'portal');

create function public.proteger_version_documento_portal() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if exists (select 1 from public.portal_recepciones where documento_canonico_id = old.id) then
        if tg_op = 'DELETE' then
            raise exception using errcode = '42501', message = 'La versión está vinculada a una recepción';
        end if;
        if (old.proyecto_id, old.requisito_codigo, old.storage_bucket, old.storage_path, old.version, old.documento_sustituye_id)
            is distinct from
           (new.proyecto_id, new.requisito_codigo, new.storage_bucket, new.storage_path, new.version, new.documento_sustituye_id) then
            raise exception using errcode = '42501', message = 'La vinculación de la versión es inmutable';
        end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

create trigger proteger_version_documento_portal
before update or delete on public.documentos
for each row execute function public.proteger_version_documento_portal();
revoke all on function public.proteger_version_documento_portal() from public, anon, authenticated, service_role;

create function public.registrar_recepcion_portal(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    anterior public.portal_recepciones;
    nueva public.portal_recepciones;
    v_folio text := p_datos->>'folio';
    v_tipo text := p_datos->>'documento_id';
    v_acceso uuid := (p_datos->>'acceso_id')::uuid;
begin
    perform 1 from public.proyectos p join public.portal_accesos a on a.proyecto_id = p.id
    where p.folio = v_folio and not p.es_demo and a.id = v_acceso and a.activo
        and a.revocado_at is null and a.expira_at > now()
        and a.permisos @> '{"subir_documentos":true,"ver_documentos_autorizados":true}'::jsonb
    for update of p, a;
    if not found then raise exception using errcode = '42501', message = 'Acceso sin permiso'; end if;

    perform 1 from public.requisitos_documentales where tipo_documento = v_tipo and activo and aporta_cliente;
    if not found then raise exception using errcode = '22023', message = 'Requisito no autorizado'; end if;
    if split_part(p_datos->>'ruta_almacen', '/', 1) is distinct from v_folio
        or split_part(p_datos->>'ruta_almacen', '/', 2) is distinct from 'portal' then
        raise exception using errcode = '22023', message = 'Ruta fuera del expediente';
    end if;

    select * into anterior from public.portal_recepciones
    where folio = v_folio and documento_id = v_tipo
    order by creado_en desc, id desc limit 1;
    if anterior.estado in ('recibido', 'en_revision') then
        raise exception using errcode = '40001', message = 'Ya existe un envío pendiente';
    end if;

    insert into public.portal_recepciones(recibo, folio, acceso_id, documento_id, documento_nombre,
        archivo_nombre, mime, tamano_bytes, sha256, ruta_almacen, sustituye_recepcion_id, creado_en)
    values (p_datos->>'recibo', v_folio, v_acceso, v_tipo, p_datos->>'documento_nombre',
        p_datos->>'archivo_nombre', p_datos->>'mime', (p_datos->>'tamano_bytes')::integer,
        p_datos->>'sha256', p_datos->>'ruta_almacen', anterior.id, clock_timestamp()) returning * into nueva;

    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'portal_recepcion', nueva.id, v_folio, 'documento_recibido',
        jsonb_build_object('accesoId', v_acceso, 'recibo', nueva.recibo));
    return to_jsonb(nueva);
end;
$$;

create function public.revisar_recepcion_portal(p_id uuid, p_actor uuid, p_decision text, p_causa text, p_mensaje text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
    r public.portal_recepciones;
    anterior public.documentos;
    v_proyecto uuid;
    v_codigo text;
    v_documento uuid;
begin
    if p_decision is null or p_decision not in ('en_revision', 'aceptado', 'rechazado') or
        (p_decision = 'rechazado' and (nullif(trim(p_causa), '') is null
          or nullif(trim(p_mensaje), '') is null or length(p_mensaje) > 500)) then
        raise exception using errcode = '22023', message = 'Decisión inválida';
    end if;

    select * into r from public.portal_recepciones where id = p_id;
    if not found then return null; end if;
    select id into v_proyecto from public.proyectos where folio = r.folio and not es_demo for update;
    if not found then return null; end if;
    select * into r from public.portal_recepciones where id = p_id for update;

    if r.estado = p_decision and (p_decision = 'en_revision' or r.documento_canonico_id is not null or
        (p_decision = 'rechazado' and r.causa_correccion = p_causa and r.motivo_rechazo = p_mensaje)) then
        return jsonb_build_object('estado', r.estado, 'documentoId', r.documento_canonico_id);
    end if;
    if (r.estado not in ('recibido', 'en_revision') and not (r.estado = 'aceptado' and p_decision = 'aceptado')) or exists (
        select 1 from public.portal_recepciones otra where otra.folio = r.folio and otra.documento_id = r.documento_id
        and (otra.creado_en, otra.id) > (r.creado_en, r.id)
    ) then
        raise exception using errcode = '40001', message = 'Otra revisión o versión ya existe';
    end if;

    if p_decision = 'aceptado' then
        select codigo into v_codigo from public.requisitos_documentales where tipo_documento = r.documento_id and activo;
        if not found then raise exception using errcode = '22023', message = 'Requisito sin mapeo activo'; end if;
        select id into v_documento from public.documentos where proyecto_id = v_proyecto
            and requisito_codigo = v_codigo and storage_bucket = 'expedientes' and storage_path = r.ruta_almacen;
        if not found then
            select * into anterior from public.documentos
            where proyecto_id = v_proyecto and requisito_codigo = v_codigo
            order by version desc, created_at desc, id desc limit 1;
            insert into public.documentos(proyecto_id, requisito_codigo, nombre_archivo, storage_path,
                mime_type, tamano_bytes, version, documento_sustituye_id)
            values (v_proyecto, v_codigo, r.archivo_nombre, r.ruta_almacen, r.mime, r.tamano_bytes,
                coalesce(anterior.version, 0) + 1, anterior.id)
            returning id into v_documento;
        end if;
    end if;

    update public.portal_recepciones set estado = p_decision, revisado_por = p_actor, revisado_en = now(),
        motivo_rechazo = case when p_decision = 'rechazado' then p_mensaje end,
        causa_correccion = case when p_decision = 'rechazado' then p_causa end,
        documento_canonico_id = v_documento where id = p_id;

    insert into public.auditoria_eventos(actor_user_id, origen, entidad, entidad_id, folio, accion, detalles)
    values (p_actor, 'app', 'portal_recepcion', p_id, r.folio, 'documento_' || p_decision,
        jsonb_build_object('documentoId', v_documento, 'causa', p_causa,
            'via', case when p_actor is null then 'token_emergencia' else 'personal' end));
    return jsonb_build_object('estado', p_decision, 'documentoId', v_documento);
end;
$$;

revoke insert on public.portal_recepciones from service_role;
revoke all on function public.registrar_recepcion_portal(jsonb) from public, anon, authenticated;
revoke all on function public.revisar_recepcion_portal(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.registrar_recepcion_portal(jsonb) to service_role;
grant execute on function public.revisar_recepcion_portal(uuid,uuid,text,text,text) to service_role;

commit;
