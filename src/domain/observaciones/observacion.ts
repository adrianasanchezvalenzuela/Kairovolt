import type { CompuertaId } from '../compuertas/compuerta';
import { diasEntre } from '../fechas/fechas';
import type { Severidad } from '../reglas/tipos';

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
  /** Severidad cuando la observación nació de una validación. Las que vienen de Zoho no la traen. */
  severidad?: Severidad;
  /** Regla y huella de la validación que originó la observación (para revalidar y detectar que el problema reaparece). */
  origenValidacion?: { reglaId: string; huella: string } | null;
  /** Cómo se resolvió, cuando está cerrada (ver `resolucion.ts`). */
  resolucion?: ResolucionObservacion | null;
}

export type TipoResolucion = 'corregido' | 'aceptado_con_justificacion' | 'no_aplica';

export const ETIQUETA_RESOLUCION: Record<TipoResolucion, string> = { corregido: 'corregido', aceptado_con_justificacion: 'aceptado con justificación', no_aplica: 'no aplica' };

/** Decisión HUMANA que cierra una observación. Nunca la produce el sistema por su cuenta. */
export interface ResolucionObservacion {
  tipo: TipoResolucion;
  justificacion: string;
  responsable: string;
  /** ISO YYYY-MM-DD. */
  fecha: string;
  evidenciaDocumentoId?: string | null;
  /** Valor contradictorio que se aprobó como excepción: si cambia, la excepción deja de valer y la observación se reabre. */
  valorAprobado?: string | number | null;
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
