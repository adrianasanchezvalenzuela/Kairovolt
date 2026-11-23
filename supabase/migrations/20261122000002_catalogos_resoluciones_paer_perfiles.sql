-- ============================================================
-- KAIROVOLT | MIGRACION 002
-- Catalogos, resoluciones, checklist G2, PAER y perfiles
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. CATALOGO EDITABLE DE REQUISITOS DOCUMENTALES
-- ------------------------------------------------------------

create table public.requisitos_documentales (
    id uuid primary key default gen_random_uuid(),

    codigo text not null unique,
    nombre text not null,
    descripcion text,

    categoria text not null,
    obligatorio boolean not null default true,
    condicion text,

    -- Permite ocultar/desactivar requisitos sin borrarlos.
    activo boolean not null default true,

    orden integer not null default 0,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint requisito_codigo_formato_chk
        check (codigo = upper(codigo)),

    constraint requisito_nombre_chk
        check (length(trim(nombre)) > 0),

    constraint requisito_categoria_chk
        check (
            categoria in (
                'solicitud',
                'cliente',
                'tecnico',
                'instalacion',
                'legal',
                'dictamen'
            )
        ),

    constraint requisito_condicion_chk
        check (
            obligatorio = true
            or condicion is not null
        )
);

create index requisitos_activos_orden_idx
    on public.requisitos_documentales (activo, orden);

-- Relacionar los documentos existentes con el catalogo.
alter table public.documentos
    add constraint documentos_requisito_fk
    foreign key (requisito_codigo)
    references public.requisitos_documentales(codigo)
    on update cascade
    on delete restrict;

create trigger requisitos_set_updated_at
before update on public.requisitos_documentales
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. SEMILLA DE 21 REQUISITOS BASE
--
-- AVISO KV (PROVISIONAL): este catalogo fue propuesto por ChatGPT y NO coincide
-- con el catalogo base G0-G3 que usa hoy el codigo de KairoVolt
-- (src/data/catalogo-requisitos.mock.ts: 21 tipos con compuerta, canal,
-- requiere_vigencia, aporta_cliente y reubicable_por_zona).
-- Hay que alinearlos antes de conectar el expediente. Ver supabase/README.md.
-- ------------------------------------------------------------

