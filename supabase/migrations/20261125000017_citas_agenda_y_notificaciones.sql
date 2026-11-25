-- ============================================================
-- KAIROVOLT | MIGRACION 017
-- Agenda configurable de IDC, citas de visita con exclusión real
-- de traslapes, historial de cambios y notificaciones de correo.
-- Dependencias: 001–016 (especialmente 008 seguridad, 013 eventos, 014 cola de correo, 016 visita).
-- ============================================================

begin;

-- Necesaria para la restricción de exclusión de rangos de tiempo (prevención real de doble reserva).
create extension if not exists btree_gist;

-- 1. Configuración de agenda de IDC (por defecto NO publica disponibilidad real hasta que IDC la configure).
create table if not exists public.portal_agenda_config (
    id integer primary key default 1 check (id = 1),
    zona_horaria text not null default 'America/Hermosillo',
    dias_laborables integer[] not null default '{1,2,3,4,5}',
    horarios_inicio text[] not null default '{09:00,10:00,11:00,12:00,15:00,16:00}',
    dias_no_laborables date[] not null default '{}',
    duracion_minutos integer not null default 45 check (duracion_minutos between 15 and 240),
    ubicacion_autorizada text check (ubicacion_autorizada is null or length(ubicacion_autorizada) <= 240),
    tipos_habilitados text[] not null default '{entrega_expediente}',
    horas_anticipacion_cancelacion integer not null default 2 check (horas_anticipacion_cancelacion between 0 and 168),
    disponibilidad_publicada boolean not null default false,
    proveedor text not null default 'manual_supabase' check (proveedor in ('manual_supabase', 'zoho_pendiente')),
    actualizado_en timestamptz not null default now(),
    actualizado_por uuid references auth.users(id) on delete set null
);

insert into public.portal_agenda_config(id) values (1) on conflict (id) do nothing;

alter table public.portal_agenda_config enable row level security;
revoke all on public.portal_agenda_config from public, anon, authenticated, service_role;
grant select on public.portal_agenda_config to service_role, authenticated;

create policy portal_agenda_config_select_staff on public.portal_agenda_config
    for select to authenticated using (public.is_active_staff());

-- 2. Solicitudes y citas de visita del portal (con prevención real de traslapes e idempotencia).
create table if not exists public.portal_citas (
    id uuid primary key default gen_random_uuid(),
    referencia text not null unique check (referencia ~ '^CITA-[0-9A-F]{8}$'),
    proyecto_id uuid not null references public.proyectos(id),
    folio text not null references public.proyectos(folio),
    acceso_id uuid references public.portal_accesos(id) on delete set null,
    tipo_visita text not null check (tipo_visita in ('entrega_expediente', 'firma_documentos', 'visita_tecnica', 'aclaracion_documental')),
    estado text not null default 'solicitada' check (estado in (
        'solicitada', 'pendiente_confirmacion', 'confirmada',
        'cambio_solicitado', 'reprogramada', 'cancelada', 'realizada'
    )),
    inicio_en timestamptz not null,
    fin_en timestamptz not null,
    zona_horaria text not null default 'America/Hermosillo',
    duracion_minutos integer not null check (duracion_minutos between 15 and 240),
    ubicacion_autorizada text check (ubicacion_autorizada is null or length(ubicacion_autorizada) <= 240),
    notas_cliente text check (notas_cliente is null or length(notas_cliente) <= 500),
    motivo_cancelacion text check (motivo_cancelacion is null or length(motivo_cancelacion) <= 500),
    propuesta_inicio_en timestamptz,
    propuesta_fin_en timestamptz,
    propuesta_por text check (propuesta_por is null or propuesta_por in ('cliente', 'idc')),
    propuesta_nota text check (propuesta_nota is null or length(propuesta_nota) <= 500),
    proveedor_externo text default 'manual_supabase',
    referencia_externa_id text,
    idempotency_key text unique,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    confirmado_en timestamptz,
    confirmado_por uuid references auth.users(id) on delete set null,
    realizada_en timestamptz,
    realizada_por uuid references auth.users(id) on delete set null,
    constraint portal_citas_rango_valido_chk check (fin_en > inicio_en),
    constraint portal_citas_propuesta_valida_chk check (
        (propuesta_inicio_en is null and propuesta_fin_en is null)
        or (propuesta_inicio_en is not null and propuesta_fin_en is not null and propuesta_fin_en > propuesta_inicio_en)
    ),
    -- Garantía a nivel de PostgreSQL: dos citas activas jamás pueden traslaparse en el mismo horario.
    constraint portal_citas_sin_traslape exclude using gist (
        tstzrange(inicio_en, fin_en, '[)') with &&
    ) where (estado in ('solicitada', 'pendiente_confirmacion', 'confirmada', 'cambio_solicitado', 'reprogramada'))
);

