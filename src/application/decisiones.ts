import type { AprobacionCompuerta } from '@/domain/compuertas/aprobacion';
import type { Compuerta, CompuertaId, EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { crearEventoAuditoria, type EventoAuditoria } from '@/domain/entidades/evento-auditoria';
import {
  debeReabrirse, observacionDesdeValidacion, resolverObservacion, type ContextoResolucion,
} from '@/domain/observaciones/resolucion';
import type { Observacion, ResolucionObservacion } from '@/domain/observaciones/observacion';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import type { ResultadoValidacion } from '@/domain/reglas/tipos';

/**
 * Decisiones HUMANAS tomadas en KairóVolt sobre un proyecto, encima de lo que trae la fuente de datos:
 * observaciones registradas, responsables, resoluciones, cambios de estado de compuertas y aprobaciones.
 * Nunca modifican datos técnicos ni documentos. Cada una deja un evento de auditoría.
 */
export interface DecisionesProyecto {
  /** Observaciones registradas desde KairóVolt (no existen en la fuente). */
  observaciones: Observacion[];
  /** Cambios sobre observaciones que vienen de la fuente. */
  cambios: Record<string, CambioObservacion>;
  estadosCompuerta: Partial<Record<CompuertaId, EstadoCompuerta>>;
  aprobaciones: AprobacionCompuerta[];
  eventos: EventoAuditoria[];
}

export type CambioObservacion = Partial<Pick<Observacion, 'responsable' | 'fechaCompromiso' | 'estado' | 'resolucion'>>;

export const decisionesVacias = (): DecisionesProyecto => ({ observaciones: [], cambios: {}, estadosCompuerta: {}, aprobaciones: [], eventos: [] });

export const hayDecisiones = (d: DecisionesProyecto): boolean =>
  d.observaciones.length > 0 || d.eventos.length > 0 || Object.keys(d.cambios).length > 0 || Object.keys(d.estadosCompuerta).length > 0 || d.aprobaciones.length > 0;

/** Puerto de persistencia. Hoy solo hay una implementación local (navegador): no existe aún una tabla de decisiones en el backend. */
export interface DecisionesRepositorio {
  readonly almacenamiento: 'local';
  cargar(folio: string): Promise<DecisionesProyecto>;
  guardar(folio: string, decisiones: DecisionesProyecto): Promise<void>;
}

export interface ActorDecision { uid: string | null; nombre: string }

export interface ContextoDecision {
  /** ISO YYYY-MM-DD. */
  hoy: string;
  /** ISO con hora. */
  ahora: string;
  nuevoId: () => string;
  actor: ActorDecision;
  folio: string;
}

export class ErrorDecision extends Error {
  constructor(readonly motivos: string[]) {
    super(motivos.join(' '));
  }
}

const evento = (ctx: ContextoDecision, accion: string, entidad: string, entidadId: string | null, detalles: Record<string, unknown>): EventoAuditoria =>
  crearEventoAuditoria({ actorUserId: ctx.actor.uid, entidad, entidadId, folio: ctx.folio, accion, detalles: { ...detalles, actor: ctx.actor.nombre } }, ctx.nuevoId(), ctx.ahora);

/** Observaciones tal como quedan tras aplicar las decisiones (las de la fuente + las registradas aquí). */
export function observacionesEfectivas(base: readonly Observacion[], d: DecisionesProyecto): Observacion[] {
  return [...base.map((o) => ({ ...o, ...d.cambios[o.id] })), ...d.observaciones];
}

/** Proyecto con las decisiones aplicadas. No muta el original. */
export function aplicarDecisiones(p: Proyecto, d: DecisionesProyecto): Proyecto {
  const compuertas: Compuerta[] = p.compuertas.map((c) => ({ ...c, estado: d.estadosCompuerta[c.id] ?? c.estado }));
  return { ...p, compuertas, observaciones: observacionesEfectivas(p.observaciones, d), aprobaciones: [...(p.aprobaciones ?? []), ...d.aprobaciones] };
}

/** Aprobación vigente de una compuerta (la más reciente), si hay. */
export const aprobacionDe = (p: Proyecto, compuerta: CompuertaId): AprobacionCompuerta | null =>
  [...(p.aprobaciones ?? [])].filter((a) => a.compuerta === compuerta).sort((a, b) => b.fecha.localeCompare(a.fecha)).at(0) ?? null;

const reemplazar = (d: DecisionesProyecto, id: string, cambio: CambioObservacion): DecisionesProyecto =>
  d.observaciones.some((o) => o.id === id)
    ? { ...d, observaciones: d.observaciones.map((o) => (o.id === id ? { ...o, ...cambio } : o)) }
    : { ...d, cambios: { ...d.cambios, [id]: { ...d.cambios[id], ...cambio } } };

/**
 * Registra una observación a partir de un fallo de validación. Es una decisión de una persona (el sistema no la crea solo).
 * Si ya hay una observación abierta para esa misma validación, la devuelve (no duplica).
 */
export function registrarObservacion(
  d: DecisionesProyecto, efectivas: readonly Observacion[], r: ResultadoValidacion, ctx: ContextoDecision,
  opciones: { responsable?: string | null; fechaCompromiso?: string | null } = {},
): { decisiones: DecisionesProyecto; observacion: Observacion; creada: boolean } {
  const existente = efectivas.find((o) => o.origenValidacion?.huella === r.huella && o.estado !== 'cerrada');
  if (existente) return { decisiones: d, observacion: existente, creada: false };
  const base = observacionDesdeValidacion(r, { id: `kv-${ctx.nuevoId().slice(0, 8)}`, hoy: ctx.hoy, responsable: opciones.responsable?.trim() || null });
  if (!base) throw new ErrorDecision(['Solo se puede registrar una observación para una validación que no cumple.']);
  const observacion: Observacion = { ...base, fechaCompromiso: opciones.fechaCompromiso ?? null };
  return {
    decisiones: {
      ...d, observaciones: [...d.observaciones, observacion],
      eventos: [...d.eventos, evento(ctx, 'observacion_registrada', 'observacion', observacion.id, { reglaId: r.reglaId, huella: r.huella, compuerta: observacion.compuerta, severidad: r.severidad })],
    },
    observacion, creada: true,
  };
}

/** Asigna (o cambia) el responsable y, si se da, la fecha comprometida de una observación abierta. */
export function asignarResponsable(
  d: DecisionesProyecto, obs: Observacion, responsable: string, fechaCompromiso: string | null, ctx: ContextoDecision,
): DecisionesProyecto {
  const motivos: string[] = [];
  if (responsable.trim() === '') motivos.push('Indica quién será el responsable.');
  if (fechaCompromiso !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCompromiso)) motivos.push('La fecha comprometida no es válida (AAAA-MM-DD).');
  if (obs.estado === 'cerrada') motivos.push('La observación está cerrada: reábrela antes de reasignarla.');
  if (motivos.length > 0) throw new ErrorDecision(motivos);
  const cambio: CambioObservacion = { responsable: responsable.trim(), ...(fechaCompromiso !== null && { fechaCompromiso }), ...(obs.estado === 'abierta' && { estado: 'en_atencion' as const }) };
  const nuevo = reemplazar(d, obs.id, cambio);
  return {
    ...nuevo,
    eventos: [...nuevo.eventos, evento(ctx, 'responsable_asignado', 'observacion', obs.id, { responsable: responsable.trim(), fechaCompromiso, anterior: obs.responsable, compuerta: obs.compuerta })],
  };
}

