-- ============================================================
-- KAIROVOLT | MIGRACION 003
-- Seguridad, portal de clientes, auditoria y RLS
-- PostgreSQL / Supabase
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. FUNCIONES DE IDENTIDAD Y AUTORIZACION
-- ------------------------------------------------------------

-- Devuelve el rol del usuario autenticado.
-- SECURITY DEFINER evita recursividad al consultar perfiles
-- desde las politicas RLS de esa misma tabla.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.rol
    from public.perfiles p
    where p.id = auth.uid()
      and p.activo = true
    limit 1;
$$;

create or replace function public.has_any_role(
    allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        public.current_user_role() = any(allowed_roles),
        false
    );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.current_user_role() is not null;
$$;

-- Evita que un usuario modifique su propio rol mediante
-- una actualizacion directa de su perfil.
-- Los cambios de rol solo los realiza admin.
--
-- CORRECCION KV: la restriccion aplica solo a usuarios autenticados de la app
-- (auth.uid() no nulo). El backend con service_role y el SQL Editor no tienen
-- auth.uid(); con la version original su current_user_role() era NULL, el
-- "is distinct from 'admin'" daba TRUE y ni el backend (asignarRol) ni el SQL
-- Editor podian asignar el primer admin.

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        return new;
    end if;

    if new.rol is distinct from old.rol
       and public.current_user_role() is distinct from 'admin' then
        raise exception 'No tienes permiso para cambiar roles';
    end if;

    if new.activo is distinct from old.activo
       and public.current_user_role() is distinct from 'admin' then
        raise exception 'No tienes permiso para cambiar el estado del usuario';
    end if;

    return new;
end;
$$;

create trigger perfiles_protect_role
before update on public.perfiles
for each row execute function public.protect_profile_role();

-- ------------------------------------------------------------
-- 2. PORTAL DE ACCESOS PARA CLIENTES
-- ------------------------------------------------------------

