import type { CompuertaId } from '../compuertas/compuerta';
import { diasEntre } from '../fechas/fechas';

/** Fechas ISO (YYYY-MM-DD). `finReal` null = aún no terminada. */
export interface Actividad {
  id: string;
  nombre: string;
  compuerta: CompuertaId;
  inicioPlan: string;
  finPlan: string;
  finReal: string | null;
  responsable: string | null;
}

export type EstadoActividad = 'completada' | 'atrasada' | 'en_curso' | 'pendiente';

export interface ActividadEvaluada {
  actividad: Actividad;
  estado: EstadoActividad;
  /** Días de retraso (>0) respecto al fin planeado, tanto si ya terminó como si sigue abierta. */
  diasRetraso: number;
}

export function evaluarActividad(a: Actividad, hoy: string): ActividadEvaluada {
  if (a.finReal !== null) {
    return { actividad: a, estado: 'completada', diasRetraso: Math.max(0, diasEntre(a.finPlan, a.finReal)) };
  }
  if (diasEntre(a.finPlan, hoy) > 0) {
    return { actividad: a, estado: 'atrasada', diasRetraso: diasEntre(a.finPlan, hoy) };
  }
  const iniciada = diasEntre(a.inicioPlan, hoy) >= 0;
  return { actividad: a, estado: iniciada ? 'en_curso' : 'pendiente', diasRetraso: 0 };
}
