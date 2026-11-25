import type { Proyecto } from '../src/domain/proyecto/proyecto';
import type { TipoDocumento } from '../src/domain/documentos/documento';
import type { CampoDato } from '../src/domain/validacion/campos';
import type { ClienteSupabase } from './supabase/cliente';
import { configuracionVacia } from '../src/domain/entidades/configuracion-tecnica';

interface FilaDocumento {
  id: string;
  nombre_archivo: string;
  mime_type: string | null;
  fecha_emision: string | null;
  fecha_vigencia: string | null;
  version: number;
  created_at: string;
  requisitos_documentales: { tipo_documento: TipoDocumento | null } | null;
  documento_datos_declarados: { campo: CampoDato; declarado: boolean; valor_texto: string | null;
    resoluciones_documentales?: { id: string; decision: string; resuelto_at: string }[] }[];
}

interface FilaExpediente {
  documentos: FilaDocumento[];
  portal_preparacion?: { documento: TipoDocumento; preparado: boolean }[];
  portal_entregas_fisicas?: { recepcion_id: string | null; validado_en: string | null; requisitos_documentales: { tipo_documento: TipoDocumento | null } }[];
  aprobaciones_checklist_g2?: { id: string; version_checklist: number; resultado: string; aprobado_at: string }[];
  sistemas_fotovoltaicos: {
    numero_paneles: number | null;
    potencia_panel_w: number | null;
    potencia_ac_kw: number | null;
    numero_inversores: number | null;
    marca_inversor: string | null;
    potencia_inversor_kw: number | null;
    transformador_kva: number | null;
  } | null;
}

export async function componerExpediente(sb: ClienteSupabase, proyecto: Proyecto, incluirRevision = true): Promise<Proyecto> {
  const folio = encodeURIComponent(proyecto.folio.toUpperCase());
  const resoluciones = incluirRevision ? ',resoluciones_documentales(id,decision,resuelto_at)' : '';
  const aprobaciones = incluirRevision ? ',aprobaciones_checklist_g2(id,version_checklist,resultado,aprobado_at),' +
    'portal_preparacion(documento,preparado),portal_entregas_fisicas(recepcion_id,validado_en,requisitos_documentales(tipo_documento))' : '';
  const filas = await sb.rest<FilaExpediente[]>('GET',
    '/proyectos?select=documentos(id,nombre_archivo,mime_type,fecha_emision,fecha_vigencia,version,created_at,' +
    'requisitos_documentales(tipo_documento),documento_datos_declarados(campo,declarado,valor_texto' + resoluciones +
    ')),sistemas_fotovoltaicos(*)' + aprobaciones +
    '&folio=eq.' + folio + '&es_demo=eq.false&limit=1');
  const complemento = filas[0];
  const revisionDocumental: NonNullable<Proyecto['revisionDocumental']> = {};
  if (incluirRevision) {
    const recepciones = await sb.rest<{ id: string; documento_id: TipoDocumento; estado: 'recibido' | 'en_revision' | 'prevalidado' | 'aceptado' | 'rechazado' }[]>('GET',
      '/portal_recepciones?select=id,documento_id,estado&folio=eq.' + folio + '&order=creado_en.desc,id.desc&limit=500');
    for (const r of recepciones) {
      if (!Object.hasOwn(revisionDocumental, r.documento_id)) {
        Object.defineProperty(revisionDocumental, r.documento_id, { value: r.estado, enumerable: true, writable: true });
      }
    }
    for (const e of complemento?.portal_entregas_fisicas ?? []) {
      const tipo = e.requisitos_documentales.tipo_documento;
      const ultima = recepciones.find((r) => r.documento_id === tipo);
      if (tipo && (ultima?.id ?? null) === e.recepcion_id && ultima?.estado !== 'aceptado' && ultima?.estado !== 'rechazado') {
        revisionDocumental[tipo] = e.validado_en ? 'validado_fisico' : 'entregado';
      }
    }
    for (const e of complemento?.portal_preparacion ?? []) {
      if (e.preparado && !Object.hasOwn(revisionDocumental, e.documento)) {
        Object.defineProperty(revisionDocumental, e.documento, { value: 'preparado', enumerable: true });
      }
    }
  }
  const documentos = new Map<TipoDocumento, Proyecto['documentos'][number]>();
  const versiones = [...(complemento?.documentos ?? [])].sort((a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at));
  for (const d of versiones) {
    const tipo = d.requisitos_documentales?.tipo_documento;
    if (!tipo || documentos.has(tipo) || (revisionDocumental[tipo] && !['aceptado', 'preparado'].includes(revisionDocumental[tipo]!))) continue;
    documentos.set(tipo, {
      id: d.id, nombre: d.nombre_archivo, tipo, fechaEmision: d.fecha_emision, fechaVigencia: d.fecha_vigencia,
      datos: d.documento_datos_declarados.filter((v) => v.declarado).map((v) => ({ campo: v.campo, valor: v.valor_texto })),
      archivo: { url: '/api/admin/expediente/archivos/' + d.id, mime: d.mime_type },
    });
  }
  const s = complemento?.sistemas_fotovoltaicos;
  const configuracionTecnica = s ? {
    ...configuracionVacia(), ...proyecto.configuracionTecnica,
    numeroPaneles: s.numero_paneles, potenciaPanelW: s.potencia_panel_w, potenciaAcKw: s.potencia_ac_kw,
    numeroInversores: s.numero_inversores, marcaInversor: s.marca_inversor,
    potenciaInversorKw: s.potencia_inversor_kw, transformadorKva: s.transformador_kva,
  } : proyecto.configuracionTecnica ?? null;
  const sistema = s && s.numero_paneles !== null && s.potencia_panel_w !== null && s.potencia_ac_kw !== null &&
    s.numero_inversores !== null && s.marca_inversor !== null && s.potencia_inversor_kw !== null && s.transformador_kva !== null
    ? { numeroPaneles: s.numero_paneles, potenciaPanelW: s.potencia_panel_w, potenciaAcKw: s.potencia_ac_kw,
        numeroInversores: s.numero_inversores, marcaInversor: s.marca_inversor,
        potenciaInversorKw: s.potencia_inversor_kw, transformadorKva: s.transformador_kva }
    : proyecto.sistema;
  const decisionesExpediente = incluirRevision ? {
    resoluciones: versiones.flatMap((d) => d.documento_datos_declarados.flatMap((dato) =>
      (dato.resoluciones_documentales ?? []).map((r) => ({
        id: r.id, decision: r.decision, fecha: r.resuelto_at, campo: dato.campo, documento: d.nombre_archivo,
      })))).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    aprobacionesG2: (complemento?.aprobaciones_checklist_g2 ?? []).map((a) => ({
      id: a.id, version: a.version_checklist, resultado: a.resultado, fecha: a.aprobado_at,
    })).sort((a, b) => b.fecha.localeCompare(a.fecha)),
  } : undefined;
  return { ...proyecto, documentos: [...documentos.values()], documentosDisponibles: true, sistema, configuracionTecnica,
    revisionDocumental, ...(decisionesExpediente && { decisionesExpediente }) };
}
