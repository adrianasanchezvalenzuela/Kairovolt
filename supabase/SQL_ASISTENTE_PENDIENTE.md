# Asistente documental · SQL para despliegue

Aplica los bloques en un proyecto de ensayo antes de promover el código. Cada bloque conserva su transacción. Esta entrega se verificó en PostgreSQL local con datos ficticios. El SQL remoto queda a cargo de IDC.

## Verificación previa

```sql
select
  to_regclass('public.proyectos') as proyectos,
  to_regclass('public.portal_recepciones') as recepciones_007,
  exists (select from pg_trigger where tgrelid = 'public.auditoria_eventos'::regclass and tgname = 'auditoria_no_truncate') as auditoria_008,
  exists (select from information_schema.columns where table_schema = 'public' and table_name = 'requisitos_documentales' and column_name = 'tipo_documento') as catalogo_009,
  to_regclass('public.expediente_participantes_versiones') as participantes_010,
  to_regprocedure('public.revisar_recepcion_portal(uuid,uuid,text,text,text)') as revision_011,
  to_regclass('public.portal_preparacion') as preparacion_012,
  to_regclass('public.portal_entregas_fisicas') as entregas_013,
  to_regclass('public.portal_cola_correo') as correo_014,
  to_regclass('public.portal_documentos_generados') as generaciones_015;
select id, public from storage.buckets where id = 'expedientes';
```

Las dependencias 001–011 deben existir y el bucket debe devolver `public = false`. Si faltan 007, 008, 010 u 011, consulta los [bloques anteriores completos](./SQL_EXPEDIENTE_PENDIENTE.md). Si falta 009, verifica los objetos de la 002 y aplica la [migración de catálogo](./migrations/20261124000009_catalogo_documental_canonico.sql) antes de 010–015. La 008 requiere las tablas de 006. Si un bloque borrado o parcial devuelve un error, interrumpe la secuencia, ejecuta `rollback;` si la transacción sigue abierta y compara el error con los nombres existentes. Ejecuta cada bloque una vez, solo si falta su estructura.

Orden de este bloque **012 → 013 → 014 → 015**. Coordina 012–015 con el despliegue de esta rama. La 013 exige registrar recepción física antes de que el backend valide una copia, por lo que un cliente administrativo anterior puede recibir un rechazo al intentar validar.

## 012 · Guías, modalidades y preparación

