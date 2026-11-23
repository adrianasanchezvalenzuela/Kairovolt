import type { ClienteSupabase } from './cliente';

/** Quién hizo la acción: un usuario de Supabase o el token de emergencia. */
export interface ActorAuditoria {
  via: 'token' | 'supabase';
  uid: string | null;
  correo: string | null;
}

export interface EventoAuditoria {
  entidad: string;
  entidadId?: string | null;
  folio?: string | null;
  accion: string;
  detalles?: Record<string, unknown>;
}

/**
 * Registra un evento en `auditoria_eventos` (append-only). Mejor esfuerzo: un fallo de auditoría no deshace la operación,
 * pero devuelve false para que se reporte. NUNCA recibir contraseñas ni tokens en `detalles`.
 */
export async function registrarEvento(cli: ClienteSupabase, actor: ActorAuditoria, e: EventoAuditoria): Promise<boolean> {
  try {
    await cli.rest('POST', '/auditoria_eventos', {
      actor_user_id: actor.uid,
      origen: 'app',
      entidad: e.entidad,
      entidad_id: e.entidadId ?? null,
      folio: e.folio ?? null,
      accion: e.accion,
      detalles: { ...e.detalles, actor: actor.via === 'token' ? 'token_emergencia' : actor.correo ?? 'usuario' },
    });
    return true;
  } catch {
    return false;
  }
}