create unique index if not exists portal_citas_activa_proyecto_tipo_idx
    on public.portal_citas(proyecto_id, tipo_visita)
    where estado in ('solicitada', 'pendiente_confirmacion', 'confirmada', 'cambio_solicitado', 'reprogramada');

create index if not exists portal_citas_folio_estado_idx
    on public.portal_citas(folio, estado, inicio_en desc);

create index if not exists portal_citas_agenda_rango_idx
    on public.portal_citas(inicio_en, estado);

alter table public.portal_citas enable row level security;
revoke all on public.portal_citas from public, anon, authenticated, service_role;
grant select on public.portal_citas to service_role, authenticated;

create policy portal_citas_select_staff on public.portal_citas
    for select to authenticated using (public.is_active_staff());

-- 3. Historial append-only de cambios de cada cita.
create table if not exists public.portal_citas_historial (
    id uuid primary key default gen_random_uuid(),
    cita_id uuid not null references public.portal_citas(id) on delete cascade,
    folio text not null references public.proyectos(folio),
    estado_anterior text,
    estado_nuevo text not null,
    actor_tipo text not null check (actor_tipo in ('cliente', 'idc', 'sistema')),
    actor_user_id uuid references auth.users(id) on delete set null,
    detalle text,
    creado_en timestamptz not null default now()
);

create index if not exists portal_citas_historial_cita_idx
    on public.portal_citas_historial(cita_id, creado_en asc);

alter table public.portal_citas_historial enable row level security;
revoke all on public.portal_citas_historial from public, anon, authenticated, service_role;
grant select on public.portal_citas_historial to service_role, authenticated;

create policy portal_citas_historial_select_staff on public.portal_citas_historial
    for select to authenticated using (public.is_active_staff());

-- 4. Extiende el encolador de correo existente (migración 014) para incluir eventos de citas.
create or replace function public.encolar_aviso_documental() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if new.tipo in (
        'recibido', 'prevalidado', 'rechazado', 'entregado', 'validado_fisico', 'aceptado',
        'cita_solicitada', 'cita_confirmada', 'cita_propuesta_horario',
        'cita_reprogramada', 'cita_cancelada', 'cita_recordatorio'
    ) then
        insert into public.portal_cola_correo(folio, contacto_version, evento_id)
        select c.folio, c.version, new.id
        from public.portal_contactos_aviso c
        where c.folio = new.folio and c.verificado_en is not null
        on conflict (evento_id) do nothing;
    end if;
    return new;
end;
$$;
revoke all on function public.encolar_aviso_documental() from public, anon, authenticated, service_role;