```sql
begin;

alter table public.requisitos_documentales
    add column guia_preparacion jsonb not null default '{}' check (jsonb_typeof(guia_preparacion) = 'object'),
    add column revision_digital text not null default 'opcional'
        check (revision_digital in ('opcional', 'obligatoria', 'no_disponible'));

update public.requisitos_documentales set revision_digital = 'no_disponible' where not aporta_cliente;
update public.requisitos_documentales set guia_preparacion = v.guia
from (values
 ('recibo_cfe', '{"motivo":"Identifica el servicio eléctrico de la instalación.","oficial":"https://www.cfe.mx/","pasos":["Puedes usar un recibo que ya tengas o consultar el portal de CFE."],"comprobaciones":["Revisé el titular","Localicé el número de servicio","Revisé el domicilio","El recibo se lee completo"]}'::jsonb),
 ('constancia_situacion_fiscal', '{"motivo":"Permite revisar los datos fiscales del titular.","oficial":"https://sat.gob.mx/portal/public/tramites/constancia-de-situacion-fiscal","pasos":["Consulta las opciones del SAT y completa el trámite en su sitio oficial."],"comprobaciones":["Revisé el nombre o razón social","Localicé el RFC","La constancia se lee completa"]}'::jsonb),
 ('identificacion_oficial', '{"motivo":"Permite cotejar al titular del trámite.","pasos":["Conserva la identificación y evita reflejos o recortes si decides enviar una copia."],"comprobaciones":["El nombre se puede leer","La imagen está enfocada y completa"]}'::jsonb),
 ('carta_poder', '{"motivo":"Permite preparar los datos de representación.","pasos":["Confirma los datos de quien tramita en Mis datos y consulta con IDC la plantilla aplicable."],"entrega":"Consulta con IDC la plantilla y las firmas que corresponden.","comprobaciones":["Revisé los datos del titular y quien tramita","Consulté las instrucciones de IDC"]}'::jsonb)
) as v(tipo, guia) where tipo_documento = v.tipo;

create table public.portal_preparacion (
    proyecto_id uuid not null references public.proyectos(id),
    requisito_codigo text not null references public.requisitos_documentales(codigo),
    documento text not null,
    marcadas integer[] not null default '{}',
    preparado boolean not null default false,
    actualizado_en timestamptz not null default now(),
    primary key (proyecto_id, requisito_codigo)
);
alter table public.portal_preparacion enable row level security;
revoke all on public.portal_preparacion from public, anon, authenticated, service_role;
grant select on public.portal_preparacion to service_role;

create function public.guardar_preparacion_portal(p_acceso uuid, p_folio text, p_documento text, p_marcadas integer[], p_preparado boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
    v_proyecto uuid;
    v_codigo text;
    v_cantidad integer;
begin
    select p.id into v_proyecto
    from public.portal_accesos a join public.proyectos p on p.id = a.proyecto_id
    where a.id = p_acceso and p.folio = p_folio and not p.es_demo
      and a.activo and a.revocado_at is null and a.expira_at > now()
      and a.permisos @> '{"ver_documentos_autorizados":true}'::jsonb
    for update of a;
    if not found then raise exception using errcode = '42501', message = 'Acceso no autorizado'; end if;

    select codigo, case when jsonb_typeof(guia_preparacion->'comprobaciones') = 'array'
      then least(30, jsonb_array_length(guia_preparacion->'comprobaciones')) else 0 end
    into v_codigo, v_cantidad
    from public.requisitos_documentales where tipo_documento = p_documento and activo and aporta_cliente;
    if not found or p_marcadas is null or p_preparado is null or cardinality(p_marcadas) > 30
      or exists (select from unnest(p_marcadas) as n where n is null or n < 0 or n >= v_cantidad)
      or cardinality(p_marcadas) <> (select count(distinct n) from unnest(p_marcadas) as n)
      or (p_preparado and cardinality(p_marcadas) <> v_cantidad) then
        raise exception using errcode = '22023', message = 'Preparación inválida';
    end if;

    insert into public.portal_preparacion(proyecto_id, requisito_codigo, documento, marcadas, preparado)
    values (v_proyecto, v_codigo, p_documento, p_marcadas, p_preparado)
    on conflict (proyecto_id, requisito_codigo) do update set marcadas = excluded.marcadas,
        preparado = excluded.preparado, actualizado_en = now();
    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'portal_preparacion', v_proyecto, p_folio, 'preparacion_actualizada',
        jsonb_build_object('requisito', v_codigo, 'preparado', p_preparado, 'cantidad', cardinality(p_marcadas)));
    return jsonb_build_object('documento', p_documento, 'marcadas', p_marcadas, 'preparado', p_preparado);
end;
$$;
revoke all on function public.guardar_preparacion_portal(uuid,text,text,integer[],boolean) from public, anon, authenticated;
grant execute on function public.guardar_preparacion_portal(uuid,text,text,integer[],boolean) to service_role;

create function public.configurar_revision_digital(p_id uuid, p_modo text, p_actor uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    update public.requisitos_documentales set revision_digital = p_modo
    where id = p_id and activo and aporta_cliente;
    if not found then return false; end if;
    insert into public.auditoria_eventos(actor_user_id,origen,entidad,entidad_id,accion,detalles)
    values (p_actor,'app','requisito_documental',p_id,'revision_digital_configurada',jsonb_build_object('modalidad',p_modo));
    return true;
end;
$$;
revoke all on function public.configurar_revision_digital(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.configurar_revision_digital(uuid,text,uuid) to service_role;

commit;
```

## 013 · Prevalidación, recepción física y eventos

```sql
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
```

## 014 · Correo verificado y cola

