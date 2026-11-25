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
