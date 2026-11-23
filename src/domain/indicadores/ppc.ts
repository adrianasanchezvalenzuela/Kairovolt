import type { Actividad } from '../cronograma/actividad';
import { diasEntre } from '../fechas/fechas';

export interface ResultadoPpc {
  planeadas: number;
  cumplidas: number;
  /** 0–100 con un decimal; null si no había actividades planeadas en el periodo. */
  porcentaje: number | null;
}

/**
 * PPC (Porcentaje de Plan Cumplido): de las actividades cuyo fin planeado cae en el periodo
 * [desde, hasta], la proporción terminada en o antes de su fecha fin planeada.
 * Sin `desde`, el periodo es acumulado hasta `hasta`. Una actividad terminada tarde NO cuenta como cumplida.
 */
export function calcularPpc(actividades: readonly Actividad[], hasta: string, desde?: string): ResultadoPpc {
  const planeadas = actividades.filter(
    (a) => diasEntre(a.finPlan, hasta) >= 0 && (desde === undefined || diasEntre(desde, a.finPlan) >= 0),
  );
  const cumplidas = planeadas.filter((a) => a.finReal !== null && diasEntre(a.finPlan, a.finReal) <= 0);
  return {
    planeadas: planeadas.length,
    cumplidas: cumplidas.length,
    porcentaje: planeadas.length === 0 ? null : Math.round((cumplidas.length / planeadas.length) * 1000) / 10,
  };
}
