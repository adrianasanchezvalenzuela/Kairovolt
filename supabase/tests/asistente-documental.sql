begin;

insert into public.proyectos(folio) values ('KV-2099-88101'),('KV-2099-88102');
insert into public.portal_accesos(id, proyecto_id, token_hash, activo, expira_at, permisos)
select '10000000-0000-4000-8000-000000000012', id, repeat('b',64), true, now() + interval '1 day',
    '{"subir_documentos":true,"ver_documentos_autorizados":true,"editar_participantes":true}'
from public.proyectos where folio = 'KV-2099-88101';

do $$
declare
    f text := 'KV-2099-88101';
    a uuid := '10000000-0000-4000-8000-000000000012';
    r uuid;
    v jsonb;
    datos jsonb;
begin
    if has_function_privilege('anon','public.revisar_entrega_portal(uuid,uuid,text)','EXECUTE')
      or has_table_privilege('authenticated','public.portal_contactos_aviso','SELECT') then
        raise exception 'Privilegios inesperados';
    end if;
    perform public.guardar_preparacion_portal(a,f,'recibo_cfe',array[0,1,2,3],true);
    if exists(select from public.portal_recepciones where folio=f) then raise exception 'Se inventó un acuse'; end if;
    begin
        perform public.guardar_preparacion_portal(a,'KV-2099-88102','recibo_cfe',array[]::integer[],false);
        raise exception 'Se guardó otro folio';
    exception when insufficient_privilege then null;
    end;

    perform public.autorizar_correo_portal(f, 'contacto@example.invalid', repeat('c',64), repeat('d',64), null);
    v := public.tomar_correo_portal();
    if v->>'token' is distinct from repeat('d',64) then raise exception 'Falta correo de verificación'; end if;
    perform public.resolver_correo_portal((v->>'id')::uuid, (v->>'intento')::integer, 'aceptado');
    if not public.verificar_correo_portal(repeat('c',64)) or public.verificar_correo_portal(repeat('c',64)) then
        raise exception 'Token reutilizable o inválido';
    end if;

    datos := jsonb_build_object('folio',f,'acceso_id',a,'documento_id','recibo_cfe','documento_nombre','Recibo',
      'archivo_nombre','sintetico.pdf','mime','application/pdf','tamano_bytes',100,'sha256',repeat('d',64),
      'recibo','REC-EEA001','ruta_almacen',f || '/portal/a/sintetico.pdf');
    r := (public.registrar_recepcion_portal(datos)->>'id')::uuid;
    perform public.revisar_entrega_portal(r,null,'prevalidado');
    perform public.revisar_entrega_portal(r,null,'prevalidado');
    if exists(select from public.documentos where storage_path=f || '/portal/a/sintetico.pdf') then raise exception 'Prevalidación creó evidencia canónica'; end if;
    begin
        perform public.revisar_recepcion_portal(r,null,'aceptado',null,null);
        raise exception 'Validación sin recepción física';
    exception when serialization_failure then null;
    end;
    perform public.revisar_entrega_portal(r,null,'entregado');
    perform public.revisar_entrega_portal(r,null,'aceptado');
    if not exists(select from public.documentos where storage_path=f || '/portal/a/sintetico.pdf') then raise exception 'Validación no incorporada'; end if;
    if (select count(*) from public.portal_eventos_documentales where clave=r::text || ':prevalidado') <> 1 then
        raise exception 'Aviso duplicado';
    end if;
    v := public.tomar_correo_portal();
    if v->>'token' is not null or v->>'tipo' is null then raise exception 'Aviso de expediente inválido'; end if;
    perform public.resolver_correo_portal((v->>'id')::uuid,(v->>'intento')::integer,'temporal');
    if not exists (select from public.portal_cola_correo where id=(v->>'id')::uuid and estado='pendiente' and disponible_en>now()) then
        raise exception 'No se programó un reintento';
    end if;

    perform public.registrar_entrega_sin_copia(f,'identificacion_oficial',null,false);
    perform public.registrar_entrega_sin_copia(f,'identificacion_oficial',null,true);
    if not exists (select from public.portal_eventos_documentales where folio=f and tipo='validado_fisico') then
        raise exception 'Entrega autónoma sin aviso';
    end if;

    update public.requisitos_documentales set generacion_automatica = true where tipo_documento = 'carta_poder';
    perform public.guardar_participantes(f,a,0,'{"titular":"Titular ficticio"}',true);
    perform public.registrar_carta_demo_portal(f,a,jsonb_build_object(
       'id',a,'version',1,'plantilla','demo-1','fecha',now(),'sha256',repeat('e',64),
       'proyecto',jsonb_build_object('folio',f),'ruta',f || '/generados/demo/' || a::text || '.pdf'));
    if not exists(select from public.portal_documentos_generados where id=a and solo_demostracion and snapshot->'datos'->>'titular' = 'Titular ficticio') then
        raise exception 'Falta snapshot del documento generado';
    end if;
end;
$$;
rollback;