-- 5. RPC para configurar la agenda de IDC (solo invocada por backend tras validar rol).
create or replace function public.configurar_agenda_idc(p_datos jsonb, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.portal_agenda_config
    set dias_laborables = coalesce(
            (select array_agg(x::integer) from jsonb_array_elements_text(p_datos->'diasLaborables') x),
            dias_laborables
        ),
        horarios_inicio = coalesce(
            (select array_agg(x) from jsonb_array_elements_text(p_datos->'horariosInicio') x),
            horarios_inicio
        ),
        dias_no_laborables = coalesce(
            (select array_agg(x::date) from jsonb_array_elements_text(p_datos->'diasNoLaborables') x),
            dias_no_laborables
        ),
        duracion_minutos = coalesce((p_datos->>'duracionMinutos')::integer, duracion_minutos),
        ubicacion_autorizada = case when p_datos ? 'ubicacionAutorizada' then nullif(trim(p_datos->>'ubicacionAutorizada'), '') else ubicacion_autorizada end,
        tipos_habilitados = coalesce(
            (select array_agg(x) from jsonb_array_elements_text(p_datos->'tiposHabilitados') x),
            tipos_habilitados
        ),
        disponibilidad_publicada = coalesce((p_datos->>'disponibilidadPublicada')::boolean, disponibilidad_publicada),
        actualizado_en = now(),
        actualizado_por = p_actor
    where id = 1;

    insert into public.auditoria_eventos(actor_user_id, origen, entidad, accion, detalles)
    values (p_actor, 'app', 'portal_agenda_config', 'agenda_configurada', coalesce(p_datos, '{}'::jsonb));

    return true;
end;
$$;

-- 6. RPC transaccional para solicitar cita desde el portal (idempotente y a prueba de concurrencia).
create or replace function public.solicitar_cita_portal(
    p_acceso uuid,
    p_folio text,
    p_tipo text,
    p_inicio timestamptz,
    p_fin timestamptz,
    p_duracion integer,
    p_notas text,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_folio text := upper(trim(p_folio));
    v_proyecto uuid;
    v_cfg public.portal_agenda_config;
    v_existente uuid;
    v_cita public.portal_citas;
    v_ref text;
begin
    select p.id into v_proyecto
    from public.portal_accesos a
    join public.proyectos p on p.id = a.proyecto_id
    where a.id = p_acceso
      and p.folio = v_folio
      and not p.es_demo
      and a.activo
      and a.revocado_at is null
      and a.expira_at > now()
      and a.permisos @> '{"ver_documentos_autorizados":true}'::jsonb
    for update of p, a;

    if not found then
        raise exception using errcode = '42501', message = 'Acceso no autorizado';
    end if;

    -- Idempotencia ante reintentos de la misma solicitud
    if nullif(trim(p_idempotency_key), '') is not null then
        select id into v_existente
        from public.portal_citas
        where idempotency_key = trim(p_idempotency_key) and proyecto_id = v_proyecto;
        if found then
            return jsonb_build_object('id', v_existente, 'duplicada', true);
        end if;
    end if;

    select * into v_cfg from public.portal_agenda_config where id = 1;
    if not v_cfg.disponibilidad_publicada then
        raise exception using errcode = '40001', message = 'La disponibilidad de citas aún no está publicada por IDC';
    end if;
    if not (p_tipo = any(v_cfg.tipos_habilitados)) then
        raise exception using errcode = '22023', message = 'Tipo de visita no habilitado';
    end if;
    if p_inicio <= now() or p_fin <= p_inicio then
        raise exception using errcode = '22023', message = 'Horario inválido o pasado';
    end if;

    v_ref := 'CITA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.portal_citas(
        referencia, proyecto_id, folio, acceso_id, tipo_visita, estado,
        inicio_en, fin_en, zona_horaria, duracion_minutos, ubicacion_autorizada,
        notas_cliente, proveedor_externo, idempotency_key
    ) values (
        v_ref, v_proyecto, v_folio, p_acceso, p_tipo, 'solicitada',
        p_inicio, p_fin, v_cfg.zona_horaria, p_duracion, v_cfg.ubicacion_autorizada,
        nullif(trim(p_notas), ''), v_cfg.proveedor, nullif(trim(p_idempotency_key), '')
    ) returning * into v_cita;

    insert into public.portal_citas_historial(cita_id, folio, estado_anterior, estado_nuevo, actor_tipo, detalle)
    values (v_cita.id, v_folio, null, 'solicitada', 'cliente', 'Solicitud de cita registrada desde el portal.');

    insert into public.portal_eventos_documentales(folio, clave, tipo, documento)
    values (v_folio, 'cita:' || v_cita.id::text || ':solicitada', 'cita_solicitada', v_cita.referencia)
    on conflict (clave) do nothing;

    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'portal_cita', v_cita.id, v_folio, 'cita_solicitada',
        jsonb_build_object('referencia', v_cita.referencia, 'tipo', p_tipo, 'inicio', p_inicio));

    return jsonb_build_object('id', v_cita.id, 'duplicada', false);
end;
$$;