insert into public.requisitos_documentales (
    codigo,
    nombre,
    descripcion,
    categoria,
    obligatorio,
    condicion,
    orden
)
values
(
    'SOLICITUD_INTERCONEXION',
    'Solicitud de interconexión',
    'Formato de solicitud correspondiente al tipo de instalación.',
    'solicitud',
    true,
    null,
    1
),
(
    'RECIBO_CFE',
    'Recibo de energía eléctrica',
    'Recibo del servicio asociado al punto de suministro.',
    'cliente',
    true,
    null,
    2
),
(
    'IDENTIFICACION_TITULAR',
    'Identificación oficial del titular',
    'Identificación vigente del titular del servicio.',
    'cliente',
    true,
    null,
    3
),
(
    'CONSTANCIA_FISCAL',
    'Constancia de situación fiscal',
    'Constancia fiscal del titular o persona moral correspondiente.',
    'cliente',
    false,
    'Requerida cuando el trámite o la modalidad aplicable solicite información fiscal.',
    4
),
(
    'ACREDITACION_REPRESENTACION',
    'Acreditación de representación legal',
    'Documento que acredita facultades de quien realiza el trámite.',
    'legal',
    false,
    'Requerida cuando el trámite lo realiza una persona distinta del titular o representante legal acreditado.',
    5
),
(
    'IDENTIFICACION_REPRESENTANTE',
    'Identificación del representante',
    'Identificación oficial de la persona que representa al titular.',
    'cliente',
    false,
    'Requerida cuando existe representante o apoderado.',
    6
),
(
    'IDENTIFICACIONES_TESTIGOS',
    'Identificaciones de testigos',
    'Identificaciones asociadas a la carta poder cuando correspondan.',
    'cliente',
    false,
    'Requeridas únicamente cuando el instrumento de representación las solicite.',
    7
),
(
    'CROQUIS_UBICACION',
    'Croquis de ubicación',
    'Ubicación del servicio y del sistema de generación.',
    'tecnico',
    true,
    null,
    8
),
(
    'DIAGRAMA_UNIFILAR',
    'Diagrama unifilar',
    'Diagrama eléctrico del sistema y punto de interconexión.',
    'tecnico',
    true,
    null,
    9
),
(
    'MEMORIA_CALCULO',
    'Memoria de cálculo',
    'Memoria técnica de cálculo aplicable al proyecto.',
    'tecnico',
    true,
    null,
    10
),
(
    'FICHA_MODULOS',
    'Ficha técnica de módulos fotovoltaicos',
    'Especificaciones del modelo de módulo instalado.',
    'tecnico',
    false,
    'Requerida para proyectos que incorporan módulos fotovoltaicos.',
    11
),
(
    'CERTIFICADO_MODULOS',
    'Certificado de módulos fotovoltaicos',
    'Certificado o evidencia de cumplimiento aplicable al módulo.',
    'tecnico',
    false,
    'Requerido cuando la regulación o el procedimiento aplicable lo solicite.',
    12
),
(
    'FICHA_INVERSOR',
    'Ficha técnica de inversor',
    'Especificaciones del modelo de inversor instalado.',
    'tecnico',
    false,
    'Requerida para proyectos que incorporan inversores.',
    13
),
(
    'CERTIFICADO_INVERSOR',
    'Certificado de inversor',
    'Certificado o evidencia de cumplimiento del inversor.',
    'tecnico',
    false,
    'Requerido cuando la regulación o el procedimiento aplicable lo solicite.',
    14
),
(
    'FOTOGRAFIAS_SISTEMA',
    'Fotografías generales del sistema',
    'Evidencia visual de la instalación fotovoltaica.',
    'instalacion',
    false,
    'Requeridas cuando el procedimiento o revisión técnica las solicite.',
    15
),
(
    'FOTOGRAFIAS_TABLERO',
    'Fotografías de tablero eléctrico',
    'Evidencia visual del tablero y sus elementos relevantes.',
    'instalacion',
    false,
    'Requeridas cuando el procedimiento o revisión técnica las solicite.',
    16
),
(
    'FOTOGRAFIAS_MODULOS',
    'Fotografías de módulos instalados',
    'Evidencia visual de módulos y su instalación.',
    'instalacion',
    false,
    'Requeridas cuando el procedimiento o revisión técnica las solicite.',
    17
),
(
    'DICTAMEN_UVIE',
    'Dictamen de UVIE',
    'Dictamen de verificación de instalaciones eléctricas cuando corresponda.',
    'dictamen',
    false,
    'Depende de la modalidad, alcance y requisitos normativos aplicables.',
    18
),
(
    'PLANOS_INSTALACION',
    'Planos de instalación',
    'Planos técnicos de la instalación eléctrica o fotovoltaica.',
    'tecnico',
    false,
    'Requeridos según el alcance y documentación técnica solicitada.',
    19
),
(
    'ACREDITACION_PROPIEDAD',
    'Acreditación de propiedad o posesión',
    'Documento que acredita la relación con el inmueble.',
    'legal',
    false,
    'Requerida cuando el procedimiento aplicable solicite acreditar propiedad o posesión.',
    20
),
(
    'AUTORIZACION_PROPIETARIO',
    'Autorización del propietario',
    'Autorización para realizar trabajos o trámites en el inmueble.',
    'legal',
    false,
    'Requerida cuando el solicitante no es propietario o debe acreditar autorización.',
    21
)
on conflict (codigo) do update set
    nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    categoria = excluded.categoria,
    obligatorio = excluded.obligatorio,
    condicion = excluded.condicion,
    orden = excluded.orden,
    activo = true;

-- ------------------------------------------------------------
-- 3. RESOLUCIONES HUMANAS DE DATOS DOCUMENTALES
-- ------------------------------------------------------------

-- Esta tabla NO replica observaciones de Zoho.
-- Registra decisiones sobre datos capturados en documentos:
-- aceptar, solicitar correccion o marcar como no aplicable.

create table public.resoluciones_documentales (
    id uuid primary key default gen_random_uuid(),

    documento_dato_id uuid not null
        references public.documento_datos_declarados(id)
        on delete restrict,

    decision text not null,

    valor_resuelto text,
    motivo text not null,

    evidencia_documento_id uuid
        references public.documentos(id)
        on delete set null,

    resuelto_por uuid not null
        references auth.users(id)
        on delete restrict,

    resuelto_at timestamptz not null default now(),

    created_at timestamptz not null default now(),

    constraint resolucion_decision_chk
        check (
            decision in (
                'aceptado',
                'correccion_requerida',
                'no_aplica'
            )
        ),

    constraint resolucion_motivo_chk
        check (length(trim(motivo)) > 0)
);

create index resoluciones_dato_idx
    on public.resoluciones_documentales (documento_dato_id);

create index resoluciones_resuelto_at_idx
    on public.resoluciones_documentales (resuelto_at desc);

