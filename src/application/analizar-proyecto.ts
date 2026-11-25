import { evaluarBloqueoCompuerta, validacionesPendientes, type DecisionBloqueo, type ValidacionPendiente } from '@/domain/compuertas/bloqueo';
import { ORDEN_COMPUERTAS, type CompuertaId } from '@/domain/compuertas/compuerta';
import {
  evaluarCarpetaFisica, evaluarChecklist, progresoGlobal, type CarpetaFisica, type Progreso, type Requisito, type ResumenCompuerta,
} from '@/domain/checklist/checklist';
import type { Observacion } from '@/domain/observaciones/observacion';
import { excepcionesVigentes } from '@/domain/observaciones/resolucion';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { ejecutarReglas, resumirValidacion, type ResumenValidacion } from '@/domain/reglas/motor';
import type { ConfiguracionReglas, ResultadoValidacion } from '@/domain/reglas/tipos';
import { calcularTiemposProceso, type TiemposProceso } from '@/domain/tiempos/tiempos';
import { seguimientoProyecto, type SeguimientoProyecto } from './seguimiento-proyecto';

export interface AnalisisProyecto {
  /** false = la fuente no trae el expediente: no hay validaciones ni checklist (no se inventan). */
  disponible: boolean;
  resultados: ResultadoValidacion[];
  resumen: ResumenValidacion;
  /** Fallos bloqueantes sin resolver ni excepción aprobada. */
  pendientes: ValidacionPendiente[];
  /** Huellas con una excepción aprobada vigente. */
  excepciones: ReadonlySet<string>;
  checklist: ResumenCompuerta[];
  progreso: Progreso;
  carpetaFisica: CarpetaFisica;
  bloqueos: Record<CompuertaId, DecisionBloqueo>;
  seguimiento: SeguimientoProyecto;
  /** null si el proyecto no trae hitos. */
  tiempos: TiemposProceso | null;
  /** Observación más relevante enlazada a cada validación (por huella): primero la abierta, si no la última. */
  vinculos: ReadonlyMap<string, Observacion>;
}

export interface OpcionesAnalisis {
  /** ISO YYYY-MM-DD. */
  hoy: string;
  requisitos: readonly Requisito[];
  config?: ConfiguracionReglas;
}

/**
 * Caso de uso: todo lo que la plataforma muestra de un proyecto, calculado con el motor de reglas y el dominio.
 * El proyecto debe venir con las decisiones ya aplicadas (`aplicarDecisiones`). No hay reglas aquí: solo se compone.
 */
export function analizarProyecto(p: Proyecto, { hoy, requisitos, config }: OpcionesAnalisis): AnalisisProyecto {
  const disponible = p.documentosDisponibles;
  const resultados = disponible
    ? ejecutarReglas({ hoy, documentos: p.documentos, configuracion: p.configuracionTecnica ?? null, requisitos,
      revisionDocumental: p.revisionDocumental }, config)
    : [];
  const checklist = disponible ? evaluarChecklist(requisitos, p.documentos) : [];
  const pendientes = validacionesPendientes(resultados, p.observaciones);
  const bloqueos = Object.fromEntries(
    ORDEN_COMPUERTAS.map((c) => [c, evaluarBloqueoCompuerta({
      compuerta: c, compuertas: p.compuertas, resumenes: checklist, validacionesBloqueantes: pendientes, observaciones: p.observaciones,
    })]),
  ) as Record<CompuertaId, DecisionBloqueo>;

  const vinculos = new Map<string, Observacion>();
  for (const o of p.observaciones) {
    const h = o.origenValidacion?.huella;
    if (!h) continue;
    const actual = vinculos.get(h);
    if (!actual || (actual.estado === 'cerrada' && o.estado !== 'cerrada') || (actual.estado === o.estado && o.fechaRegistro >= actual.fechaRegistro)) vinculos.set(h, o);
  }

  return {
    disponible, resultados, resumen: resumirValidacion(resultados), pendientes, excepciones: excepcionesVigentes(p.observaciones, resultados),
    checklist, progreso: progresoGlobal(checklist), carpetaFisica: evaluarCarpetaFisica(checklist), bloqueos,
    seguimiento: seguimientoProyecto(p, hoy),
    tiempos: p.hitos && p.hitos.length > 0 ? calcularTiemposProceso(p.hitos, hoy) : null,
    vinculos,
  };
}

export const hoyIso = (): string => new Date().toISOString().slice(0, 10);

/** Ids de los documentos cuya vigencia está vencida (resultados VIG-001 que no cumplen). */
export function documentosVencidos(a: AnalisisProyecto): ReadonlySet<string> {
  return new Set(a.resultados.filter((r) => r.reglaId === 'VIG-001' && r.resultado === 'no_cumple').flatMap((r) => r.documentosOrigen.map((d) => d.id)));
}
