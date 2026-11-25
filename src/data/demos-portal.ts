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
    descripcion: 'Explora los 11 documentos con guías visuales, vista previa, Carta Poder, correcciones y carga de archivos.',
  },
  {
    folio: 'KV-2026-006',
    codigo: 'DEMO-KV26-006P-ORTL',
    titulo: 'Preparación de visita y citas',
    etapa: 'Listo para entrega física',
    descripcion: 'Revisa los 11 documentos prevalidados, prepara tu lista física y agenda tu visita en el calendario interactivo.',
  },
] as const;

export const FOLIO_CAPTURA_DEMO = demosPortal[0].folio;
export const FOLIO_DOCUMENTOS_DEMO = demosPortal[1].folio;
export const FOLIO_CITA_DEMO = demosPortal[2].folio;

export function esCapturaDemo(vista: { demo: boolean; folio: string }) {
  return import.meta.env.DEV && vista.demo && vista.folio === FOLIO_CAPTURA_DEMO;
}

export function esDocumentosDemo(vista: { demo: boolean; folio: string }) {
  return import.meta.env.DEV && vista.demo && vista.folio === FOLIO_DOCUMENTOS_DEMO;
}

export function esCitaDemo(vista: { demo: boolean; folio: string }) {
  return import.meta.env.DEV && vista.demo && vista.folio === FOLIO_CITA_DEMO;
}
