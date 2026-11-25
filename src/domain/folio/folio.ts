/** Folio de producción: KV-AAAA-NNN (3 o más dígitos de secuencia). El de demostración usa MOCK en lugar del año. */
export const PATRON_FOLIO = /^KV-(\d{4})-(\d{3,})$/;
export const PATRON_FOLIO_DEMO = /^KV-MOCK-\d{3,}$/;

export const normalizarFolio = (folio: string): string => folio.trim().toUpperCase();

export interface FolioParseado {
  anio: number;
  secuencia: number;
}

export function parsearFolio(folio: string): FolioParseado | null {
  const m = PATRON_FOLIO.exec(normalizarFolio(folio));
  return m ? { anio: Number(m[1]), secuencia: Number(m[2]) } : null;
}

export function esFolioValido(folio: string, opciones: { permitirDemo?: boolean } = {}): boolean {
  const f = normalizarFolio(folio);
  return PATRON_FOLIO.test(f) || (opciones.permitirDemo === true && PATRON_FOLIO_DEMO.test(f));
}

export function formatearFolio(anio: number, secuencia: number): string {
  if (!Number.isInteger(anio) || anio < 1000 || anio > 9999) throw new Error(`Año inválido para el folio: ${anio}`);
  if (!Number.isInteger(secuencia) || secuencia < 1) throw new Error(`Secuencia inválida para el folio: ${secuencia}`);
  return `KV-${anio}-${String(secuencia).padStart(3, '0')}`;
}

/**
 * Siguiente folio del año: la secuencia más alta ya usada ese año + 1 (no rellena huecos, para no reutilizar nunca un folio).
 * Ignora folios de otros años, de demostración o con formato inválido. La secuencia reinicia cada año.
 * El dominio SUGIERE; la unicidad definitiva la garantiza la base de datos (restricción UNIQUE sobre el folio): si dos personas
 * piden folio a la vez, quien pierda la carrera recibe un conflicto y debe pedir otro.
 */
export function siguienteFolio(existentes: readonly string[], anio: number): string {
  const maxima = existentes.reduce((m, f) => {
    const p = parsearFolio(f);
    return p && p.anio === anio ? Math.max(m, p.secuencia) : m;
  }, 0);
  return formatearFolio(anio, maxima + 1);
}

/** ¿Está libre el folio? Compara normalizado (sin distinguir mayúsculas ni espacios). */
export const folioDisponible = (folio: string, existentes: readonly string[]): boolean => {
  const f = normalizarFolio(folio);
  return !existentes.some((e) => normalizarFolio(e) === f);
};
