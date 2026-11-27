/** Credenciales públicas de fixtures locales. El portal conectado a Supabase no las utiliza. */
export const demosPortal = [
  {
    folio: 'KV-2026-004',
    codigo: 'DEMO-KV26-004P-ORTL',
    titulo: 'Captura de datos',
    etapa: 'Inicio del expediente',
    descripcion: 'Cliente comenzando su expediente: registra titular, apoderado o representante y testigos en Mis datos.',
  },
  {
    folio: 'KV-2026-005',
    codigo: 'DEMO-KV26-005P-ORTL',
    titulo: 'Preparación y revisión documental',
    etapa: 'Media tensión · 11 documentos',
    descripcion: 'Explora los 11 documentos en tres grupos: los tuyos, la solicitud que armamos juntos y los técnicos que prepara IDC. Incluye una corrección de Carta Poder.',
  },
  {
    folio: 'KV-2026-006',
    codigo: 'DEMO-KV26-006P-ORTL',
    titulo: 'Preparación de visita y citas',
    etapa: 'Listo para entrega física',
    descripcion: 'Revisa los 11 documentos prevalidados, prepara tu lista física y agenda tu visita en el calendario interactivo.',
  },
  {
    folio: 'KV-2026-007',
    codigo: 'DEMO-KV26-007P-ORTL',
    titulo: 'Solicitud aprobada',
    etapa: 'Resolución favorable de CFE',
    descripcion: 'CFE emitió una resolución favorable. Revisa tus contratos, el oficio de demostración y el historial del trámite.',
  },
  {
    folio: 'KV-2026-008',
    codigo: 'DEMO-KV26-008P-ORTL',
    titulo: 'Instalación del medidor',
    etapa: 'Contratos formalizados',
    descripcion: 'Da seguimiento a la instalación del medidor bidireccional: pendiente, programada, reprogramada o instalada.',
  },
  {
    folio: 'KV-2026-009',
    codigo: 'DEMO-KV26-009P-ORTL',
    titulo: 'Interconexión concluida',
    etapa: 'Trámite cerrado',
    descripcion: 'Cierre del recorrido: resumen del proyecto, expediente final descargable y encuesta de satisfacción.',
  },
] as const;

export const FOLIO_CAPTURA_DEMO = demosPortal[0].folio;
export const FOLIO_DOCUMENTOS_DEMO = demosPortal[1].folio;
export const FOLIO_CITA_DEMO = demosPortal[2].folio;
export const FOLIO_APROBADA_DEMO = demosPortal[3].folio;
export const FOLIO_MEDIDOR_DEMO = demosPortal[4].folio;
export const FOLIO_CONCLUIDA_DEMO = demosPortal[5].folio;
/** Demos 4 a 6: el trámite continúa después de la entrega física (resolución, contratos, medidor, cierre). */
export const FOLIOS_TRAMITE_DEMO: readonly string[] = [FOLIO_APROBADA_DEMO, FOLIO_MEDIDOR_DEMO, FOLIO_CONCLUIDA_DEMO];
export const esTramiteDemo = (vista: { demo: boolean; folio: string }) => vista.demo && FOLIOS_TRAMITE_DEMO.includes(vista.folio);

export function esCapturaDemo(vista: { demo: boolean; folio: string }) {
  return import.meta.env.DEV && vista.demo && vista.folio === FOLIO_CAPTURA_DEMO;
}

export function esDocumentosDemo(vista: { demo: boolean; folio: string }) {
  return import.meta.env.DEV && vista.demo && vista.folio === FOLIO_DOCUMENTOS_DEMO;
}

export function esCitaDemo(vista: { demo: boolean; folio: string }) {
  return import.meta.env.DEV && vista.demo && vista.folio === FOLIO_CITA_DEMO;
}