-- ------------------------------------------------------------
-- 4. APROBACIONES DEL CHECKLIST G2
-- ------------------------------------------------------------

-- Se almacena la decision humana y una fotografia del checklist.
-- NO se crea una tabla de compuertas ni se replica el estado G2
-- operativo de Zoho.

create table public.aprobaciones_checklist_g2 (
    id uuid primary key default gen_random_uuid(),

    proyecto_id uuid not null
        references public.proyectos(id)
        on delete restrict,

    version_checklist integer not null default 1,

    resultado text not null,

    -- Snapshot de los elementos revisados y su resultado.
    -- No usarlo para guardar el estado de las compuertas Zoho.
    checklist_snapshot jsonb not null,

    comentarios text,

    aprobado_por uuid not null
        references auth.users(id)
        on delete restrict,

    aprobado_at timestamptz not null default now(),

    created_at timestamptz not null default now(),

    constraint g2_version_chk
        check (version_checklist >= 1),

    constraint g2_resultado_chk
        check (
            resultado in (
                'aprobado',
                'rechazado'
            )
        ),

    constraint g2_snapshot_objeto_chk
        check (jsonb_typeof(checklist_snapshot) = 'object')
);

create index g2_aprobaciones_proyecto_idx
    on public.aprobaciones_checklist_g2 (proyecto_id, aprobado_at desc);

-- ------------------------------------------------------------
-- 5. ACUERDOS SEMANALES DEL SPRINT DE ENERGIZACION (PAER)
--
-- AVISO KV: los estados y el responsable difieren del tipo del codigo
-- (AccionAcordada: 'completada' | 'pendiente' | 'no_realizada';
-- responsable de texto libre; campo "semana"). Ver supabase/README.md.
-- ------------------------------------------------------------

create table public.acuerdos_paer (
    id uuid primary key default gen_random_uuid(),

    proyecto_id uuid not null
        references public.proyectos(id)
        on delete restrict,

    semana_inicio date not null,

    acuerdo text not null,

    responsable_id uuid
        references auth.users(id)
        on delete set null,

    fecha_compromiso date,

    estado text not null default 'pendiente',

    resultado text,

    registrado_por uuid not null
        references auth.users(id)
        on delete restrict,

    registrado_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint paer_acuerdo_chk
        check (length(trim(acuerdo)) > 0),

    constraint paer_estado_chk
        check (
            estado in (
                'pendiente',
                'en_progreso',
                'cumplido',
                'no_cumplido',
                'cancelado'
            )
        ),

    constraint paer_semana_unica
        unique (proyecto_id, semana_inicio, acuerdo)
);

create index paer_semana_idx
    on public.acuerdos_paer (semana_inicio desc);

create index paer_responsable_idx
    on public.acuerdos_paer (responsable_id, estado);

create trigger acuerdos_paer_set_updated_at
before update on public.acuerdos_paer
for each row execute function public.set_updated_at();

-- Vista de apoyo: acuerdos semanales por folio.
create or replace view public.v_paer_semanal
with (security_invoker = true)
as
select
    p.folio,
    p.es_demo,
    a.id as acuerdo_id,
    a.semana_inicio,
    a.acuerdo,
    a.responsable_id,
    a.fecha_compromiso,
    a.estado,
    a.resultado,
    a.registrado_at,
    a.updated_at
from public.acuerdos_paer a
join public.proyectos p
    on p.id = a.proyecto_id;

-- ------------------------------------------------------------
-- 6. PERFILES DEL PERSONAL VINCULADOS A SUPABASE AUTH
-- ------------------------------------------------------------

create table public.perfiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    nombre_completo text,
    correo text,

    rol text not null default 'consulta',

    activo boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint perfiles_rol_chk
        check (
            rol in (
                'admin',
                'coordinacion_admin',
                'proyectista',
                'supervisor_campo',
                'consulta'
            )
        )
);

create index perfiles_rol_idx
    on public.perfiles (rol);

create index perfiles_activo_idx
    on public.perfiles (activo);

create trigger perfiles_set_updated_at
before update on public.perfiles
for each row execute function public.set_updated_at();

-- Crear perfil automaticamente al registrar usuario en Auth.
-- CORRECCION KV: el perfil nace INACTIVO (activo = false). Con activo = true,
-- cualquiera que se registrara por signUp (anon key publica) quedaria como
-- personal activo con lectura de TODOS los expedientes. Un admin lo activa
-- y le asigna rol desde el backend o el SQL Editor.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.perfiles (
        id,
        nombre_completo,
        correo,
        rol,
        activo
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', ''),
        new.email,
        'consulta',
        false
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

commit;
