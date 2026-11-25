# SQL pendiente del expediente inteligente

Ejecuta los bloques por separado en Supabase SQL Editor sobre el proyecto configurado en KairóVolt. Cada migración conserva su transacción. Una comprobación REST de solo lectura encontró el catálogo de la 009 y las tablas de integración de la 006. La tabla de recepciones 007 y las estructuras 010–011 estaban ausentes. La 008 se verifica con la consulta siguiente.

## Verificación previa

```sql
select
  to_regclass('public.proyectos') as proyectos,
  to_regclass('public.portal_accesos') as accesos,
  to_regclass('public.sincronizaciones') as sincronizaciones_006,
  to_regclass('public.referencias_externas') as referencias_006,
  to_regclass('public.portal_recepciones') as recepciones_007,
  exists (
    select from pg_trigger
    where tgrelid = 'public.auditoria_eventos'::regclass
      and tgname = 'auditoria_no_truncate' and tgenabled = 'O'
  ) as auditoria_008,
  exists (
    select from information_schema.columns
    where table_schema = 'public' and table_name = 'requisitos_documentales'
      and column_name = 'tipo_documento'
  ) as catalogo_009,
  to_regclass('public.expediente_participantes_versiones') as participantes_010,
  to_regprocedure('public.revisar_recepcion_portal(uuid,uuid,text,text,text)') as revision_011;
select id, public from storage.buckets where id = 'expedientes';
```

En el entorno comprobado deberían existir los proyectos, los accesos y las dos tablas de la 006. El bucket debe existir con `public = false`. Confirma que la 009 devuelve `true`. Ejecuta **007 → 008 si falta → 010 → 011**. La 008 depende de la 006, la 010 depende de proyectos, accesos y auditoría, y la 011 depende de la 007, la 009 y el bucket de la 004. Si cualquier dependencia anterior a la 007 falta, verifica primero que seleccionaste el proyecto correcto. Si el proyecto tiene un esquema diferente, detente antes de aplicar los bloques.

Si SQL Editor devuelve un error, ejecuta `rollback;` si la transacción sigue abierta. Conserva el mensaje y revisa la comprobación previa. Los bloques históricos pueden tener objetos preexistentes y no deben ejecutarse nuevamente si están completos. Si la 008 tiene las políticas nuevas pero carece del trigger, compara el estado con el bloque completo y resuelve la ejecución parcial antes de continuar.

## 007 — Recepciones del portal

Ejecuta si `recepciones_007` es `null`.

