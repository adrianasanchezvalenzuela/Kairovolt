-- ============================================================
-- KAIROVOLT | MIGRACION 006
-- Integracion con Zoho: bitacora de sincronizaciones y referencias externas
--
-- sincronizaciones      : bitacora append-only de cada paso hacia Zoho (ok / error / omitido).
--                         La clave de idempotencia evita repetir un paso que ya salio bien.
-- referencias_externas  : a que trato de CRM / proyecto de Projects / carpeta de WorkDrive
--                         corresponde cada folio de KairoVolt.
-- Solo el backend (service_role) las usa. El personal autenticado puede LEER la bitacora.
-- "folio" es texto sin llave foranea: los folios nacen en Zoho y pueden no existir aun en "proyectos".
-- ============================================================

begin;

create table public.sincronizaciones (
    id              uuid primary key default gen_random_uuid(),
    clave           text not null,
    folio           text not null check (folio = upper(folio) and length(trim(folio)) > 0),
    destino         text not null check (destino in ('crm', 'projects', 'workdrive')),
    operacion       text not null,
    estado          text not null check (estado in ('ok', 'error', 'omitido')),
    accion          text check (accion in ('creado', 'actualizado', 'sin_cambios', 'simulado', 'nueva_version')),
    id_externo      text,
    error           text check (error is null or length(error) <= 300),
    categoria_error text,
    intentos        integer not null default 1 check (intentos >= 1),
    creado_en       timestamptz not null default now()
);

-- Busqueda de idempotencia: "ya hay un paso exitoso con esta clave?"
create index sincronizaciones_clave_ok_idx on public.sincronizaciones (clave) where estado = 'ok';
create index sincronizaciones_folio_idx    on public.sincronizaciones (folio, creado_en desc);
create index sincronizaciones_recientes_idx on public.sincronizaciones (creado_en desc);

-- Bitacora append-only (misma funcion que la auditoria).
create trigger sincronizaciones_no_update
before update on public.sincronizaciones
for each row execute function public.prevent_audit_mutation();

create trigger sincronizaciones_no_delete
before delete on public.sincronizaciones
for each row execute function public.prevent_audit_mutation();

create table public.referencias_externas (
    folio       text not null check (folio = upper(folio) and length(trim(folio)) > 0),
    sistema     text not null check (sistema in ('zoho_crm', 'zoho_projects', 'zoho_workdrive')),
    tipo        text not null check (length(trim(tipo)) > 0),
    id_externo  text not null check (length(trim(id_externo)) > 0),
    url         text,
    actualizado_en timestamptz not null default now(),
    primary key (folio, sistema, tipo)
);

create or replace function public.touch_referencia_externa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.actualizado_en := now();
    return new;
end;
$$;

create trigger referencias_externas_touch
before update on public.referencias_externas
for each row execute function public.touch_referencia_externa();

-- ------------------------------------------------------------
-- RLS: activada; el backend entra con service_role (se salta RLS).
-- El personal autenticado solo lee.
-- ------------------------------------------------------------
alter table public.sincronizaciones enable row level security;
alter table public.referencias_externas enable row level security;

create policy sincronizaciones_select on public.sincronizaciones
    for select to authenticated using (true);
create policy referencias_externas_select on public.referencias_externas
    for select to authenticated using (true);

grant select, insert on public.sincronizaciones to service_role;
grant select, insert, update on public.referencias_externas to service_role;
grant select on public.sincronizaciones, public.referencias_externas to authenticated;

revoke all on public.sincronizaciones, public.referencias_externas from anon;

commit;