```sql
begin;

create table public.portal_contactos_aviso (
    folio text primary key references public.proyectos(folio),
    correo text not null check (length(correo) <= 254),
    version uuid not null default gen_random_uuid(),
    token_hash text unique check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
    vence_en timestamptz not null,
    verificado_en timestamptz,
    actualizado_en timestamptz not null default now()
);

create table public.portal_cola_correo (
    id uuid primary key default gen_random_uuid(),
    folio text not null references public.proyectos(folio),
    contacto_version uuid not null,
    evento_id bigint unique references public.portal_eventos_documentales(id),
    token text,
    estado text not null default 'pendiente'
        check (estado in ('pendiente','procesando','enviado','fallido')),
    intentos integer not null default 0,
    disponible_en timestamptz not null default now(),
    vence_en timestamptz not null default (now() + interval '18 hours'),
    ultimo_resultado text,
    creado_en timestamptz not null default now()
);
create index portal_cola_correo_pendiente on public.portal_cola_correo(estado,disponible_en);

create table public.portal_intentos_correo (
    id bigint generated always as identity primary key,
    correo_id uuid not null references public.portal_cola_correo(id),
    intento integer not null,
    resultado text not null,
    fecha timestamptz not null default now(),
    unique (correo_id, intento)
);

alter table public.portal_contactos_aviso enable row level security;
alter table public.portal_cola_correo enable row level security;
alter table public.portal_intentos_correo enable row level security;
revoke all on public.portal_contactos_aviso, public.portal_cola_correo, public.portal_intentos_correo
    from public, anon, authenticated, service_role;

create function public.autorizar_correo_portal(p_folio text, p_correo text, p_hash text, p_token text, p_actor uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
    v_version uuid := gen_random_uuid();
begin
    perform 1 from public.proyectos where folio = p_folio and not es_demo for update;
    if not found then return false; end if;

    if exists (select from public.portal_contactos_aviso where folio = p_folio
        and actualizado_en > now() - interval '5 minutes') then
        raise exception using errcode = '40001', message = 'Ya se solicitó una verificación recientemente';
    end if;
    insert into public.portal_contactos_aviso(folio, correo, version, token_hash, vence_en)
    values (p_folio, p_correo, v_version, p_hash, now() + interval '1 hour')
    on conflict (folio) do update set correo = excluded.correo, version = excluded.version,
        token_hash = excluded.token_hash, vence_en = excluded.vence_en, actualizado_en = now(), verificado_en = null;
    insert into public.portal_cola_correo(folio,contacto_version,token,vence_en)
    values (p_folio, v_version, p_token, now() + interval '1 hour');
    insert into public.auditoria_eventos(actor_user_id,origen,entidad,folio,accion,detalles)
    values (p_actor, 'app', 'portal_contacto_aviso', p_folio, 'solicitud_verificacion', '{}');
    return true;
end;
$$;

create function public.verificar_correo_portal(p_hash text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_folio text;
begin
    update public.portal_contactos_aviso set verificado_en = now(), token_hash = null
    where token_hash = p_hash and vence_en > now() and verificado_en is null returning folio into v_folio;
    if not found then return false; end if;
    insert into public.auditoria_eventos(origen,entidad,folio,accion,detalles)
    values ('portal','portal_contacto_aviso',v_folio,'correo_verificado','{}');
    return true;
end;
$$;

create function public.encolar_aviso_documental() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if new.tipo in ('recibido','prevalidado','rechazado','entregado','validado_fisico','aceptado') then
        insert into public.portal_cola_correo(folio, contacto_version, evento_id)
        select c.folio, c.version, new.id from public.portal_contactos_aviso c
        where c.folio = new.folio and c.verificado_en is not null
        on conflict (evento_id) do nothing;
    end if;
    return new;
end;
$$;
create trigger encolar_aviso_documental after insert on public.portal_eventos_documentales
for each row execute function public.encolar_aviso_documental();

create function public.tomar_correo_portal()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
    v public.portal_cola_correo;
    v_correo text;
begin
    update public.portal_cola_correo q set estado = 'fallido', token = null, ultimo_resultado = 'caducado'
    where q.estado in ('pendiente','procesando') and q.disponible_en <= now()
      and (q.vence_en <= now() or q.intentos >= 4 or not exists (
        select 1 from public.portal_contactos_aviso c where c.folio = q.folio and c.version = q.contacto_version
          and ((q.evento_id is null and c.verificado_en is null) or (q.evento_id is not null and c.verificado_en is not null))
      ));
    select q.* into v from public.portal_cola_correo q join public.portal_contactos_aviso c
      on c.folio = q.folio and c.version = q.contacto_version
    where q.estado in ('pendiente','procesando') and q.disponible_en <= now()
        and q.vence_en > now() and q.intentos < 4
        and ((q.evento_id is null and c.verificado_en is null) or (q.evento_id is not null and c.verificado_en is not null))
    order by q.disponible_en, q.id limit 1 for update of q skip locked;
    if not found then return null; end if;
    select correo into v_correo from public.portal_contactos_aviso where folio = v.folio and version = v.contacto_version;
    if not found then return null; end if;
    update public.portal_cola_correo set estado = 'procesando', intentos = intentos + 1,
        disponible_en = now() + interval '2 minutes' where id = v.id;
    return jsonb_build_object('id', v.id, 'intento', v.intentos + 1, 'correo', v_correo,
        'token', v.token, 'tipo', (select tipo from public.portal_eventos_documentales where id = v.evento_id));
end;
$$;

create function public.resolver_correo_portal(p_id uuid,p_intento integer,p_resultado text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
    if p_resultado not in ('aceptado','temporal','rechazado') then return; end if;
    update public.portal_cola_correo
    set estado = case when p_resultado = 'aceptado' then 'enviado'
        when p_resultado = 'temporal' and intentos < 4 then 'pendiente' else 'fallido' end,
        disponible_en = now() + make_interval(mins => 5 * intentos),
        ultimo_resultado = p_resultado,
        token = case when p_resultado = 'temporal' and intentos < 4 then token else null end
    where id = p_id and estado = 'procesando' and intentos = p_intento;
    if found then
        insert into public.portal_intentos_correo(correo_id,intento,resultado)
        values (p_id,p_intento,p_resultado) on conflict (correo_id,intento) do nothing;
    end if;
end;
$$;

revoke all on function public.encolar_aviso_documental() from public, anon, authenticated, service_role;
revoke all on function public.autorizar_correo_portal(text,text,text,text,uuid),
    public.verificar_correo_portal(text), public.tomar_correo_portal(), public.resolver_correo_portal(uuid,integer,text)
    from public, anon, authenticated;
grant execute on function public.autorizar_correo_portal(text,text,text,text,uuid),
    public.verificar_correo_portal(text), public.tomar_correo_portal(), public.resolver_correo_portal(uuid,integer,text) to service_role;

commit;
```

