import type { AccionAcordada } from '../acciones/accion';

/** Meta semanal: PAER estrictamente mayor a 90 %. */
export const META_PAER_PORCENTAJE = 90;

export interface ResultadoPaer {
  total: number;
  completadas: number;
  /** 0–100 con un decimal; null si no hubo acciones acordadas (evita un 0 % falso). */
  porcentaje: number | null;
}

/**
 * PAER (Porcentaje de Acciones Efectivamente Realizadas) =
 * acciones acordadas completadas / total de acciones acordadas × 100.
 * Con `semana` se limita a esa sesión semanal; sin ella es acumulado. Pendientes y no realizadas cuentan en el total.
 */
export function calcularPaer(acciones: readonly AccionAcordada[], semana?: string): ResultadoPaer {
  const consideradas = semana === undefined ? acciones : acciones.filter((a) => a.semana === semana);
  const completadas = consideradas.filter((a) => a.estado === 'completada').length;
  return {
    total: consideradas.length,
    completadas,
    porcentaje: consideradas.length === 0 ? null : Math.round((completadas / consideradas.length) * 1000) / 10,
  };
}

export interface PaerSemanal {
  semana: string;
  resultado: ResultadoPaer;
}

/** PAER por cada semana con acciones, de la más antigua a la más reciente. */
export function paerPorSemana(acciones: readonly AccionAcordada[]): PaerSemanal[] {
  return [...new Set(acciones.map((a) => a.semana))]
    .sort()
    .map((semana) => ({ semana, resultado: calcularPaer(acciones, semana) }));
}

export function cumpleMetaPaer(r: ResultadoPaer): boolean | null {
  return r.porcentaje === null ? null : r.porcentaje > META_PAER_PORCENTAJE;
}

/**
 * PAER de un periodo: acumula las acciones de todas las sesiones semanales entre `desde` y `hasta` (ISO, ambas incluidas).
 * Es el cociente de los totales, no el promedio de los porcentajes semanales (una semana con más acciones pesa más).
 */
export function calcularPaerPeriodo(acciones: readonly AccionAcordada[], desde: string, hasta: string): ResultadoPaer {
  const dentro = acciones.filter((a) => a.semana >= desde && a.semana <= hasta);
  const completadas = dentro.filter((a) => a.estado === 'completada').length;
  return {
    total: dentro.length,
    completadas,
    porcentaje: dentro.length === 0 ? null : Math.round((completadas / dentro.length) * 1000) / 10,
  };
}
