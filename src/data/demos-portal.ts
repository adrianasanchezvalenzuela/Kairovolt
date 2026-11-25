/** Credenciales públicas de fixtures locales. El portal conectado a Supabase no las utiliza. */
export const demosPortal = [
  {
    folio: 'KV-2026-004', codigo: 'DEMO-KV26-004P-ORTL', titulo: 'Por preparar',
    descripcion: 'Empieza la captura de datos, consulta la guía y prepara el primer envío.',
  },
  {
    folio: 'KV-2026-005', codigo: 'DEMO-KV26-005P-ORTL', titulo: 'Documentos enviados',
    descripcion: 'Consulta acuses, archivos aceptados y documentos que IDC está revisando.',
  },
] as const;
