-- KAIROVOLT | MIGRACION 009
-- Extiende el catálogo existente sin borrar códigos ni romper la FK de documentos.
-- Todas las equivalencias importadas quedan pendientes de validación por IDC.

begin;

alter table public.requisitos_documentales
    add column if not exists tipo_documento text,
    add column if not exists compuerta text,
    add column if not exists canal text not null default 'digital',
    add column if not exists requiere_vigencia boolean not null default false,
    add column if not exists aporta_cliente boolean not null default false,
    add column if not exists reubicable_por_zona boolean not null default false,
    add column if not exists condiciones_aplicacion jsonb not null default '[]'::jsonb,
    add column if not exists quien_aporta text not null default 'pendiente',
    add column if not exists instrucciones_cliente text,
    add column if not exists campos_esperados jsonb not null default '[]'::jsonb,
    add column if not exists ejemplos_autorizados jsonb not null default '[]'::jsonb,
    add column if not exists generacion_automatica boolean not null default false,
    add column if not exists validacion_idc text not null default 'pendiente';

do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'requisitos_tipo_documento_chk') then
        alter table public.requisitos_documentales add constraint requisitos_tipo_documento_chk check (
            tipo_documento is null or tipo_documento in (
                'consulta_capacidad_mt','recibo_cfe','datos_preliminares','identificacion_oficial','constancia_situacion_fiscal',
                'carta_poder','acta_constitutiva','croquis','diagrama_unifilar','memoria_calculo','ficha_tecnica','certificado',
                'solicitud','evidencia_fotografica','checklist_consistencia','dictamen_uvie','certificado_uiie','oficio_resolutivo',
                'contrato_interconexion','contrato_contraprestacion','medidor_bidireccional'
            )
        );
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_compuerta_chk') then
        alter table public.requisitos_documentales add constraint requisitos_compuerta_chk
            check (compuerta is null or compuerta in ('G0','G1','G2','G3'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_canal_chk') then
        alter table public.requisitos_documentales add constraint requisitos_canal_chk check (canal in ('digital','fisico'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_quien_aporta_chk') then
        alter table public.requisitos_documentales add constraint requisitos_quien_aporta_chk
            check (quien_aporta in ('cliente','idc','tercero','pendiente'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_validacion_idc_chk') then
        alter table public.requisitos_documentales add constraint requisitos_validacion_idc_chk
            check (validacion_idc in ('pendiente','validado'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_condiciones_array_chk') then
        alter table public.requisitos_documentales add constraint requisitos_condiciones_array_chk
            check (jsonb_typeof(condiciones_aplicacion) = 'array');
    end if;
    if not exists (select 1 from pg_constraint where conname = 'requisitos_campos_array_chk') then
        alter table public.requisitos_documentales add constraint requisitos_campos_array_chk
            check (jsonb_typeof(campos_esperados) = 'array' and jsonb_typeof(ejemplos_autorizados) = 'array');
    end if;
end $$;

-- Mapeos que corresponden de forma directa con el checklist actual. El resto
-- de filas históricas se conserva sin asignación hasta confirmar equivalencia.
update public.requisitos_documentales r set
    tipo_documento = m.tipo_documento,
    categoria = m.categoria,
    compuerta = m.compuerta,
    canal = m.canal,
    obligatorio = true,
    condicion = null,
    requiere_vigencia = m.requiere_vigencia,
    aporta_cliente = m.aporta_cliente,
    quien_aporta = m.quien_aporta,
    reubicable_por_zona = m.reubicable_por_zona,
    instrucciones_cliente = case when m.aporta_cliente then 'Instrucciones pendientes de validación por IDC.' else null end,
    validacion_idc = 'pendiente'
from (values
    ('RECIBO_CFE','recibo_cfe','cliente','G0','digital',true,true,'cliente',false),
    ('IDENTIFICACION_TITULAR','identificacion_oficial','cliente','G1','digital',true,true,'cliente',false),
    ('CONSTANCIA_FISCAL','constancia_situacion_fiscal','cliente','G1','digital',true,true,'cliente',false),
    ('SOLICITUD_INTERCONEXION','solicitud','solicitud','G2','fisico',false,false,'pendiente',false),
    ('CROQUIS_UBICACION','croquis','tecnico','G1','digital',false,false,'pendiente',false),
    ('DIAGRAMA_UNIFILAR','diagrama_unifilar','tecnico','G1','digital',false,false,'pendiente',false),
    ('MEMORIA_CALCULO','memoria_calculo','tecnico','G1','digital',false,false,'pendiente',false),
    ('DICTAMEN_UVIE','dictamen_uvie','dictamen','G3','fisico',false,false,'pendiente',true)
) as m(codigo,tipo_documento,categoria,compuerta,canal,requiere_vigencia,aporta_cliente,quien_aporta,reubicable_por_zona)
where r.codigo = m.codigo;

-- Requisitos del catálogo usado por el dominio que no existían con un código
-- equivalente. Los nombres/condiciones se conservan como propuestas internas,
-- no como requisitos oficiales; todos quedan en estado pendiente de IDC.
insert into public.requisitos_documentales (
    codigo,nombre,descripcion,categoria,obligatorio,condicion,orden,tipo_documento,compuerta,canal,
    requiere_vigencia,aporta_cliente,reubicable_por_zona,quien_aporta,instrucciones_cliente,
    campos_esperados,ejemplos_autorizados,generacion_automatica,validacion_idc
) values
('CONSULTA_CAPACIDAD_MT','Consulta/registro de capacidad del circuito MT','Referencia del proceso de consulta en la plataforma correspondiente.','solicitud',true,null,1,'consulta_capacidad_mt','G0','digital',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('DATOS_PRELIMINARES','Datos técnicos preliminares','Datos declarados de capacidad, tensión y modalidad.','tecnico',true,null,3,'datos_preliminares','G0','digital',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('CARTA_PODER','Carta poder','Instrumento de representación; contenido y formalidades pendientes de aprobación jurídica de IDC.','legal',true,null,6,'carta_poder','G1','fisico',false,true,false,'cliente','Instrucciones pendientes de validación por IDC.','[]','[]',false,'pendiente'),
('ACTA_CONSTITUTIVA','Acta constitutiva / acreditación de propiedad o posesión','Acreditación aplicable según el tipo de titular y el caso.','legal',false,'Titular persona moral o cuando aplique',7,'acta_constitutiva','G1','digital',false,true,false,'cliente','Instrucciones pendientes de validación por IDC.','[]','[]',false,'pendiente'),
('FICHA_TECNICA','Fichas técnicas de módulos e inversores','Fichas técnicas del equipamiento declarado.','tecnico',true,null,11,'ficha_tecnica','G1','digital',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('CERTIFICADO','Certificados de equipos','Certificados de equipos; vigencia y alcance por confirmar con IDC.','tecnico',true,null,12,'certificado','G1','digital',true,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('EVIDENCIA_FOTOGRAFICA','Evidencia fotográfica del sistema','Imágenes del sistema y sus componentes; alcance por confirmar con IDC.','instalacion',true,null,14,'evidencia_fotografica','G2','digital',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('CHECKLIST_CONSISTENCIA','Checklist de consistencia y vigencias','Revisión interna; no sustituye decisiones humanas.','instalacion',true,null,15,'checklist_consistencia','G2','digital',false,false,false,'idc',null,'[]','[]',false,'pendiente'),
('CERTIFICADO_UIIE','Certificado de cumplimiento UIIE','Aplicabilidad sujeta a revisión de IDC y condiciones del proyecto.','dictamen',false,'Si aplica por criterio de zona o disposición vigente',17,'certificado_uiie','G3','digital',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('OFICIO_RESOLUTIVO','Acuse de ingreso / oficio resolutivo','Documento emitido por CFE, cuando corresponda.','dictamen',true,null,18,'oficio_resolutivo','G3','digital',false,false,false,'idc',null,'[]','[]',false,'pendiente'),
('CONTRATO_INTERCONEXION','Contrato de interconexión','Contrato correspondiente emitido por la entidad responsable.','solicitud',true,null,19,'contrato_interconexion','G3','fisico',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('CONTRATO_CONTRAPRESTACION','Contrato de contraprestación','Contrato correspondiente sujeto al esquema aplicable.','solicitud',true,null,20,'contrato_contraprestacion','G3','fisico',false,false,false,'pendiente',null,'[]','[]',false,'pendiente'),
('MEDIDOR_BIDIRECCIONAL','Evidencia de instalación de medidor bidireccional','Evidencia de instalación y alta comercial, cuando corresponda.','instalacion',true,null,21,'medidor_bidireccional','G3','digital',false,false,false,'pendiente',null,'[]','[]',false,'pendiente')
on conflict (codigo) do nothing;

create unique index if not exists requisitos_tipo_documento_unico_idx
    on public.requisitos_documentales(tipo_documento) where tipo_documento is not null;
create index if not exists requisitos_catalogo_compuerta_activo_idx
    on public.requisitos_documentales(activo,compuerta,orden);

comment on column public.requisitos_documentales.validacion_idc is
    'pendiente significa que IDC aún debe validar la equivalencia o contenido; no autoriza avance ni presentación ante CFE.';
comment on column public.requisitos_documentales.condiciones_aplicacion is
    'Condiciones estructuradas conocidas; campos ausentes en el proyecto producen pendiente_revision.';
comment on column public.requisitos_documentales.ejemplos_autorizados is
    'Arreglo vacío hasta que IDC autorice ejemplos.';

commit;
