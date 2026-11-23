import type { CompuertaId } from '../compuertas/compuerta';
import { diasEntre } from '../fechas/fechas';

export type OrigenObservacion = 'cfe' | 'uvie' | 'interna';
export type EstadoObservacion = 'abierta' | 'en_atencion' | 'cerrada';

/** Fechas ISO (YYYY-MM-DD). `null` = no capturada. */
export interface Observacion {
  id: string;
  origen: OrigenObservacion;
  compuerta: CompuertaId;
  descripcion: string;
  estado: EstadoObservacion;
  fechaRegistro: string;
  /** Fecha comprometida de atención; null = sin compromiso (brecha de seguimiento). */
  fechaCompromiso: string | null;
  responsable: string | null;
}

export type SeguimientoObservacion = 'cerrada' | 'vencida' | 'sin_compromiso' | 'en_plazo';

export function seguimientoObservacion(o: Observacion, hoy: string): SeguimientoObservacion {
  if (o.estado === 'cerrada') return 'cerrada';
  if (o.fechaCompromiso === null) return 'sin_compromiso';
  return diasEntre(hoy, o.fechaCompromiso) < 0 ? 'vencida' : 'en_plazo';
}

export interface ResumenObservaciones {
  abiertas: number;
  vencidas: number;
  sinCompromiso: number;
}

export function resumirObservaciones(observaciones: readonly Observacion[], hoy: string): ResumenObservaciones {
  const seg = observaciones.map((o) => seguimientoObservacion(o, hoy));
  return {
    abiertas: seg.filter((s) => s !== 'cerrada').length,
    vencidas: seg.filter((s) => s === 'vencida').length,
    sinCompromiso: seg.filter((s) => s === 'sin_compromiso').length,
  };
}
