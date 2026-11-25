-- ============================================================
-- KAIROVOLT | MIGRACION 016
-- Separación conceptual de emisor vs aportación documental,
-- categorías visuales del portal y checklist de preparación de visita.
-- Dependencias: 001–015 (incluye 008 de seguridad y 009–012 de catálogo/preparación).
-- ============================================================

begin;

-- 1. Extiende el catálogo canónico sin duplicar ni borrar requisitos existentes.
alter table public.requisitos_documentales
    add column if not exists categoria_portal text not null default 'identificacion_datos',
    add column if not exists emisor_documento text not null default 'pendiente',
    add column if not exists permite_multiples_archivos boolean not null default false,
    add column if not exists requiere_entrega_fisica text not null default 'por_confirmar';

do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'requisitos_categoria_portal_chk') then
        alter table public.requisitos_documentales add constraint requisitos_categoria_portal_chk check (
            categoria_portal in (
                'identificacion_datos',
                'servicio_electrico',
                'ubicacion_instalacion',
                'documentacion_tecnica',
                'solicitudes_verificaciones'
            )
        );
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_emisor_documento_chk') then
        alter table public.requisitos_documentales add constraint requisitos_emisor_documento_chk check (
            emisor_documento in (
                'cliente', 'cfe', 'sat', 'especialista', 'fabricante',
                'instalador', 'idc', 'uvie', 'tercero', 'pendiente'
            )
        );
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_entrega_fisica_chk') then
        alter table public.requisitos_documentales add constraint requisitos_entrega_fisica_chk check (
            requiere_entrega_fisica in ('si', 'no', 'por_confirmar')
        );
    end if;
end $$;

-- 2. Actualiza clasificación visual y emisor para los 11 requisitos de referencia
--    y el requisito condicional acta_constitutiva, únicamente mientras siguen pendientes de validación IDC.
update public.requisitos_documentales r set
    categoria_portal = m.categoria_portal,
    emisor_documento = m.emisor_documento,
    permite_multiples_archivos = m.permite_multiples,
    requiere_entrega_fisica = m.entrega_fisica
from (values
    ('recibo_cfe', 'servicio_electrico', 'cfe', false, 'por_confirmar'),
    ('identificacion_oficial', 'identificacion_datos', 'cliente', false, 'por_confirmar'),
    ('constancia_situacion_fiscal', 'identificacion_datos', 'sat', false, 'por_confirmar'),
    ('carta_poder', 'identificacion_datos', 'cliente', false, 'si'),
    ('acta_constitutiva', 'identificacion_datos', 'cliente', false, 'por_confirmar'),
    ('croquis', 'ubicacion_instalacion', 'cliente', false, 'por_confirmar'),
    ('diagrama_unifilar', 'documentacion_tecnica', 'especialista', false, 'por_confirmar'),
    ('ficha_tecnica', 'documentacion_tecnica', 'fabricante', false, 'no'),
    ('certificado', 'documentacion_tecnica', 'fabricante', false, 'no'),
    ('solicitud', 'solicitudes_verificaciones', 'idc', false, 'si'),
    ('evidencia_fotografica', 'ubicacion_instalacion', 'instalador', true, 'no'),
    ('dictamen_uvie', 'solicitudes_verificaciones', 'uvie', false, 'si')
) as m(tipo_documento, categoria_portal, emisor_documento, permite_multiples, entrega_fisica)
where r.tipo_documento = m.tipo_documento
  and r.validacion_idc = 'pendiente';

comment on column public.requisitos_documentales.emisor_documento is
    'Quién elabora o emite el documento (separado de aporta_cliente: un cliente puede subir un archivo emitido por especialista o UVIE, sin poder aprobarlo).';
comment on column public.requisitos_documentales.requiere_entrega_fisica is
    'si, no o por_confirmar. por_confirmar muestra incertidumbre al cliente en la lista de visita en lugar de inventar instrucciones.';