-- 7. RPC para acciones del cliente sobre su propia cita (solicitar cambio, aceptar propuesta, cancelar).
--    Nunca permite confirmar una cita en nombre de IDC ni alterar directamente una cita confirmada.
create or replace function public.accion_cita_cliente(
    p_folio text,
    p_cita_id uuid,
    p_accion text,
    p_nuevo_inicio timestamptz,
    p_motivo text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_folio text := upper(trim(p_folio));
    v_cita public.portal_citas;
    v_cfg public.portal_agenda_config;
    v_evento text;
begin
    select * into v_cita from public.portal_citas
    where id = p_cita_id and folio = v_folio
    for update;
    if not found then
        raise exception using errcode = '40001', message = 'Cita no encontrada';
    end if;
    if v_cita.estado in ('cancelada', 'realizada') then
        raise exception using errcode = '40001', message = 'La cita ya cerró y no admite cambios';
    end if;

    select * into v_cfg from public.portal_agenda_config where id = 1;

    if p_accion = 'cancelar' then
        if v_cita.inicio_en <= now()
           or (v_cita.estado = 'confirmada' and v_cita.inicio_en - now() < make_interval(hours => v_cfg.horas_anticipacion_cancelacion)) then
            raise exception using errcode = '40001', message = 'Fuera de ventana permitida para cancelar';
        end if;
        update public.portal_citas
        set estado = 'cancelada',
            motivo_cancelacion = coalesce(nullif(trim(p_motivo), ''), 'Cancelada por el cliente desde el portal.'),
            propuesta_inicio_en = null, propuesta_fin_en = null, propuesta_por = null, propuesta_nota = null,
            actualizado_en = now()
        where id = v_cita.id;
        v_evento := 'cita_cancelada';

    elsif p_accion = 'aceptar_propuesta' then
        if v_cita.estado <> 'cambio_solicitado' or v_cita.propuesta_por <> 'idc' or v_cita.propuesta_inicio_en is null then
            raise exception using errcode = '40001', message = 'No existe una propuesta de IDC pendiente';
        end if;
        update public.portal_citas
        set estado = 'reprogramada',
            inicio_en = v_cita.propuesta_inicio_en,
            fin_en = v_cita.propuesta_fin_en,
            propuesta_inicio_en = null, propuesta_fin_en = null, propuesta_por = null, propuesta_nota = null,
            actualizado_en = now()
        where id = v_cita.id;
        v_evento := 'cita_reprogramada';

    elsif p_accion = 'solicitar_cambio' then
        if p_nuevo_inicio is null or p_nuevo_inicio <= now() then
            raise exception using errcode = '22023', message = 'Indica un nuevo horario futuro válido';
        end if;
        update public.portal_citas
        set estado = 'cambio_solicitado',
            propuesta_inicio_en = p_nuevo_inicio,
            propuesta_fin_en = p_nuevo_inicio + make_interval(mins => v_cita.duracion_minutos),
            propuesta_por = 'cliente',
            propuesta_nota = nullif(trim(p_motivo), ''),
            actualizado_en = now()
        where id = v_cita.id;
        v_evento := 'cita_solicitada';
    else
        raise exception using errcode = '22023', message = 'Acción de cliente inválida';
    end if;

    insert into public.portal_citas_historial(cita_id, folio, estado_anterior, estado_nuevo, actor_tipo, detalle)
    values (v_cita.id, v_folio, v_cita.estado,
        case when p_accion = 'cancelar' then 'cancelada' when p_accion = 'aceptar_propuesta' then 'reprogramada' else 'cambio_solicitado' end,
        'cliente', nullif(trim(p_motivo), ''));

    insert into public.portal_eventos_documentales(folio, clave, tipo, documento)
    values (v_folio, 'cita:' || v_cita.id::text || ':' || v_evento || ':' || extract(epoch from clock_timestamp())::text, v_evento, v_cita.referencia)
    on conflict (clave) do nothing;

    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'portal_cita', v_cita.id, v_folio, 'cita_' || p_accion, jsonb_build_object('referencia', v_cita.referencia));

    return true;
end;
$$;

