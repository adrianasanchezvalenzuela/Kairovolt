import type { CompuertaId } from '../compuertas/compuerta';
import { ACCIONES_AUDITORIA, crearEventoAuditoria, type EventoAuditoria } from '../entidades/evento-auditoria';
import type { ResultadoValidacion } from '../reglas/tipos';
import type { EstadoObservacion, Observacion, ResolucionObservacion } from './observacion';

/** Estados permitidos: abierta ⇄ en atención → cerrada; una cerrada solo se puede reabrir. */
export const TRANSICIONES: Record<EstadoObservacion, readonly EstadoObservacion[]> = {
  abierta: ['en_atencion', 'cerrada'],
  en_atencion: ['abierta', 'cerrada'],
  cerrada: ['abierta'],
};

export const puedeTransicionar = (de: EstadoObservacion, a: EstadoObservacion): boolean => TRANSICIONES[de].includes(a);

export const MIN_CARACTERES_JUSTIFICACION = 10;

export interface ContextoResolucion {
  /** Resultado actual de la regla que originó la observación, ya REVALIDADO tras la corrección. */
  validacionActual?: ResultadoValidacion | null;
  /** Resultado original (para saber si exigía aprobación humana). Si falta, se usa `validacionActual`. */
  validacionOrigen?: ResultadoValidacion | null;
  /** ¿Quien resuelve tiene permiso de aprobar excepciones? (la matriz de permisos la decide quien llama) */
  actorPuedeAprobar: boolean;
}

export type DecisionResolucion = { ok: true } | { ok: false; motivos: string[] };

/**
 * Reglas para cerrar una observación:
 *  - hace falta responsable, fecha y una justificación;
 *  - si nació de una validación, «corregido» exige que al REVALIDAR ya cumpla;
 *  - si esa validación exige aprobación humana, «aceptado con justificación» y «no aplica» solo los puede hacer quien tenga permiso.
 * Cerrar una observación NUNCA modifica ningún dato técnico.
 */