create table public.portal_accesos (
    id uuid primary key default gen_random_uuid(),

    proyecto_id uuid not null
        references public.proyectos(id)
        on delete cascade,

    -- SHA-256 hexadecimal del token.
    -- Nunca guardar el token original.
    token_hash text not null unique,

    -- Permisos limitados del portal.
    -- No permiten acceder a tablas internas directamente.
    permisos jsonb not null default
        '{"ver_progreso": true, "ver_documentos_autorizados": true, "subir_documentos": false}'::jsonb,

    activo boolean not null default true,

    expira_at timestamptz not null,

    revocado_at timestamptz,
    revocado_por uuid
        references auth.users(id)
        on delete set null,

    ultimo_uso_at timestamptz,

    created_by uuid
        references auth.users(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint portal_token_hash_chk
        check (token_hash ~ '^[a-f0-9]{64}$'),

    constraint portal_permisos_objeto_chk
        check (jsonb_typeof(permisos) = 'object'),

    constraint portal_expiracion_chk
        check (expira_at > created_at)
);

create index portal_accesos_proyecto_idx
    on public.portal_accesos (proyecto_id);

create index portal_accesos_activo_expira_idx
    on public.portal_accesos (activo, expira_at);

-- La tabla queda cerrada a usuarios autenticados.
-- Solo el backend con service_role puede gestionar accesos.
alter table public.portal_accesos enable row level security;

-- ------------------------------------------------------------
-- 3. AUDITORIA APPEND-ONLY
-- ------------------------------------------------------------

create table public.auditoria_eventos (
    id uuid primary key default gen_random_uuid(),

    -- Usuario interno, si el evento procede de una persona.
    -- CORRECCION KV: sin FK a auth.users. Con "on delete set null" borrar un
    -- usuario hace un UPDATE interno sobre esta tabla, y el trigger
    -- append-only lo rechaza: no se podria borrar ningun usuario con eventos.
    -- En una bitacora el id del actor se conserva tal cual.
    actor_user_id uuid,

    -- app, zoho, system, storage, portal.
    origen text not null,

    -- Tipo de entidad afectada.
    entidad text not null,

    -- UUID de la entidad afectada, si aplica.
    entidad_id uuid,

    -- Folio de referencia, sin duplicar el proyecto.
    folio text,

    accion text not null,

    -- Datos contextuales, sin secretos ni tokens.
    detalles jsonb not null default '{}'::jsonb,

    -- Identificador externo para deduplicar eventos de Zoho.
    external_event_id text,

    created_at timestamptz not null default now(),

    constraint auditoria_origen_chk
        check (
            origen in (
                'app',
                'zoho',
                'system',
                'storage',
                'portal'
            )
        ),

    constraint auditoria_entidad_chk
        check (length(trim(entidad)) > 0),

    constraint auditoria_accion_chk
        check (length(trim(accion)) > 0),

    constraint auditoria_detalles_objeto_chk
        check (jsonb_typeof(detalles) = 'object')
);

create unique index auditoria_external_event_unique
    on public.auditoria_eventos (origen, external_event_id)
    where external_event_id is not null;

create index auditoria_folio_idx
    on public.auditoria_eventos (folio, created_at desc);

create index auditoria_entidad_idx
    on public.auditoria_eventos (entidad, entidad_id, created_at desc);

create index auditoria_actor_idx
    on public.auditoria_eventos (actor_user_id, created_at desc);

-- Bloqueo de UPDATE y DELETE.
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'La auditoria es append-only: no se permite UPDATE ni DELETE';
end;
$$;

create trigger auditoria_no_update
before update on public.auditoria_eventos
for each row execute function public.prevent_audit_mutation();

create trigger auditoria_no_delete
before delete on public.auditoria_eventos
for each row execute function public.prevent_audit_mutation();

-- ------------------------------------------------------------
-- 4. FUNCION SEGURA PARA REGISTRAR EVENTOS DESDE LA APP
-- ------------------------------------------------------------

-- El usuario no puede elegir el actor ni el origen.
-- El actor se obtiene de auth.uid() y el origen es app.

create or replace function public.registrar_evento_auditoria(
    p_entidad text,
    p_entidad_id uuid,
    p_folio text,
    p_accion text,
    p_detalles jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_evento_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Se requiere autenticacion';
    end if;

    if not public.is_active_staff() then
        raise exception 'Usuario sin perfil activo';
    end if;

    if p_entidad is null or length(trim(p_entidad)) = 0 then
        raise exception 'La entidad es obligatoria';
    end if;

    if p_accion is null or length(trim(p_accion)) = 0 then
        raise exception 'La accion es obligatoria';
    end if;

    if p_detalles is null
       or jsonb_typeof(p_detalles) <> 'object' then
        raise exception 'Los detalles deben ser un objeto JSON';
    end if;

    insert into public.auditoria_eventos (
        actor_user_id,
        origen,
        entidad,
        entidad_id,
        folio,
        accion,
        detalles
    )
    values (
        auth.uid(),
        'app',
        p_entidad,
        p_entidad_id,
        p_folio,
        p_accion,
        p_detalles
    )
    returning id into v_evento_id;

    return v_evento_id;
end;
$$;

-- El backend Zoho puede insertar directamente usando
-- service_role y asignando origen = 'zoho'.
-- external_event_id sirve para evitar duplicados.

-- ------------------------------------------------------------
-- 5. RLS EN TODAS LAS TABLAS PUBLICAS
-- ------------------------------------------------------------

alter table public.proyectos enable row level security;
alter table public.sistemas_fotovoltaicos enable row level security;
alter table public.documentos enable row level security;
alter table public.documento_datos_declarados enable row level security;
alter table public.requisitos_documentales enable row level security;
alter table public.resoluciones_documentales enable row level security;
alter table public.aprobaciones_checklist_g2 enable row level security;
alter table public.acuerdos_paer enable row level security;
alter table public.perfiles enable row level security;
alter table public.portal_accesos enable row level security;
alter table public.auditoria_eventos enable row level security;

-- ------------------------------------------------------------
-- 6. POLITICAS: PROYECTOS MINIMOS
-- ------------------------------------------------------------

create policy proyectos_select_staff
on public.proyectos
for select
to authenticated
using (public.is_active_staff());

create policy proyectos_insert_admin_coord
on public.proyectos
for insert
to authenticated
with check (
    public.has_any_role(array['admin', 'coordinacion_admin'])
);

create policy proyectos_update_admin_coord
on public.proyectos
for update
to authenticated
using (
    public.has_any_role(array['admin', 'coordinacion_admin'])
)
with check (
    public.has_any_role(array['admin', 'coordinacion_admin'])
);

create policy proyectos_delete_admin
on public.proyectos
for delete
to authenticated
using (
    public.has_any_role(array['admin'])
);

-- ------------------------------------------------------------
-- 7. POLITICAS: SISTEMAS FOTOVOLTAICOS
-- ------------------------------------------------------------

create policy sistemas_select_staff
on public.sistemas_fotovoltaicos
for select
to authenticated
using (public.is_active_staff());

create policy sistemas_insert_tecnico
on public.sistemas_fotovoltaicos
for insert
to authenticated
with check (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
);

create policy sistemas_update_tecnico
on public.sistemas_fotovoltaicos
for update
to authenticated
using (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
)
with check (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
);

create policy sistemas_delete_admin
on public.sistemas_fotovoltaicos
for delete
to authenticated
using (public.has_any_role(array['admin']));

-- ------------------------------------------------------------
-- 8. POLITICAS: DOCUMENTOS
-- ------------------------------------------------------------

create policy documentos_select_staff
on public.documentos
for select
to authenticated
using (public.is_active_staff());

create policy documentos_insert_staff_editor
on public.documentos
for insert
to authenticated
with check (
    public.has_any_role(
        array[
            'admin',
            'coordinacion_admin',
            'proyectista',
            'supervisor_campo'
        ]
    )
);

create policy documentos_update_editor
on public.documentos
for update
to authenticated
using (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
)
with check (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
);

create policy documentos_delete_admin
on public.documentos
for delete
to authenticated
using (public.has_any_role(array['admin']));

-- ------------------------------------------------------------
-- 9. POLITICAS: DATOS DECLARADOS
-- ------------------------------------------------------------

create policy datos_declarados_select_staff
on public.documento_datos_declarados
for select
to authenticated
using (public.is_active_staff());

create policy datos_declarados_insert_editor
on public.documento_datos_declarados
for insert
to authenticated
with check (
    public.has_any_role(
        array[
            'admin',
            'coordinacion_admin',
            'proyectista',
            'supervisor_campo'
        ]
    )
);

create policy datos_declarados_update_editor
on public.documento_datos_declarados
for update
to authenticated
using (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
)
with check (
    public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
);

create policy datos_declarados_delete_admin
on public.documento_datos_declarados
for delete
to authenticated
using (public.has_any_role(array['admin']));

-- ------------------------------------------------------------
-- 10. POLITICAS: CATALOGO DOCUMENTAL
-- ------------------------------------------------------------

create policy requisitos_select_staff
on public.requisitos_documentales
for select
to authenticated
using (public.is_active_staff());

create policy requisitos_insert_admin_coord
on public.requisitos_documentales
for insert
to authenticated
with check (
    public.has_any_role(array['admin', 'coordinacion_admin'])
);

create policy requisitos_update_admin_coord
on public.requisitos_documentales
for update
to authenticated
using (
    public.has_any_role(array['admin', 'coordinacion_admin'])
)
with check (
    public.has_any_role(array['admin', 'coordinacion_admin'])
);

create policy requisitos_delete_admin
on public.requisitos_documentales
for delete
to authenticated
using (public.has_any_role(array['admin']));

-- ------------------------------------------------------------
-- 11. POLITICAS: RESOLUCIONES DOCUMENTALES
-- ------------------------------------------------------------

create policy resoluciones_select_staff
on public.resoluciones_documentales
for select
to authenticated
using (public.is_active_staff());

create policy resoluciones_insert_responsables
on public.resoluciones_documentales
for insert
to authenticated
with check (
    resuelto_por = auth.uid()
    and public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
);

-- No se permite UPDATE ni DELETE:
-- una decision nueva se registra como una nueva resolucion.

-- ------------------------------------------------------------
-- 12. POLITICAS: APROBACIONES CHECKLIST G2
-- ------------------------------------------------------------

create policy g2_select_staff
on public.aprobaciones_checklist_g2
for select
to authenticated
using (public.is_active_staff());

create policy g2_insert_responsables
on public.aprobaciones_checklist_g2
for insert
to authenticated
with check (
    aprobado_por = auth.uid()
    and public.has_any_role(
        array['admin', 'coordinacion_admin', 'proyectista']
    )
);

-- Sin UPDATE ni DELETE: las aprobaciones son historicas.

-- ------------------------------------------------------------
-- 13. POLITICAS: ACUERDOS PAER
-- ------------------------------------------------------------

create policy paer_select_staff
on public.acuerdos_paer
for select
to authenticated
using (public.is_active_staff());

create policy paer_insert_coord
on public.acuerdos_paer
for insert
to authenticated
with check (
    registrado_por = auth.uid()
    and public.has_any_role(
        array['admin', 'coordinacion_admin']
    )
);

create policy paer_update_coord
on public.acuerdos_paer
for update
to authenticated
using (
    public.has_any_role(
        array['admin', 'coordinacion_admin']
    )
)
with check (
    public.has_any_role(
        array['admin', 'coordinacion_admin']
    )
);

create policy paer_delete_admin
on public.acuerdos_paer
for delete
to authenticated
using (public.has_any_role(array['admin']));

-- ------------------------------------------------------------
-- 14. POLITICAS: PERFILES
-- ------------------------------------------------------------

create policy perfiles_select_self_or_admin
on public.perfiles
for select
to authenticated
using (
    id = auth.uid()
    or public.has_any_role(
        array['admin', 'coordinacion_admin']
    )
);

create policy perfiles_insert_admin
on public.perfiles
for insert
to authenticated
with check (
    public.has_any_role(array['admin'])
);

create policy perfiles_update_admin
on public.perfiles
for update
to authenticated
using (
    public.has_any_role(array['admin'])
)
with check (
    public.has_any_role(array['admin'])
);

create policy perfiles_delete_admin
on public.perfiles
for delete
to authenticated
using (
    public.has_any_role(array['admin'])
);

-- ------------------------------------------------------------
-- 15. POLITICAS: PORTAL Y AUDITORIA
-- ------------------------------------------------------------

-- portal_accesos:
-- No se crea ninguna politica para authenticated o anon.
-- El backend autorizado gestiona esta tabla con service_role.

-- auditoria_eventos:
create policy auditoria_select_admin_coord
on public.auditoria_eventos
for select
to authenticated
using (
    public.has_any_role(
        array['admin', 'coordinacion_admin']
    )
);

-- No se crea politica INSERT directa para authenticated.
-- La aplicacion utiliza registrar_evento_auditoria().
-- Zoho utiliza el backend con service_role.
-- No hay politicas UPDATE ni DELETE.

-- ------------------------------------------------------------
-- 16. PERMISOS DE EJECUCION DE FUNCIONES
-- ------------------------------------------------------------

revoke all on function public.current_user_role() from public;
revoke all on function public.has_any_role(text[]) from public;
revoke all on function public.is_active_staff() from public;

grant execute on function public.current_user_role()
to authenticated;

grant execute on function public.has_any_role(text[])
to authenticated;

grant execute on function public.is_active_staff()
to authenticated;

revoke all on function public.registrar_evento_auditoria(
    text, uuid, text, text, jsonb
) from public;

grant execute on function public.registrar_evento_auditoria(
    text, uuid, text, text, jsonb
) to authenticated;

commit;
