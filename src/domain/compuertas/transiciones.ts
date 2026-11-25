import type { EstadoCompuerta, CompuertaId } from './compuerta';
import type { DecisionBloqueo } from './bloqueo';

/**
 * Cambios de estado permitidos para una compuerta:
 *  pendiente → en revisión (se solicita) → liberada; en cualquier momento se puede bloquear y desbloquear.
 * Una compuerta liberada es definitiva: reabrirla no es un cambio de estado normal (requiere una decisión fuera de este flujo).
 */
export const TRANSICIONES_COMPUERTA: Record<EstadoCompuerta, readonly EstadoCompuerta[]> = {
  pendiente: ['en_revision', 'bloqueada'],
  en_revision: ['pendiente', 'liberada', 'bloqueada'],
  bloqueada: ['pendiente', 'en_revision'],
  liberada: [],
};

/** Estados a los que se pasa «avanzando»: exigen que no haya ningún bloqueo (documentos, compuertas previas, validaciones…). */
const ESTADOS_QUE_EXIGEN_SIN_BLOQUEO: readonly EstadoCompuerta[] = ['en_revision', 'liberada'];

export interface EntradaTransicion {
  compuerta: CompuertaId;
  de: EstadoCompuerta;
  a: EstadoCompuerta;
  /** Bloqueos actuales de la compuerta (ver `evaluarBloqueoCompuerta`). */
  bloqueo: DecisionBloqueo;
  /** ¿Quien lo hace puede liberar compuertas? (lo decide la matriz de permisos, quien llama) */
  actorPuedeLiberar: boolean;
  /** Motivo escrito; obligatorio para bloquear. */
  motivo?: string | null;
}

export type DecisionTransicion = { ok: true } | { ok: false; motivos: string[] };

/** Valida un cambio de estado. Devuelve TODOS los motivos por los que no procede, no solo el primero. */
export function evaluarTransicionCompuerta(e: EntradaTransicion): DecisionTransicion {
  const motivos: string[] = [];
  if (e.de === e.a) motivos.push(`${e.compuerta} ya está en ese estado.`);
  else if (!TRANSICIONES_COMPUERTA[e.de].includes(e.a)) {
    motivos.push(e.de === 'liberada'
      ? `${e.compuerta} ya está liberada: no se puede cambiar su estado desde aquí.`
      : `No se puede pasar ${e.compuerta} de «${e.de}» a «${e.a}»${e.a === 'liberada' ? ': primero debe estar en revisión' : ''}.`);
  }

  if (motivos.length === 0 && ESTADOS_QUE_EXIGEN_SIN_BLOQUEO.includes(e.a)) {
    // «compuerta_liberada» solo describe el estado actual; aquí no es una razón para impedir el cambio.
    for (const r of e.bloqueo.razones) if (r.tipo !== 'compuerta_liberada') motivos.push(r.mensaje);
  }
  if (e.a === 'liberada' && !e.actorPuedeLiberar && motivos.length === 0) motivos.push('Tu rol no puede liberar compuertas.');
  if (e.a === 'bloqueada' && (e.motivo ?? '').trim().length < 5 && motivos.length === 0) motivos.push('Indica el motivo del bloqueo.');
  return motivos.length === 0 ? { ok: true } : { ok: false, motivos };
}

/** Estados a los que se podría pasar desde el actual (sin evaluar bloqueos); para ofrecer solo opciones coherentes. */
export const estadosSiguientes = (de: EstadoCompuerta): readonly EstadoCompuerta[] => TRANSICIONES_COMPUERTA[de];
