import { validarContrasena } from '../../src/domain/usuarios/credenciales';
import type { SupabaseConfig } from '../config';
import { registrarEvento, type ActorAuditoria } from './auditoria';
import { SupabaseError, type ClienteSupabase, type FetchFn } from './cliente';
import { autenticarConContrasena } from './login';

export type CodigoCuenta = 'sin_cuenta' | 'contrasena_actual_incorrecta' | 'contrasena_debil' | 'misma_contrasena';

export class CuentaError extends Error {
  constructor(readonly codigo: CodigoCuenta, message: string) {
    super(message);
    this.name = 'CuentaError';
  }
}

/**
 * Cambia la contraseña de la PROPIA cuenta. Exige la contraseña actual (se comprueba contra Supabase) para que una
 * cookie robada no baste para tomar la cuenta. Supabase guarda solo el hash; nada se registra salvo el hecho del cambio.
 */
export async function cambiarMiContrasena(
  cli: ClienteSupabase, cfg: SupabaseConfig, fetchFn: FetchFn, actor: ActorAuditoria,
  datos: { actual: string; nueva: string },
): Promise<{ auditado: boolean }> {
  if (actor.via !== 'supabase' || !actor.uid || !actor.correo) {
    throw new CuentaError('sin_cuenta', 'La sesión de emergencia no tiene una cuenta con contraseña.');
  }
  const problema = validarContrasena(datos.nueva);
  if (problema) throw new CuentaError('contrasena_debil', problema);
  if (datos.nueva === datos.actual) throw new CuentaError('misma_contrasena', 'La contraseña nueva debe ser distinta de la actual.');

  const identidad = await autenticarConContrasena(cfg, fetchFn, actor.correo, datos.actual);
  if (!identidad || identidad.id !== actor.uid) throw new CuentaError('contrasena_actual_incorrecta', 'La contraseña actual no es correcta.');

  try {
    await cli.auth('PUT', `/admin/users/${actor.uid}`, { password: datos.nueva });
  } catch (e) {
    if (e instanceof SupabaseError && (e.codigo === 'weak_password' || e.status === 422)) throw new CuentaError('contrasena_debil', 'Supabase rechazó la contraseña por débil.');
    throw e;
  }
  const auditado = await registrarEvento(cli, actor, { entidad: 'usuario', entidadId: actor.uid, accion: 'contrasena_cambiada' });
  return { auditado };
}