/**
 * Registra la resolución de una observación aplicando las reglas del dominio (`resolverObservacion`).
 * Lanza `ErrorDecision` con todos los motivos si no procede.
 */
export function registrarResolucion(
  d: DecisionesProyecto, obs: Observacion, resolucion: ResolucionObservacion, contexto: ContextoResolucion, ctx: ContextoDecision,
): DecisionesProyecto {
  const r = resolverObservacion(obs, resolucion, contexto, { id: ctx.nuevoId(), creadoEn: ctx.ahora, actorUserId: ctx.actor.uid, folio: ctx.folio });
  if (!r.ok) throw new ErrorDecision(r.motivos);
  const nuevo = reemplazar(d, obs.id, { estado: 'cerrada', resolucion: r.observacion.resolucion ?? null });
  return { ...nuevo, eventos: [...nuevo.eventos, { ...r.evento, detalles: { ...r.evento.detalles, actor: ctx.actor.nombre } }] };
}

/** Reabre las observaciones cerradas cuyo problema reapareció tras revalidar. Devuelve la MISMA referencia si no hubo cambios. */
export function reabrirSiReaparece(d: DecisionesProyecto, efectivas: readonly Observacion[], resultados: readonly ResultadoValidacion[], ctx: ContextoDecision): DecisionesProyecto {
  let nuevo = d;
  for (const o of efectivas) {
    if (!debeReabrirse(o, resultados)) continue;
    nuevo = reemplazar(nuevo, o.id, { estado: 'abierta', resolucion: null });
    nuevo = { ...nuevo, eventos: [...nuevo.eventos, evento(ctx, 'observacion_reabierta', 'observacion', o.id, { reglaId: o.origenValidacion?.reglaId ?? null, compuerta: o.compuerta })] };
  }
  return nuevo;
}

/** Registra el cambio de estado de una compuerta (ya validado con `evaluarTransicionCompuerta`) y, si se libera, quién la aprobó. */
export function registrarCambioCompuerta(
  d: DecisionesProyecto, c: { compuerta: CompuertaId; de: EstadoCompuerta; a: EstadoCompuerta; comentario?: string | null }, ctx: ContextoDecision,
): DecisionesProyecto {
  const aprobaciones = c.a === 'liberada'
    ? [...d.aprobaciones, { compuerta: c.compuerta, aprobadoPor: ctx.actor.nombre, fecha: ctx.hoy, comentario: c.comentario?.trim() || null }]
    : d.aprobaciones;
  return {
    ...d,
    estadosCompuerta: { ...d.estadosCompuerta, [c.compuerta]: c.a },
    aprobaciones,
    eventos: [...d.eventos, evento(ctx, c.a === 'liberada' ? 'compuerta_liberada' : 'compuerta_estado_cambiado', 'compuerta', c.compuerta, { de: c.de, a: c.a, comentario: c.comentario?.trim() || null })],
  };
}
