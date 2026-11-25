begin;

alter table public.portal_recepciones drop constraint portal_recepciones_estado_check,
    add constraint portal_recepciones_estado_check check (estado in ('recibido','en_revision','prevalidado','aceptado','rechazado'));

create table public.portal_entregas_fisicas (
    proyecto_id uuid not null references public.proyectos(id),
    requisito_codigo text not null references public.requisitos_documentales(codigo),
    recepcion_id uuid references public.portal_recepciones(id),
    recibido_en timestamptz not null default now(),
    recibido_por uuid,
    validado_en timestamptz,
    validado_por uuid,
    primary key (proyecto_id, requisito_codigo)
);
create table public.portal_eventos_documentales (
    id bigint generated always as identity primary key,
    folio text not null references public.proyectos(folio),
    clave text not null unique,
    tipo text not null,
    documento text not null,
    fecha timestamptz not null default now()
);
create index portal_eventos_documentales_folio_fecha
    on public.portal_eventos_documentales(folio, fecha desc);

alter table public.portal_entregas_fisicas enable row level security;
alter table public.portal_eventos_documentales enable row level security;
revoke all on public.portal_entregas_fisicas, public.portal_eventos_documentales from public, anon, authenticated, service_role;
grant select on public.portal_entregas_fisicas, public.portal_eventos_documentales to service_role;

create function public.portal_evento_recepcion() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if tg_op = 'INSERT' or (old.estado is distinct from new.estado and not (old.estado = 'prevalidado' and new.estado = 'en_revision')) then
        insert into public.portal_eventos_documentales(folio, clave, tipo, documento)
        values (new.folio, new.id::text || ':' || new.estado, new.estado, new.documento_nombre)
        on conflict (clave) do nothing;
    end if;
    return new;
end;
$$;

create trigger portal_evento_recepcion after insert or update of estado on public.portal_recepciones
    for each row execute function public.portal_evento_recepcion();

create function public.exigir_entrega_para_validar_portal() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if new.estado = 'aceptado' and (old.estado is distinct from 'aceptado' or old.documento_canonico_id is distinct from new.documento_canonico_id)
       and not exists (select from public.portal_entregas_fisicas where recepcion_id = new.id and validado_en is not null) then
        raise exception using errcode = '40001', message = 'Falta registrar y validar la entrega de esta versión';
    end if;
    return new;
end;
$$;
create trigger exigir_entrega_para_validar_portal before update of estado, documento_canonico_id on public.portal_recepciones
for each row execute function public.exigir_entrega_para_validar_portal();

