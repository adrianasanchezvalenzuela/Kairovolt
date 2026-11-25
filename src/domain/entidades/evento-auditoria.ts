export type OrigenEvento = 'app' | 'zoho' | 'system' | 'storage' | 'portal';

/** Evento de auditoría (append-only). Nunca lleva contraseñas, tokens ni contenido privado en `detalles`. */
export interface EventoAuditoria {
  id: string;
  actorUserId: string | null;
  origen: OrigenEvento;
  entidad: string;
  entidadId: string | null;
  folio: string | null;
  accion: string;
  detalles: Record<string, unknown>;
  /** Instante ISO. */
  creadoEn: string;
}

/** Acciones que generan las reglas del dominio. */
export const ACCIONES_AUDITORIA = {
  validacionEjecutada: 'validacion_ejecutada',
  observacionResuelta: 'observacion_resuelta',
  observacionReabierta: 'observacion_reabierta',
  compuertaBloqueada: 'compuerta_bloqueada',
  excepcionAprobada: 'excepcion_aprobada',
} as const;

export interface DatosEvento {
  actorUserId?: string | null;
  origen?: OrigenEvento;
  entidad: string;
  entidadId?: string | null;
  folio?: string | null;
  accion: string;
  detalles?: Record<string, unknown>;
}

/** Construye un evento (puro: el id y la hora los pone quien llama, para que sea determinista y fácil de probar). */
export function crearEventoAuditoria(d: DatosEvento, id: string, creadoEn: string): EventoAuditoria {
  return {
    id,
    actorUserId: d.actorUserId ?? null,
    origen: d.origen ?? 'app',
    entidad: d.entidad,
    entidadId: d.entidadId ?? null,
    folio: d.folio ?? null,
    accion: d.accion,
    detalles: d.detalles ?? {},
    creadoEn,
  };
}
