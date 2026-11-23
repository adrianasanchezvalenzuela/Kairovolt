import type { Proyecto } from '@/domain/proyecto/proyecto';
import { evaluarActividad, type ActividadEvaluada } from '@/domain/cronograma/actividad';
import { paerPorSemana, type PaerSemanal } from '@/domain/indicadores/paer';
import { calcularPpc, type ResultadoPpc } from '@/domain/indicadores/ppc';
import { resumirObservaciones, seguimientoObservacion, type Observacion, type ResumenObservaciones, type SeguimientoObservacion } from '@/domain/observaciones/observacion';

export interface SeguimientoProyecto {
  observaciones: { observacion: Observacion; seguimiento: SeguimientoObservacion }[];
  resumenObservaciones: ResumenObservaciones;
  actividades: ActividadEvaluada[];
  ppc: ResultadoPpc;
  /** PAER por semana con acciones; la última es la sesión más reciente. */
  paerSemanal: PaerSemanal[];
}

/** Caso de uso: observaciones, cronograma e indicadores del proyecto a la fecha `hoy` (ISO). */
export function seguimientoProyecto(proyecto: Proyecto, hoy: string): SeguimientoProyecto {
  return {
    observaciones: proyecto.observaciones.map((observacion) => ({ observacion, seguimiento: seguimientoObservacion(observacion, hoy) })),
    resumenObservaciones: resumirObservaciones(proyecto.observaciones, hoy),
    actividades: proyecto.cronograma.map((a) => evaluarActividad(a, hoy)),
    ppc: calcularPpc(proyecto.cronograma, hoy),
    paerSemanal: paerPorSemana(proyecto.acciones),
  };
}
