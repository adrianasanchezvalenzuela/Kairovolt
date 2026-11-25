import type { Proyecto } from '@/domain/proyecto/proyecto';
import type { EventoAuditoria } from '@/domain/entidades/evento-auditoria';
import { ETIQUETA_RESOLUCION, type TipoResolucion } from '@/domain/observaciones/observacion';
import type { DecisionesProyecto } from './decisiones';

export type TipoEventoHistorial = 'actividad' | 'observacion' | 'resolucion' | 'compuerta' | 'decision';

export interface EventoHistorial {
  id: string;
  /** ISO YYYY-MM-DD (o con hora si viene de un evento). */
  fecha: string;
  tipo: TipoEventoHistorial;
  titulo: string;
  detalle?: string;
  /** Quién lo hizo, si se sabe. */
  actor?: string | null;
  tono: 'ok' | 'alerta' | 'error' | 'info' | 'neutro';
}

const ETIQUETA_ACCION: Record<string, { titulo: string; tono: EventoHistorial['tono'] }> = {
  observacion_registrada: { titulo: 'Observación registrada', tono: 'info' },
  responsable_asignado: { titulo: 'Responsable asignado', tono: 'info' },
  observacion_resuelta: { titulo: 'Observación resuelta', tono: 'ok' },
  excepcion_aprobada: { titulo: 'Excepción aprobada', tono: 'alerta' },
  observacion_reabierta: { titulo: 'Observación reabierta (el problema reapareció)', tono: 'error' },
  compuerta_liberada: { titulo: 'Compuerta liberada', tono: 'ok' },
  compuerta_estado_cambiado: { titulo: 'Cambio de estado de compuerta', tono: 'info' },
};

const detalleDe = (e: EventoAuditoria): string | undefined => {
  const d = e.detalles;
  const partes: string[] = [];
  if (typeof d.compuerta === 'string') partes.push(d.compuerta);
  if (typeof d.de === 'string' && typeof d.a === 'string') partes.push(`${d.de} → ${d.a}`);
  if (typeof d.responsable === 'string') partes.push(`responsable: ${d.responsable}`);
  if (typeof d.tipo === 'string') partes.push(`tipo: ${ETIQUETA_RESOLUCION[d.tipo as TipoResolucion] ?? d.tipo}`);
  if (typeof d.comentario === 'string' && d.comentario) partes.push(d.comentario);
  return partes.length > 0 ? partes.join(' · ') : undefined;
};

/**
 * Historial del proyecto, de lo más reciente a lo más antiguo: lo que ocurrió en la fuente (actividades terminadas, observaciones,
 * resoluciones, aprobaciones) y lo decidido en KairóVolt (auditoría local). Solo lee: no inventa eventos.
 */
export function historialProyecto(p: Proyecto, d: DecisionesProyecto): EventoHistorial[] {
  const eventos: EventoHistorial[] = [];
  for (const a of p.cronograma) {
    if (a.finReal) eventos.push({ id: `act:${a.id}`, fecha: a.finReal, tipo: 'actividad', titulo: `Actividad terminada: ${a.nombre}`, detalle: `${a.compuerta}${a.finReal > a.finPlan ? ` · terminó después de lo planeado (${a.finPlan})` : ''}`, actor: a.responsable, tono: a.finReal > a.finPlan ? 'alerta' : 'ok' });
  }
  const idsDeEventos = new Set(d.eventos.filter((e) => e.entidad === 'observacion').map((e) => e.entidadId));
  for (const o of p.observaciones) {
    // Lo registrado en KairóVolt ya tiene su evento de auditoría: no se repite.
    if (!idsDeEventos.has(o.id)) {
      eventos.push({ id: `obs:${o.id}`, fecha: o.fechaRegistro, tipo: 'observacion', titulo: `Observación registrada (${o.origen.toUpperCase()}, ${o.compuerta})`, detalle: o.descripcion, actor: null, tono: 'info' });
      if (o.resolucion) eventos.push({ id: `res:${o.id}`, fecha: o.resolucion.fecha, tipo: 'resolucion', titulo: 'Observación resuelta', detalle: `${ETIQUETA_RESOLUCION[o.resolucion.tipo]}: ${o.resolucion.justificacion}`, actor: o.resolucion.responsable, tono: 'ok' });
    }
  }
  for (const a of p.aprobaciones ?? []) {
    if (!d.aprobaciones.includes(a)) eventos.push({ id: `apr:${a.compuerta}:${a.fecha}`, fecha: a.fecha, tipo: 'compuerta', titulo: `${a.compuerta} liberada`, detalle: a.comentario ?? undefined, actor: a.aprobadoPor, tono: 'ok' });
  }
  for (const e of d.eventos) {
    const etiqueta = ETIQUETA_ACCION[e.accion] ?? { titulo: e.accion.replaceAll('_', ' '), tono: 'neutro' as const };
    const detalle = detalleDe(e);
    eventos.push({ id: e.id, fecha: e.creadoEn, tipo: e.entidad === 'compuerta' ? 'compuerta' : 'decision', titulo: etiqueta.titulo, ...(detalle !== undefined && { detalle }), actor: typeof e.detalles.actor === 'string' ? e.detalles.actor : null, tono: etiqueta.tono });
  }
  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
}
