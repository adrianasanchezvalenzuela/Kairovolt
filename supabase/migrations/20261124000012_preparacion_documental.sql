begin;

alter table public.requisitos_documentales
    add column guia_preparacion jsonb not null default '{}' check (jsonb_typeof(guia_preparacion) = 'object'),
    add column revision_digital text not null default 'opcional'
        check (revision_digital in ('opcional', 'obligatoria', 'no_disponible'));

update public.requisitos_documentales set revision_digital = 'no_disponible' where not aporta_cliente;
update public.requisitos_documentales set guia_preparacion = v.guia
from (values
 ('recibo_cfe', '{"motivo":"Identifica el servicio eléctrico de la instalación.","oficial":"https://www.cfe.mx/","pasos":["Puedes usar un recibo que ya tengas o consultar el portal de CFE."],"comprobaciones":["Revisé el titular","Localicé el número de servicio","Revisé el domicilio","El recibo se lee completo"]}'::jsonb),
 ('constancia_situacion_fiscal', '{"motivo":"Permite revisar los datos fiscales del titular.","oficial":"https://sat.gob.mx/portal/public/tramites/constancia-de-situacion-fiscal","pasos":["Consulta las opciones del SAT y completa el trámite en su sitio oficial."],"comprobaciones":["Revisé el nombre o razón social","Localicé el RFC","La constancia se lee completa"]}'::jsonb),
 ('identificacion_oficial', '{"motivo":"Permite cotejar al titular del trámite.","pasos":["Conserva la identificación y evita reflejos o recortes si decides enviar una copia."],"comprobaciones":["El nombre se puede leer","La imagen está enfocada y completa"]}'::jsonb),
 ('carta_poder', '{"motivo":"Permite preparar los datos de representación.","pasos":["Confirma los datos de quien tramita en Mis datos y consulta con IDC la plantilla aplicable."],"entrega":"Consulta con IDC la plantilla y las firmas que corresponden.","comprobaciones":["Revisé los datos del titular y quien tramita","Consulté las instrucciones de IDC"]}'::jsonb)
) as v(tipo, guia) where tipo_documento = v.tipo;

create table public.portal_preparacion (
    proyecto_id uuid not null references public.proyectos(id),
    requisito_codigo text not null references public.requisitos_documentales(codigo),
    documento text not null,
    marcadas integer[] not null default '{}',
    preparado boolean not null default false,
    actualizado_en timestamptz not null default now(),
    primary key (proyecto_id, requisito_codigo)
);
alter table public.portal_preparacion enable row level security;
revoke all on public.portal_preparacion from public, anon, authenticated, service_role;
grant select on public.portal_preparacion to service_role;

create function public.guardar_preparacion_portal(p_acceso uuid, p_folio text, p_documento text, p_marcadas integer[], p_preparado boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
    v_proyecto uuid;
    v_codigo text;
    v_cantidad integer;
begin
    select p.id into v_proyecto
    from public.portal_accesos a join public.proyectos p on p.id = a.proyecto_id
    where a.id = p_acceso and p.folio = p_folio and not p.es_demo
      and a.activo and a.revocado_at is null and a.expira_at > now()
      and a.permisos @> '{"ver_documentos_autorizados":true}'::jsonb
    for update of a;
    if not found then raise exception using errcode = '42501', message = 'Acceso no autorizado'; end if;

    select codigo, case when jsonb_typeof(guia_preparacion->'comprobaciones') = 'array'
      then least(30, jsonb_array_length(guia_preparacion->'comprobaciones')) else 0 end
    into v_codigo, v_cantidad
    from public.requisitos_documentales where tipo_documento = p_documento and activo and aporta_cliente;
    if not found or p_marcadas is null or p_preparado is null or cardinality(p_marcadas) > 30
      or exists (select from unnest(p_marcadas) as n where n is null or n < 0 or n >= v_cantidad)
      or cardinality(p_marcadas) <> (select count(distinct n) from unnest(p_marcadas) as n)
      or (p_preparado and cardinality(p_marcadas) <> v_cantidad) then
        raise exception using errcode = '22023', message = 'Preparación inválida';
    end if;

    insert into public.portal_preparacion(proyecto_id, requisito_codigo, documento, marcadas, preparado)
    values (v_proyecto, v_codigo, p_documento, p_marcadas, p_preparado)
    on conflict (proyecto_id, requisito_codigo) do update set marcadas = excluded.marcadas,
        preparado = excluded.preparado, actualizado_en = now();
    insert into public.auditoria_eventos(origen, entidad, entidad_id, folio, accion, detalles)
    values ('portal', 'portal_preparacion', v_proyecto, p_folio, 'preparacion_actualizada',
        jsonb_build_object('requisito', v_codigo, 'preparado', p_preparado, 'cantidad', cardinality(p_marcadas)));
    return jsonb_build_object('documento', p_documento, 'marcadas', p_marcadas, 'preparado', p_preparado);
end;
$$;
revoke all on function public.guardar_preparacion_portal(uuid,text,text,integer[],boolean) from public, anon, authenticated;
grant execute on function public.guardar_preparacion_portal(uuid,text,text,integer[],boolean) to service_role;

create function public.configurar_revision_digital(p_id uuid, p_modo text, p_actor uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
    update public.requisitos_documentales set revision_digital = p_modo
    where id = p_id and activo and aporta_cliente;
    if not found then return false; end if;
    insert into public.auditoria_eventos(actor_user_id,origen,entidad,entidad_id,accion,detalles)
    values (p_actor,'app','requisito_documental',p_id,'revision_digital_configurada',jsonb_build_object('modalidad',p_modo));
    return true;
end;
$$;
revoke all on function public.configurar_revision_digital(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.configurar_revision_digital(uuid,text,uuid) to service_role;

commit;