export function evaluarResolucion(obs: Observacion, r: ResolucionObservacion, ctx: ContextoResolucion): DecisionResolucion {
  const motivos: string[] = [];
  if (obs.estado === 'cerrada') motivos.push('La observación ya está cerrada.');
  if (r.responsable.trim() === '') motivos.push('Indica quién resuelve la observación.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) motivos.push('La fecha de resolución no es válida (AAAA-MM-DD).');
  if (r.justificacion.trim().length < MIN_CARACTERES_JUSTIFICACION) motivos.push(`La justificación debe tener al menos ${MIN_CARACTERES_JUSTIFICACION} caracteres.`);

  if (obs.origenValidacion) {
    const origen = ctx.validacionOrigen ?? ctx.validacionActual ?? null;
    if (r.tipo === 'corregido') {
      const actual = ctx.validacionActual;
      if (!actual) motivos.push('Para cerrar como «corregido» hay que revalidar el expediente.');
      else if (actual.resultado === 'no_cumple') motivos.push(`La validación ${obs.origenValidacion.reglaId} sigue sin cumplirse: no se puede cerrar como corregida. Si se aprueba como excepción, usa «aceptado con justificación».`);
      else if (actual.resultado === 'no_evaluable') motivos.push(`La validación ${obs.origenValidacion.reglaId} no se pudo evaluar tras la corrección: faltan datos.`);
    } else if ((origen === null || origen.requiereAprobacionHumana) && !ctx.actorPuedeAprobar) {
      motivos.push('Esta excepción requiere aprobación de un rol autorizado.');
    }
  }
  return motivos.length === 0 ? { ok: true } : { ok: false, motivos };
}

export interface DatosEventoResolucion {
  id: string;
  creadoEn: string;
  actorUserId?: string | null;
  folio?: string | null;
}

export type ResultadoResolucion = { ok: true; observacion: Observacion; evento: EventoAuditoria } | { ok: false; motivos: string[] };

/** Cierra la observación (devuelve una copia; no muta la original) y genera su evento de auditoría. */
export function resolverObservacion(obs: Observacion, r: ResolucionObservacion, ctx: ContextoResolucion, ev: DatosEventoResolucion): ResultadoResolucion {
  const decision = evaluarResolucion(obs, r, ctx);
  if (!decision.ok) return decision;
  const esExcepcion = obs.origenValidacion != null && r.tipo !== 'corregido';
  return {
    ok: true,
    observacion: { ...obs, estado: 'cerrada', resolucion: { ...r, valorAprobado: esExcepcion ? (ctx.validacionActual?.valorEncontrado ?? r.valorAprobado ?? null) : null } },
    evento: crearEventoAuditoria({
      actorUserId: ev.actorUserId ?? null, entidad: 'observacion', entidadId: obs.id, folio: ev.folio ?? null,
      accion: esExcepcion ? ACCIONES_AUDITORIA.excepcionAprobada : ACCIONES_AUDITORIA.observacionResuelta,
      detalles: { tipo: r.tipo, compuerta: obs.compuerta, reglaId: obs.origenValidacion?.reglaId ?? null, responsable: r.responsable },
    }, ev.id, ev.creadoEn),
  };
}

/** Construye (sin guardar) la observación que corresponde a un fallo de validación. Un humano decide si se registra. */
export function observacionDesdeValidacion(
  r: ResultadoValidacion, datos: { id: string; hoy: string; responsable?: string | null; compuertaPorDefecto?: CompuertaId },
): Observacion | null {
  if (r.resultado !== 'no_cumple') return null;
  return {
    id: datos.id, origen: 'interna', compuerta: r.compuerta ?? datos.compuertaPorDefecto ?? 'G2',
    descripcion: `${r.reglaNombre}: ${r.explicacion}`, estado: 'abierta', fechaRegistro: datos.hoy, fechaCompromiso: null,
    responsable: datos.responsable ?? null, severidad: r.severidad, origenValidacion: { reglaId: r.reglaId, huella: r.huella },
  };
}

/**
 * ¿Una observación cerrada debe reabrirse? Sí si el problema reaparece:
 *  - «corregido»: la validación vuelve a fallar;
 *  - excepción aprobada: el valor contradictorio cambió respecto al que se aprobó (la aprobación era solo para ese caso).
 */
export function debeReabrirse(obs: Observacion, resultados: readonly ResultadoValidacion[]): boolean {
  if (obs.estado !== 'cerrada' || !obs.origenValidacion || !obs.resolucion) return false;
  const actual = resultados.find((x) => x.huella === obs.origenValidacion!.huella);
  if (!actual || actual.resultado !== 'no_cumple') return false;
  if (obs.resolucion.tipo === 'corregido') return true;
  return obs.resolucion.valorAprobado !== undefined && obs.resolucion.valorAprobado !== null && actual.valorEncontrado !== obs.resolucion.valorAprobado;
}

/** Reabre las que corresponda y genera sus eventos. No muta la lista original. */
export function reabrirObservaciones(
  observaciones: readonly Observacion[], resultados: readonly ResultadoValidacion[], fabrica: (obs: Observacion) => DatosEventoResolucion,
): { observaciones: Observacion[]; eventos: EventoAuditoria[] } {
  const eventos: EventoAuditoria[] = [];
  const nuevas = observaciones.map((o) => {
    if (!debeReabrirse(o, resultados)) return o;
    const ev = fabrica(o);
    eventos.push(crearEventoAuditoria({
      actorUserId: ev.actorUserId ?? null, origen: 'system', entidad: 'observacion', entidadId: o.id, folio: ev.folio ?? null,
      accion: ACCIONES_AUDITORIA.observacionReabierta, detalles: { reglaId: o.origenValidacion?.reglaId ?? null, compuerta: o.compuerta },
    }, ev.id, ev.creadoEn));
    return { ...o, estado: 'abierta' as const, resolucion: null };
  });
  return { observaciones: nuevas, eventos };
}

/** Huellas de validaciones con una EXCEPCIÓN aprobada vigente (observación cerrada como aceptada / no aplica para ese valor). */
export function excepcionesVigentes(observaciones: readonly Observacion[], resultados: readonly ResultadoValidacion[]): Set<string> {
  const huellas = new Set<string>();
  for (const o of observaciones) {
    const r = o.resolucion;
    if (o.estado !== 'cerrada' || !o.origenValidacion || !r || r.tipo === 'corregido') continue;
    const actual = resultados.find((x) => x.huella === o.origenValidacion!.huella);
    if (!actual) { huellas.add(o.origenValidacion.huella); continue; }
    const mismoValor = r.valorAprobado === undefined || r.valorAprobado === null || actual.valorEncontrado === r.valorAprobado;
    if (mismoValor) huellas.add(o.origenValidacion.huella);
  }
  return huellas;
}