## 015 · Resguardo de muestras PDF

```sql
begin;

create table public.portal_documentos_generados (
    id uuid primary key,
    proyecto_id uuid not null,
    participante_version integer not null,
    acceso_id uuid not null,
    plantilla text not null,
    generado_en timestamptz not null,
    snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
    sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
    ruta_privada text not null unique,
    solo_demostracion boolean not null default true check (solo_demostracion),
    foreign key (proyecto_id, participante_version)
        references public.expediente_participantes_versiones(proyecto_id,version)
);
create index portal_documentos_generados_versiones
    on public.portal_documentos_generados(proyecto_id, generado_en desc);
alter table public.portal_documentos_generados enable row level security;
revoke all on public.portal_documentos_generados from public, anon, authenticated, service_role;
grant select on public.portal_documentos_generados to service_role;

create policy expedientes_generados_solo_backend on storage.objects as restrictive
    for all to authenticated
    using (bucket_id <> 'expedientes' or (storage.foldername(name))[2] is distinct from 'generados')
    with check (bucket_id <> 'expedientes' or (storage.foldername(name))[2] is distinct from 'generados');

create function public.registrar_carta_demo_portal(p_folio text, p_acceso uuid, p_meta jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
    v_proyecto uuid;
    v_id uuid := (p_meta->>'id')::uuid;
    v_version integer := (p_meta->>'version')::integer;
    v_ruta text := p_meta->>'ruta';
    v_datos jsonb;
begin
    select p.id into v_proyecto from public.proyectos p join public.portal_accesos a on a.proyecto_id = p.id
    where p.folio = p_folio and not p.es_demo and a.id = p_acceso and a.activo and a.revocado_at is null
      and a.expira_at > now() and a.permisos @> '{"editar_participantes":true,"ver_documentos_autorizados":true}'::jsonb
    for update of a;
    if not found or v_ruta is distinct from p_folio || '/generados/demo/' || v_id::text || '.pdf'
      or not exists(select from public.requisitos_documentales where activo and tipo_documento = 'carta_poder' and generacion_automatica) then
        raise exception using errcode = '42501', message = 'Generación demostrativa no autorizada';
    end if;
    select datos into v_datos from public.expediente_participantes_versiones
        where proyecto_id = v_proyecto and version = v_version and confirmado;
    if not found then raise exception using errcode = '40001', message = 'Falta versión confirmada'; end if;
    insert into public.portal_documentos_generados(id,proyecto_id,participante_version,acceso_id,plantilla,generado_en,snapshot,sha256,ruta_privada)
    values (v_id,v_proyecto,v_version,p_acceso,p_meta->>'plantilla',(p_meta->>'fecha')::timestamptz,
      jsonb_build_object('proyecto',p_meta->'proyecto','datos',v_datos),p_meta->>'sha256',v_ruta);
    insert into public.auditoria_eventos(origen,entidad,entidad_id,folio,accion,detalles)
    values ('portal','portal_documento_generado',v_id,p_folio,'carta_demo_generada',
        jsonb_build_object('version',v_version,'plantilla',p_meta->>'plantilla'));
end;
$$;
revoke all on function public.registrar_carta_demo_portal(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.registrar_carta_demo_portal(text,uuid,jsonb) to service_role;

commit;
```