```sql
-- ============================================================
-- KAIROVOLT | MIGRACION 007
-- Portal del cliente: confirmaciones de recepcion de archivos
--
-- Cada archivo que un cliente sube desde el portal queda registrado aqui (quien, cuando, huella SHA-256 y ruta
-- en el bucket PRIVADO "expedientes"). El personal de IDC revisa y marca aceptado o rechazado (con un motivo
-- redactado PARA el cliente). El cliente nunca toca esta tabla: el backend valida su acceso y le devuelve solo
-- la proyeccion publica.
-- "folio" es texto sin llave foranea (mismo criterio que sincronizaciones).
-- ============================================================

begin;

create table public.portal_recepciones (
    id              uuid primary key default gen_random_uuid(),
    -- Folio legible del acuse que se le entrega al cliente (p. ej. REC-3F9A1C).
    recibo          text not null unique check (recibo ~ '^REC-[0-9A-F]{6}$'),
    folio           text not null check (folio = upper(folio) and length(trim(folio)) > 0),
    acceso_id       uuid references public.portal_accesos(id) on delete set null,
    -- Tipo de documento solicitado (requisito del catalogo) y su nombre mostrado al cliente.
    documento_id    text not null check (length(trim(documento_id)) > 0),
    documento_nombre text not null,
    archivo_nombre  text not null check (length(archivo_nombre) <= 120),
    mime            text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
    tamano_bytes    integer not null check (tamano_bytes > 0 and tamano_bytes <= 20971520),
    sha256          text not null check (sha256 ~ '^[a-f0-9]{64}$'),
    ruta_almacen    text not null,
    estado          text not null default 'recibido' check (estado in ('recibido', 'aceptado', 'rechazado')),
    -- Mensaje para el cliente cuando se rechaza. Es visible para el cliente: no escribir notas internas aqui.
    motivo_rechazo  text check (motivo_rechazo is null or length(motivo_rechazo) <= 500),
    revisado_por    uuid references auth.users(id) on delete set null,
    revisado_en     timestamptz,
    creado_en       timestamptz not null default now(),
    constraint portal_recepciones_rechazo_chk check (estado <> 'rechazado' or motivo_rechazo is not null)
);

create index portal_recepciones_folio_idx on public.portal_recepciones (folio, creado_en desc);
create index portal_recepciones_estado_idx on public.portal_recepciones (estado) where estado = 'recibido';

alter table public.portal_recepciones enable row level security;

-- Personal activo: lectura; coordinacion y admin revisan (aceptar / rechazar). El cliente no tiene politica alguna.
create policy portal_recepciones_select_staff on public.portal_recepciones
    for select to authenticated using (public.is_active_staff());
create policy portal_recepciones_update_revisores on public.portal_recepciones
    for update to authenticated
    using (public.has_any_role(array['admin', 'coordinacion_admin', 'proyectista']))
    with check (public.has_any_role(array['admin', 'coordinacion_admin', 'proyectista']));

grant select, insert, update on public.portal_recepciones to service_role;
grant select on public.portal_recepciones to authenticated;
grant update (estado, motivo_rechazo, revisado_por, revisado_en) on public.portal_recepciones to authenticated;
revoke all on public.portal_recepciones from anon;

-- El backend (service_role) tambien necesita leer y actualizar los accesos del portal.
grant select, insert, update on public.portal_accesos to service_role;
revoke all on public.portal_accesos from anon, authenticated;

commit;
```

Comprueba que `to_regclass('public.portal_recepciones')` devuelve `portal_recepciones`.

## 008 — Permisos y auditoría

Ejecuta si `auditoria_008` es `false` y las políticas de esta migración aún no existen.

```sql
-- KAIROVOLT | MIGRACION 008
-- Restringe la lectura de referencias de integracion y endurece la auditoria.
-- El backend usa service_role para insertar eventos directamente; la RPC de
-- cliente no tiene consumidores en esta aplicacion y se revoca.

begin;

-- La bitacora y las referencias solo son visibles para personal activo.
drop policy if exists sincronizaciones_select on public.sincronizaciones;
create policy sincronizaciones_select_staff
on public.sincronizaciones
for select
to authenticated
using (public.is_active_staff());

drop policy if exists referencias_externas_select on public.referencias_externas;
create policy referencias_externas_select_staff
on public.referencias_externas
for select
to authenticated
using (public.is_active_staff());

revoke all on public.sincronizaciones, public.referencias_externas from anon;
grant select on public.sincronizaciones, public.referencias_externas to authenticated;

-- La auditoria es de solo lectura para el personal. El backend conserva INSERT
-- mediante service_role; no necesita UPDATE, DELETE ni TRUNCATE.
revoke all on public.auditoria_eventos from public, anon, authenticated, service_role;
grant select on public.auditoria_eventos to authenticated;
grant select, insert on public.auditoria_eventos to service_role;

revoke all on function public.registrar_evento_auditoria(text, uuid, text, text, jsonb)
from public, anon, authenticated, service_role;

create or replace function public.prevent_audit_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'La auditoria es append-only: no se permite TRUNCATE';
end;
$$;

revoke all on function public.prevent_audit_truncate() from public, anon, authenticated, service_role;

drop trigger if exists auditoria_no_truncate on public.auditoria_eventos;
create trigger auditoria_no_truncate
before truncate on public.auditoria_eventos
for each statement execute function public.prevent_audit_truncate();

comment on table public.auditoria_eventos is
    'Append-only para roles de aplicacion. service_role solo inserta; un propietario/superusuario de PostgreSQL puede alterar el esquema o deshabilitar triggers, por lo que esta tabla no es inmutable frente a administradores de la base.';

commit;
```

El trigger `auditoria_no_truncate` debe aparecer habilitado. El rol de servicio puede insertar auditoría y sus permisos de actualización y truncado deben ser falsos.