-- 8. RPC para gestión administrativa por IDC (confirmar, proponer horario, reprogramar, cancelar, realizada).
--    Registrar «realizada» NUNCA marca automáticamente documentos en portal_entregas_fisicas.
create or replace function public.gestionar_cita_idc(
    p_cita_id uuid,
    p_actor uuid,
    p_accion text,
    p_nuevo_inicio timestamptz,
    p_motivo text,
    p_ubicacion text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_cita public.portal_citas;
    v_nuevo_estado text;
    v_evento text;
begin
    select * into v_cita from public.portal_citas where id = p_cita_id for update;
    if not found then
        raise exception using errcode = '40001', message = 'Cita no encontrada';
    end if;
    if v_cita.estado in ('cancelada', 'realizada') then
        raise exception using errcode = '40001', message = 'La cita ya está cerrada';
    end if;

    if p_accion = 'confirmar' then
        if v_cita.estado = 'cambio_solicitado' and v_cita.propuesta_por = 'cliente' and v_cita.propuesta_inicio_en is not null then
            v_nuevo_estado := 'reprogramada';
            v_evento := 'cita_reprogramada';
            update public.portal_citas
            set estado = 'reprogramada',
                inicio_en = v_cita.propuesta_inicio_en,
                fin_en = v_cita.propuesta_fin_en,
                ubicacion_autorizada = coalesce(nullif(trim(p_ubicacion), ''), ubicacion_autorizada),
                propuesta_inicio_en = null, propuesta_fin_en = null, propuesta_por = null, propuesta_nota = null,
                confirmado_en = now(), confirmado_por = p_actor, actualizado_en = now()
            where id = v_cita.id;
        else
            v_nuevo_estado := 'confirmada';
            v_evento := 'cita_confirmada';
            update public.portal_citas
            set estado = 'confirmada',
                ubicacion_autorizada = coalesce(nullif(trim(p_ubicacion), ''), ubicacion_autorizada),
                propuesta_inicio_en = null, propuesta_fin_en = null, propuesta_por = null, propuesta_nota = null,
                confirmado_en = now(), confirmado_por = p_actor, actualizado_en = now()
            where id = v_cita.id;
        end if;

    elsif p_accion = 'proponer_horario' then
        if p_nuevo_inicio is null or p_nuevo_inicio <= now() then
            raise exception using errcode = '22023', message = 'Indica un horario futuro válido';
        end if;
        v_nuevo_estado := 'cambio_solicitado';
        v_evento := 'cita_propuesta_horario';
        update public.portal_citas
        set estado = 'cambio_solicitado',
            propuesta_inicio_en = p_nuevo_inicio,
            propuesta_fin_en = p_nuevo_inicio + make_interval(mins => v_cita.duracion_minutos),
            propuesta_por = 'idc',
            propuesta_nota = coalesce(nullif(trim(p_motivo), ''), 'IDC propone este horario alternativo.'),
            actualizado_en = now()
        where id = v_cita.id;

    elsif p_accion = 'reprogramar' then
        if p_nuevo_inicio is null or p_nuevo_inicio <= now() then
            raise exception using errcode = '22023', message = 'Indica un horario futuro válido';
        end if;
        v_nuevo_estado := 'reprogramada';
        v_evento := 'cita_reprogramada';
        update public.portal_citas
        set estado = 'reprogramada',
            inicio_en = p_nuevo_inicio,
            fin_en = p_nuevo_inicio + make_interval(mins => v_cita.duracion_minutos),
            propuesta_inicio_en = null, propuesta_fin_en = null, propuesta_por = null, propuesta_nota = null,
            actualizado_en = now()
        where id = v_cita.id;

    elsif p_accion = 'cancelar' then
        if nullif(trim(p_motivo), '') is null then
            raise exception using errcode = '22023', message = 'Indica el motivo de cancelación';
        end if;
        v_nuevo_estado := 'cancelada';
        v_evento := 'cita_cancelada';
        update public.portal_citas
        set estado = 'cancelada',
            motivo_cancelacion = trim(p_motivo),
            propuesta_inicio_en = null, propuesta_fin_en = null, propuesta_por = null, propuesta_nota = null,
            actualizado_en = now()
        where id = v_cita.id;

    elsif p_accion = 'realizada' then
        if v_cita.estado not in ('confirmada', 'reprogramada') then
            raise exception using errcode = '40001', message = 'Solo una cita confirmada o reprogramada puede marcarse como realizada';
        end if;
        v_nuevo_estado := 'realizada';
        v_evento := null;
        update public.portal_citas
        set estado = 'realizada', realizada_en = now(), realizada_por = p_actor, actualizado_en = now()
        where id = v_cita.id;
    else
        raise exception using errcode = '22023', message = 'Acción de IDC inválida';
    end if;

    insert into public.portal_citas_historial(cita_id, folio, estado_anterior, estado_nuevo, actor_tipo, actor_user_id, detalle)
    values (v_cita.id, v_cita.folio, v_cita.estado, v_nuevo_estado, 'idc', p_actor, nullif(trim(p_motivo), ''));

    if v_evento is not null then
        insert into public.portal_eventos_documentales(folio, clave, tipo, documento)
        values (v_cita.folio, 'cita:' || v_cita.id::text || ':' || v_evento || ':' || extract(epoch from clock_timestamp())::text, v_evento, v_cita.referencia)
        on conflict (clave) do nothing;
    end if;

    insert into public.auditoria_eventos(actor_user_id, origen, entidad, entidad_id, folio, accion, detalles)
    values (p_actor, 'app', 'portal_cita', v_cita.id, v_cita.folio, 'cita_idc_' || p_accion,
        jsonb_build_object('referencia', v_cita.referencia, 'estadoNuevo', v_nuevo_estado));

    return true;
end;
$$;

revoke all on function
    public.configurar_agenda_idc(jsonb, uuid),
    public.solicitar_cita_portal(uuid, text, text, timestamptz, timestamptz, integer, text, text),
    public.accion_cita_cliente(text, uuid, text, timestamptz, text),
    public.gestionar_cita_idc(uuid, uuid, text, timestamptz, text, text)
from public, anon, authenticated;

grant execute on function
    public.configurar_agenda_idc(jsonb, uuid),
    public.solicitar_cita_portal(uuid, text, text, timestamptz, timestamptz, integer, text, text),
    public.accion_cita_cliente(text, uuid, text, timestamptz, text),
    public.gestionar_cita_idc(uuid, uuid, text, timestamptz, text, text)
to service_role;

commit;
