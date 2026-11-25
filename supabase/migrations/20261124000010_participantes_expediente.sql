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