## 010 — Versiones de participantes

Ejecuta si `participantes_010` es `null`.

```sql
begin;

create table public.expediente_participantes_versiones (
    proyecto_id uuid not null references public.proyectos(id),
    version integer not null check (version > 0),
    acceso_id uuid not null,
    datos jsonb not null check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 10000),
    confirmado boolean not null,
    creado_en timestamptz not null default now(),
    primary key (proyecto_id, version)
);

alter table public.expediente_participantes_versiones enable row level security;
revoke all on public.expediente_participantes_versiones from public, anon, authenticated, service_role;
grant select on public.expediente_participantes_versiones to service_role;

create function public.guardar_participantes(
    p_folio text, p_acceso uuid, p_version integer, p_datos jsonb, p_confirmado boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    v_proyecto uuid;
    v_version integer;
begin
    select p.id into v_proyecto
    from public.proyectos p
    join public.portal_accesos a on a.proyecto_id = p.id
    where p.folio = p_folio and not p.es_demo and a.id = p_acceso
      and a.activo and a.revocado_at is null and a.expira_at > now()
      and a.permisos @> '{"editar_participantes":true}'::jsonb
    for update of p, a;

    if not found then
        raise exception using errcode = '42501', message = 'Acceso sin permiso para el expediente';
    end if;

    select coalesce(max(version), 0) into v_version
    from public.expediente_participantes_versiones where proyecto_id = v_proyecto;

    if v_version is distinct from p_version then
        raise exception using errcode = '40001', message = 'La versión cambió';
    end if;

    insert into public.expediente_participantes_versiones(proyecto_id, version, acceso_id, datos, confirmado)
    values (v_proyecto, v_version + 1, p_acceso, p_datos, p_confirmado);

    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'expediente_participantes', v_proyecto, p_folio, 'participantes_guardados',
        jsonb_build_object('version', v_version + 1, 'confirmado', p_confirmado, 'accesoId', p_acceso));

    return jsonb_build_object('version', v_version + 1, 'datos', p_datos, 'confirmado', p_confirmado);
end;
$$;

revoke all on function public.guardar_participantes(text,uuid,integer,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.guardar_participantes(text,uuid,integer,jsonb,boolean) to service_role;

commit;
```

La tabla debe tener RLS. `anon` y `authenticated` carecen de permiso de lectura y ejecución de la función.

## 011 — Registro y revisión transaccional de recepciones

Ejecuta si `revision_011` es `null`.

```sql
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
```

## Verificación posterior

```sql
select
  c.relname as tabla,
  c.relrowsecurity as rls,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_puede_leer,
  has_table_privilege('authenticated', c.oid, 'SELECT') as personal_puede_leer,
  has_table_privilege('service_role', c.oid, 'UPDATE') as servicio_puede_editar
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('expediente_participantes_versiones', 'portal_recepciones')
order by c.relname;

select
  p.proname as funcion,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('guardar_participantes', 'registrar_recepcion_portal', 'revisar_recepcion_portal')
order by p.proname;

select id, public from storage.buckets where id = 'expedientes';
```

Deben aparecer dos tablas con RLS, ambas con `anon_puede_leer = false` y `servicio_puede_editar = false`. Solo `portal_recepciones` debe admitir lectura directa del personal mediante su política de usuario activo. Las tres funciones deben devolver `false, false, true` para los roles listados. El bucket debe seguir siendo privado.

Tras verificar, prueba con un folio controlado y archivos sintéticos antes de activar el permiso de captura para un cliente real. Si Storage guardó un archivo y se perdió la conexión durante el registro, consulta los posibles huérfanos de más de un día antes de retirarlos mediante la API de Storage. La consulta es de solo lectura.

```sql
select o.name, o.created_at
from storage.objects o
where o.bucket_id = 'expedientes'
  and split_part(o.name, '/', 2) = 'portal'
  and o.created_at < now() - interval '1 day'
  and not exists (select from public.portal_recepciones r where r.ruta_almacen = o.name)
  and not exists (select from public.documentos d where d.storage_bucket = o.bucket_id and d.storage_path = o.name);
```