create function public.revisar_entrega_portal(p_id uuid, p_actor uuid, p_accion text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
    r public.portal_recepciones;
    p uuid;
    req public.requisitos_documentales;
    v_entrega uuid;
begin
    select * into r from public.portal_recepciones where id = p_id;
    if not found then return null; end if;
    select id into p from public.proyectos where folio = r.folio and not es_demo for update;
    if not found then return null; end if;
    select * into r from public.portal_recepciones where id = p_id for update;
    select * into req from public.requisitos_documentales where tipo_documento = r.documento_id and activo;
    if not found then raise exception using errcode = '22023', message = 'Requisito sin mapeo activo'; end if;
    if exists (select 1 from public.portal_recepciones otra where otra.folio = r.folio
        and otra.documento_id = r.documento_id and (otra.creado_en, otra.id) > (r.creado_en, r.id)) then
        raise exception using errcode = '40001', message = 'Existe una versión posterior';
    end if;

    if p_accion = 'prevalidado' then
        if r.estado = 'prevalidado' then return jsonb_build_object('estado', r.estado); end if;
        if r.estado not in ('recibido', 'en_revision') or req.revision_digital = 'no_disponible' then
            raise exception using errcode = '40001', message = 'No se puede prevalidar esta versión';
        end if;
        update public.portal_recepciones set estado = 'prevalidado', revisado_por = p_actor, revisado_en = now() where id = p_id;
    elsif p_accion = 'entregado' then
        if r.estado = 'rechazado' or (req.revision_digital = 'obligatoria' and r.estado not in ('prevalidado', 'aceptado')) then
            raise exception using errcode = '40001', message = 'Falta una decisión de revisión digital';
        end if;
        insert into public.portal_entregas_fisicas(proyecto_id,requisito_codigo,recepcion_id,recibido_por)
        values (p, req.codigo, p_id, p_actor)
        on conflict (proyecto_id,requisito_codigo) do update set recepcion_id = excluded.recepcion_id,
            recibido_por = excluded.recibido_por, recibido_en = now(), validado_en = null, validado_por = null
        where public.portal_entregas_fisicas.recepcion_id is distinct from excluded.recepcion_id;
        if not found then return jsonb_build_object('estado', 'entregado'); end if;
        insert into public.portal_eventos_documentales(folio, clave, tipo, documento)
        values (r.folio, r.id::text || ':entregado', 'entregado', r.documento_nombre) on conflict (clave) do nothing;
    elsif p_accion = 'aceptado' then
        select recepcion_id into v_entrega from public.portal_entregas_fisicas where proyecto_id = p and requisito_codigo = req.codigo;
        if v_entrega is distinct from r.id or r.estado = 'rechazado' then
            raise exception using errcode = '40001', message = 'Registra la entrega física de esta versión';
        end if;
        if r.estado = 'prevalidado' then
            update public.portal_recepciones set estado = 'en_revision' where id = p_id;
        end if;
        update public.portal_entregas_fisicas set validado_en = now(), validado_por = p_actor
        where proyecto_id = p and requisito_codigo = req.codigo and validado_en is null;
        return public.revisar_recepcion_portal(p_id, p_actor, 'aceptado', null, null);
    else
        raise exception using errcode = '22023', message = 'Acción inválida';
    end if;

    insert into public.auditoria_eventos(actor_user_id, origen, entidad, entidad_id, folio, accion, detalles)
    values (p_actor, 'app', 'portal_recepcion', p_id, r.folio, 'documento_' || p_accion, jsonb_build_object('requisito', req.codigo));
    return jsonb_build_object('estado', p_accion);
end;
$$;

create function public.registrar_entrega_sin_copia(p_folio text, p_tipo text, p_actor uuid, p_validar boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
    p uuid;
    req public.requisitos_documentales;
    accion text;
begin
    select id into p from public.proyectos where folio = p_folio and not es_demo for update;
    if not found then return false; end if;
    select * into req from public.requisitos_documentales where tipo_documento = p_tipo and activo and aporta_cliente;
    if not found or req.revision_digital = 'obligatoria' or exists (
        select from public.portal_recepciones where folio = p_folio and documento_id = p_tipo
    ) then raise exception using errcode = '40001', message = 'Revisa el requisito o registra la entrega desde su copia digital'; end if;

    if p_validar then
        update public.portal_entregas_fisicas set validado_en = now(), validado_por = p_actor
        where proyecto_id = p and requisito_codigo = req.codigo and recepcion_id is null and validado_en is null;
        if not found then
            if exists (select from public.portal_entregas_fisicas where proyecto_id = p and requisito_codigo = req.codigo
                and recepcion_id is null and validado_en is not null) then return true; end if;
            raise exception using errcode = '40001', message = 'Registra primero la entrega física';
        end if;
        accion := 'validado_fisico';
    else
        insert into public.portal_entregas_fisicas(proyecto_id,requisito_codigo,recibido_por)
        values (p, req.codigo, p_actor) on conflict (proyecto_id,requisito_codigo) do nothing;
        if not found then return true; end if;
        accion := 'entregado';
    end if;
    insert into public.portal_eventos_documentales(folio, clave, tipo, documento)
    values (p_folio, p_folio || ':' || req.codigo || ':' || accion, accion, req.nombre) on conflict (clave) do nothing;
    insert into public.auditoria_eventos(actor_user_id, origen, entidad, entidad_id, folio, accion, detalles)
    values (p_actor, 'app', 'portal_entrega_fisica', p, p_folio, accion, jsonb_build_object('requisito', req.codigo));
    return true;
end;
$$;

revoke all on function public.portal_evento_recepcion() from public, anon, authenticated, service_role;
revoke all on function public.exigir_entrega_para_validar_portal() from public, anon, authenticated, service_role;
revoke all on function public.revisar_entrega_portal(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.revisar_entrega_portal(uuid,uuid,text) to service_role;
revoke all on function public.registrar_entrega_sin_copia(text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.registrar_entrega_sin_copia(text,text,uuid,boolean) to service_role;

commit;
