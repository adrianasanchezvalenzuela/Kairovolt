/**
 * Datos 100 % FICTICIOS compartidos por Mis datos, los documentos precargados (public/demo/documentos),
 * la solicitud y los contratos de los escenarios de demostración. Una sola fuente de verdad.
 * Ninguno corresponde a una persona, RFC, servicio o domicilio reales.
 */
export const ANCLA_DEMO = Date.UTC(2026, 10, 27, 19, 0, 0); // 27-nov-2026 12:00 hora de Hermosillo

/** Fecha ISO `offset` días respecto al ancla de la demostración, a las `hora` (hora de Hermosillo, UTC-7). */
export function diaDemo(offset: number, hora = 10): string {
  const base = new Date(ANCLA_DEMO);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + offset, hora + 7, 0, 0)).toISOString();
}
export const fechaLargaDemo = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Hermosillo' }).format(new Date(iso));
export const fechaCortaDemo = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Hermosillo' }).format(new Date(iso));

export const DOMICILIO_DEMO = {
  calle: 'Calle Ejemplo', numExt: '100', colonia: 'Colonia Ejemplo', municipio: 'Hermosillo', estado: 'Sonora', cp: '83000',
  texto: 'Calle Ejemplo 100, Colonia Ejemplo, C.P. 83000, Hermosillo, Sonora',
} as const;

export const TITULAR_DEMO = {
  nombre: 'Alejandro Mendoza Ruiz',
  rfc: 'DEMO850101XX0',
  claveElector: 'DEMOMNRZAL85010126H100',
  nacimiento: '01/01/1985',
  correo: 'alejandro@example.com',
  telefono: '662 000 0001',
} as const;
export const REPRESENTANTE_DEMO = { nombre: 'Mariana Torres López', claveElector: 'DEMOTRLPMR90030326M200', nacimiento: '03/03/1990', puesto: 'Apoderada' } as const;
export const TESTIGOS_DEMO = [
  { nombre: 'Daniel Herrera Castro', claveElector: 'DEMOHRCSDN88061526H300', nacimiento: '15/06/1988' },
  { nombre: 'Sofía Navarro Méndez', claveElector: 'DEMONVMNSF92111826M400', nacimiento: '18/11/1992' },
] as const;
export const SERVICIO_DEMO = {
  numero: '999 000 000 042', tarifa: 'GDMTO', cargaKw: 45, demandaKw: 45, tensionNivel: 'Media tensión',
  periodo: '15 sep 2026 – 15 oct 2026', limitePago: '30 oct 2026', total: '$ 18,420.00', consumoKwh: 7500,
} as const;
export const PROYECTO_DEMO = { nombre: 'Interconexión FV 40 kW', municipio: 'Hermosillo', capacidadKw: 40, paneles: '64 paneles de 625 W' } as const;
/** Empresa ficticia del escenario (aparece en la descripción de la consulta y en los datos de ejemplo). */
export const EMPRESA_DEMO = 'Soluciones Industriales del Desierto';
export const TELEFONO_DEMO = '662 000 0001';
export const MARCA_DEMO = 'DEMO — Sin validez oficial';
