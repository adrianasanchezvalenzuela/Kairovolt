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