## Comprobación posterior

```sql
select revision_digital, count(*) from public.requisitos_documentales group by revision_digital;

select c.relname, c.relrowsecurity,
  has_table_privilege('anon', c.oid, 'SELECT') as lectura_anon,
  has_table_privilege('authenticated', c.oid, 'SELECT') as lectura_directa_autenticado
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
  'portal_preparacion','portal_entregas_fisicas','portal_eventos_documentales',
  'portal_contactos_aviso','portal_cola_correo','portal_intentos_correo','portal_documentos_generados'
) order by c.relname;

select id, public from storage.buckets where id = 'expedientes';
```

El catálogo debe contener modalidades de revisión y siete tablas nuevas deben tener RLS con ambas columnas de lectura en falso. El bucket continúa privado. El rol de servicio usa las funciones autorizadas para escribir. Los documentos generados conservan su marca demostrativa. La Carta Poder solo se habilita en expedientes reales cuando IDC activa la generación del requisito en el catálogo y concede permiso de captura.

## Prueba local y activación de correo

Usa el [catálogo de demos del puerto 5173](http://localhost:5173/demo/portal/demos). En «Por preparar», abre Recibo CFE, guarda una lista y comprueba que el panel de recepciones siga vacío. En «Listo para entrega física», abre Carta Poder y genera una muestra desde los datos ficticios precargados. La demostración guarda su historia en memoria. El flujo real habilitado conserva las versiones en Supabase y el PDF en Storage privado.

IDC autoriza el correo desde la sección de accesos del proyecto. Debe confirmar que la dirección corresponde a un contacto autorizado en Zoho. El destinatario confirma el enlace de un solo uso antes de que se encolen avisos documentales para esa dirección. Cambiarla invalida la verificación anterior. El código de acceso del portal conserva su flujo separado.

Para correo real se requieren `APP_URL` en HTTPS, `PORTAL_RESEND_API_KEY` y `PORTAL_CORREO_DESDE` con el remitente aprobado. Ejecuta `npm run correo:portal` en un entorno backend para procesar un lote acotado. IDC debe programar la ejecución en su infraestructura cuando decida activarlo. La cola retiene errores para reintento y usa una clave idempotente estable; los intentos se limitan a una ventana menor que la retención de la clave del proveedor. La revisión y los Avisos internos funcionan aunque el procesador esté apagado. La notificación por correo está conectada a los eventos documentales; los cambios operativos de Zoho siguen en los Avisos del portal y no encolan correo automáticamente.

Las guías iniciales son orientativas. IDC debe decidir vigencias, identificaciones admisibles, condición de representante y testigos, originales, copias, firmas y plantilla oficial. La muestra PDF carece de validez legal. Ninguna casilla de preparación ni prevalidación cambia compuertas.
