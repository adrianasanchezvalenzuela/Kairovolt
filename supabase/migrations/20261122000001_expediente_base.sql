-- ============================================================
-- KAIROVOLT | MIGRACION 001
-- Base del expediente y datos documentales
-- PostgreSQL / Supabase
--
-- Zoho CRM / Projects conserva:
-- - Tratos y proyectos operativos
-- - Compuertas G0-G3
-- - Observaciones operativas
--
-- Supabase conserva:
-- - Folios minimos de enlace
-- - Archivos y datos documentales
-- - Datos tecnicos del sistema FV
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. EXTENSIONES
-- ------------------------------------------------------------

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 2. TABLA MINIMA DE PROYECTOS
-- ------------------------------------------------------------

create table public.proyectos (
    id uuid primary key default gen_random_uuid(),

    -- Clave compartida con Zoho. No usar IDs de Zoho como PK.
    folio text not null unique,

    -- Identifica registros de demostracion.
    es_demo boolean not null default false,

    -- Configuracion del flujo documental.
    -- No representa una compuerta de Zoho.
    uvie_antes_de_ingreso boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint proyectos_folio_formato_chk
        check (folio = upper(folio)),

    constraint proyectos_folio_no_vacio_chk
        check (length(trim(folio)) > 0),

    -- CORRECCION KV: mismo formato que valida el backend (/^KV-\d{4}-\d{3,}$/i),
    -- mas la excepcion del proyecto de demostracion KV-MOCK-0001.
    constraint proyectos_folio_patron_chk
        check (folio ~ '^KV-([0-9]{4}|MOCK)-[0-9]{3,}$')
);

create index proyectos_es_demo_idx
    on public.proyectos (es_demo);

-- ------------------------------------------------------------
-- 3. DATOS TECNICOS DEL SISTEMA FOTOVOLTAICO
-- ------------------------------------------------------------

create table public.sistemas_fotovoltaicos (
    id uuid primary key default gen_random_uuid(),

    proyecto_id uuid not null unique
        references public.proyectos(id)
        on delete cascade,

    numero_paneles integer,
    potencia_panel_w numeric(10,2),

    -- Potencia AC declarada del sistema.
    -- No almacenar potencia DC calculada.
    potencia_ac_kw numeric(10,2),

    numero_inversores integer,
    marca_inversor text,
    potencia_inversor_kw numeric(10,2),

    transformador_kva numeric(10,2),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint sistema_numero_paneles_chk
        check (numero_paneles is null or numero_paneles >= 0),

    constraint sistema_potencia_panel_chk
        check (potencia_panel_w is null or potencia_panel_w >= 0),

    constraint sistema_potencia_ac_chk
        check (potencia_ac_kw is null or potencia_ac_kw >= 0),

    constraint sistema_numero_inversores_chk
        check (numero_inversores is null or numero_inversores >= 0),

    constraint sistema_potencia_inversor_chk
        check (potencia_inversor_kw is null or potencia_inversor_kw >= 0),

    constraint sistema_transformador_chk
        check (transformador_kva is null or transformador_kva >= 0)
);

-- ------------------------------------------------------------
-- 4. DOCUMENTOS DEL EXPEDIENTE
-- ------------------------------------------------------------

create table public.documentos (
    id uuid primary key default gen_random_uuid(),

    proyecto_id uuid not null
        references public.proyectos(id)
        on delete cascade,

    -- Codigo estable del requisito documental.
    -- Se relaciona con el catalogo editable en la migracion 002.
    requisito_codigo text not null,

    -- Nombre original del archivo.
    nombre_archivo text not null,

    -- Ruta dentro del bucket privado "expedientes".
    -- Ejemplo: KV-2026-004/<uuid>/solicitud.pdf
    storage_bucket text not null default 'expedientes',
    storage_path text not null,

    mime_type text,
    tamano_bytes bigint,

    -- Fechas capturadas explicitamente.
    -- Se dejan NULL si no se conocen o no aparecen.
    fecha_emision date,
    fecha_vigencia date,

    -- Metadatos opcionales para control de versiones.
    version integer not null default 1,
    documento_sustituye_id uuid
        references public.documentos(id)
        on delete set null,

    -- Usuario que cargo el documento.
    uploaded_by uuid
        references auth.users(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint documentos_nombre_no_vacio_chk
        check (length(trim(nombre_archivo)) > 0),

    constraint documentos_requisito_no_vacio_chk
        check (length(trim(requisito_codigo)) > 0),

    constraint documentos_storage_path_no_vacio_chk
        check (length(trim(storage_path)) > 0),

    constraint documentos_tamano_chk
        check (tamano_bytes is null or tamano_bytes >= 0),

    constraint documentos_version_chk
        check (version >= 1),

    -- Evita repetir accidentalmente la misma ruta.
    constraint documentos_storage_unico
        unique (storage_bucket, storage_path)
);

create index documentos_proyecto_idx
    on public.documentos (proyecto_id);

create index documentos_requisito_idx
    on public.documentos (requisito_codigo);

create index documentos_fecha_vigencia_idx
    on public.documentos (fecha_vigencia);

create index documentos_created_at_idx
    on public.documentos (created_at desc);

-- ------------------------------------------------------------
-- 5. DATOS DECLARADOS POR DOCUMENTO
-- ------------------------------------------------------------

create table public.documento_datos_declarados (
    id uuid primary key default gen_random_uuid(),

    documento_id uuid not null
        references public.documentos(id)
        on delete cascade,

    -- Campos controlados para evitar nombres arbitrarios.
    campo text not null,

    -- FALSE: el documento no declara ese dato.
    -- TRUE: el documento si declara el dato, aunque este vacio.
    declarado boolean not null,

    -- Se usa texto para conservar literalmente lo capturado.
    -- Ejemplos: "MT", "CS6.2-66TB-615", "6921.31", "" (declarado vacio)
    valor_texto text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint documento_dato_campo_chk
        check (
            campo in (
                'nivel_tension',
                'modelo_modulo',
                'consumo_kwh_mes',
                'coordenadas_croquis',
                'referencia_croquis'
            )
        ),

    constraint documento_dato_estado_chk
        check (
            (declarado = false and valor_texto is null)
            or
            (declarado = true and valor_texto is not null)
        ),

    -- Un campo aparece una sola vez por documento.
    constraint documento_dato_unico
        unique (documento_id, campo)
);

create index documento_datos_documento_idx
    on public.documento_datos_declarados (documento_id);

create index documento_datos_campo_idx
    on public.documento_datos_declarados (campo);

-- ------------------------------------------------------------
-- 6. TRIGGER PARA updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger proyectos_set_updated_at
before update on public.proyectos
for each row execute function public.set_updated_at();

create trigger sistemas_fotovoltaicos_set_updated_at
before update on public.sistemas_fotovoltaicos
for each row execute function public.set_updated_at();

create trigger documentos_set_updated_at
before update on public.documentos
for each row execute function public.set_updated_at();

create trigger documento_datos_set_updated_at
before update on public.documento_datos_declarados
for each row execute function public.set_updated_at();

commit;
