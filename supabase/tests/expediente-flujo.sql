-- Pruebas de integración para PostgreSQL/Supabase local después de 001–011.
-- Usa folios y archivos sintéticos y revierte todas las escrituras.
begin;

insert into public.proyectos(folio) values ('KV-2099-88001'), ('KV-2099-88002');
insert into public.portal_accesos(id, proyecto_id, token_hash, activo, expira_at, permisos)
select '10000000-0000-4000-8000-000000000001', id, repeat('a',64), true, now() + interval '1 day',
    '{"editar_participantes":true,"subir_documentos":true,"ver_documentos_autorizados":true}'
from public.proyectos where folio = 'KV-2099-88001';

set local role service_role;

do $$
<<prueba>>
declare
    acceso uuid := '10000000-0000-4000-8000-000000000001';
    folio text := 'KV-2099-88001';
    resultado jsonb;
    recepcion uuid;
    doc uuid;
    anterior uuid;
    envio jsonb;
begin
    if has_table_privilege('authenticated', 'public.expediente_participantes_versiones', 'SELECT')
        or has_function_privilege('anon', 'public.revisar_recepcion_portal(uuid,uuid,text,text,text)', 'EXECUTE')
        or has_table_privilege('service_role', 'public.portal_recepciones', 'UPDATE') then
        raise exception 'Permisos inesperados';
    end if;

    resultado := public.guardar_participantes(folio, acceso, 0, '{"titular":"Prueba sintética"}', false);
    if resultado->>'version' <> '1' then raise exception 'Primera versión ausente'; end if;
    resultado := public.guardar_participantes(folio, acceso, 1, '{"titular":"Segunda versión sintética"}', true);
    if resultado->>'version' <> '2' then raise exception 'Versión confirmada ausente'; end if;
    begin
        perform public.guardar_participantes(folio, acceso, 1, '{}', true);
        raise exception 'Se escribió con una versión anterior';
    exception when serialization_failure then null;
    end;
    begin
        perform public.guardar_participantes('KV-2099-88002', acceso, 0, '{}', true);
        raise exception 'Se escribió en otro folio';
    exception when insufficient_privilege then null;
    end;

    envio := jsonb_build_object('folio', folio, 'acceso_id', acceso, 'documento_id', 'recibo_cfe',
        'documento_nombre', 'Recibo', 'archivo_nombre', 'prueba.pdf', 'mime', 'application/pdf', 'tamano_bytes', 64,
        'sha256', repeat('a',64), 'recibo', 'REC-ABC001', 'ruta_almacen', folio || '/portal/a/prueba.pdf');
    begin
        perform public.registrar_recepcion_portal(envio || '{"folio":"KV-2099-88002"}'::jsonb);
        raise exception 'Se registró un envío en otro folio';
    exception when insufficient_privilege then null;
    end;
    recepcion := (public.registrar_recepcion_portal(envio)->>'id')::uuid;
    resultado := public.revisar_recepcion_portal(recepcion, null, 'en_revision', null, null);
    if resultado->>'estado' <> 'en_revision' then raise exception 'Revisión no iniciada'; end if;
    begin
        perform public.registrar_recepcion_portal(envio);
        raise exception 'Se duplicó un envío pendiente';
    exception when serialization_failure then null;
    end;
    resultado := public.revisar_recepcion_portal(recepcion, null, 'rechazado', 'ilegible', 'Envía una copia legible.');
    if resultado->>'estado' <> 'rechazado' then raise exception 'Corrección ausente'; end if;
    anterior := recepcion;
    resultado := public.registrar_recepcion_portal(envio || jsonb_build_object(
        'recibo', 'REC-ABC002', 'ruta_almacen', folio || '/portal/b/prueba.pdf'));
    recepcion := (resultado->>'id')::uuid;
    if (resultado->>'sustituye_recepcion_id')::uuid is distinct from anterior then raise exception 'Sin historial'; end if;
    doc := (public.revisar_recepcion_portal(recepcion, null, 'aceptado', null, null)->>'documentoId')::uuid;
    if doc is null or (public.revisar_recepcion_portal(recepcion, null, 'aceptado', null, null)->>'documentoId')::uuid is distinct from doc
        then raise exception 'Aceptación no idempotente'; end if;
    begin
        perform public.revisar_recepcion_portal(recepcion, null, 'rechazado', 'otro', 'Otra revisión.');
        raise exception 'Se sobreescribió la decisión';
    exception when serialization_failure then null;
    end;
    begin
        update public.documentos set storage_path = 'otra/ruta' where id = doc;
        raise exception 'Se modificó el archivo vinculado';
    exception when insufficient_privilege then null;
    end;
    if (select count(*) from public.expediente_participantes_versiones where datos->>'titular' like '%sintética%') <> 2
        then raise exception 'No se conservaron las dos versiones'; end if;
    if (select count(*) from public.auditoria_eventos a where a.folio = prueba.folio and a.accion = 'documento_aceptado') <> 1
        then raise exception 'Auditoría de aceptación duplicada o ausente'; end if;
    recepcion := (public.registrar_recepcion_portal(envio || jsonb_build_object(
        'recibo', 'REC-ABC003', 'ruta_almacen', folio || '/portal/c/prueba.pdf'))->>'id')::uuid;
    anterior := (public.revisar_recepcion_portal(recepcion, null, 'aceptado', null, null)->>'documentoId')::uuid;
    if not exists (select 1 from public.documentos d where d.id = anterior and d.version = 2 and d.documento_sustituye_id = doc)
        then raise exception 'La segunda aceptación no preservó la versión anterior'; end if;
end;
$$;

rollback;