-- 3. Checklist personal de preparación para visita física (aislado por proyecto_id).
--    No equivale a recepción física ni a validación administrativa de IDC.
create table if not exists public.portal_visita_checklist (
    proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
    marcados text[] not null default '{}',
    actualizado_en timestamptz not null default now(),
    constraint portal_visita_checklist_limite_chk check (coalesce(cardinality(marcados), 0) <= 40)
);

alter table public.portal_visita_checklist enable row level security;
revoke all on public.portal_visita_checklist from public, anon, authenticated, service_role;
grant select on public.portal_visita_checklist to service_role;

create policy portal_visita_checklist_select_staff on public.portal_visita_checklist
    for select to authenticated using (public.is_active_staff());
grant select on public.portal_visita_checklist to authenticated;

create or replace function public.guardar_checklist_visita_portal(
    p_acceso uuid,
    p_folio text,
    p_marcados text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_proyecto uuid;
    v_limpios text[];
begin
    select p.id into v_proyecto
    from public.portal_accesos a
    join public.proyectos p on p.id = a.proyecto_id
    where a.id = p_acceso
      and p.folio = upper(trim(p_folio))
      and not p.es_demo
      and a.activo
      and a.revocado_at is null
      and a.expira_at > now()
      and a.permisos @> '{"ver_documentos_autorizados":true}'::jsonb
    for update of a;

    if not found then
        raise exception using errcode = '42501', message = 'Acceso no autorizado';
    end if;

    if p_marcados is null or coalesce(cardinality(p_marcados), 0) > 40 then
        raise exception using errcode = '22023', message = 'Lista de preparación inválida';
    end if;

    select coalesce(array_agg(distinct m order by m), '{}')
    into v_limpios
    from unnest(p_marcados) as m
    where m is not null
      and length(trim(m)) between 1 and 64
      and exists (
          select 1 from public.requisitos_documentales r
          where r.tipo_documento = m and r.activo and r.aporta_cliente
      );

    insert into public.portal_visita_checklist(proyecto_id, marcados, actualizado_en)
    values (v_proyecto, v_limpios, now())
    on conflict (proyecto_id) do update
        set marcados = excluded.marcados,
            actualizado_en = now();

    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'portal_visita_checklist', v_proyecto, upper(trim(p_folio)), 'visita_checklist_actualizado',
        jsonb_build_object('cantidad', coalesce(cardinality(v_limpios), 0)));

    return jsonb_build_object('marcados', v_limpios);
end;
$$;

revoke all on function public.guardar_checklist_visita_portal(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.guardar_checklist_visita_portal(uuid, text, text[]) to service_role;

-- 4. Permite habilitar aportación de cualquier requisito desde administración sin perder auditoría.
create or replace function public.configurar_aportacion_cliente(
    p_id uuid,
    p_aporta_cliente boolean,
    p_revision_digital text,
    p_entrega_fisica text,
    p_actor uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_revision_digital not in ('opcional', 'obligatoria', 'no_disponible')
       or p_entrega_fisica not in ('si', 'no', 'por_confirmar') then
        raise exception using errcode = '22023', message = 'Configuración documental inválida';
    end if;

    update public.requisitos_documentales
    set aporta_cliente = p_aporta_cliente,
        revision_digital = case when p_aporta_cliente then p_revision_digital else 'no_disponible' end,
        requiere_entrega_fisica = p_entrega_fisica
    where id = p_id and activo;

    if not found then return false; end if;

    insert into public.auditoria_eventos(actor_user_id, origen, entidad, entidad_id, accion, detalles)
    values (p_actor, 'app', 'requisito_documental', p_id, 'aportacion_configurada',
        jsonb_build_object('aporta_cliente', p_aporta_cliente, 'revision_digital', p_revision_digital, 'requiere_entrega_fisica', p_entrega_fisica));

    return true;
end;
$$;

revoke all on function public.configurar_aportacion_cliente(uuid, boolean, text, text, uuid) from public, anon, authenticated;
grant execute on function public.configurar_aportacion_cliente(uuid, boolean, text, text, uuid) to service_role;

commit;
