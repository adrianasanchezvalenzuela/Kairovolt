import type { SupabaseConfig } from '../config';
import { SupabaseError, type FetchFn } from './cliente';

export interface IdentidadSupabase {
  id: string;
  correo: string | null;
}

/**
 * Valida correo y contraseña contra Supabase Auth (grant_type=password) con la clave PUBLICABLE.
 * Devuelve la identidad o `null` si las credenciales no son válidas. Los tokens que entrega Supabase se DESCARTAN:
 * no se guardan ni en el servidor ni en el navegador (la sesión la maneja la cookie firmada del backend).
 * Jamás se registra ni se devuelve la contraseña.
 */
export async function autenticarConContrasena(
  cfg: SupabaseConfig, fetchFn: FetchFn, correo: string, contrasena: string,
): Promise<IdentidadSupabase | null> {
  if (!cfg.publishableKey) throw new SupabaseError('Falta SUPABASE_PUBLISHABLE_KEY');
  let res: Response;
  try {
    res = await fetchFn(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: cfg.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, password: contrasena }),
    });
  } catch {
    throw new SupabaseError('No se pudo contactar a Supabase');
  }
  const data = (await res.json().catch(() => ({}))) as { user?: { id?: string; email?: string }; error_code?: string };
  if (res.ok && typeof data.user?.id === 'string') return { id: data.user.id, correo: data.user.email ?? null };
  // Credenciales incorrectas, correo sin confirmar, usuario baneado… → para el usuario es lo mismo (no se revela cuál).
  // OJO: un 401/403 NO es "contraseña incorrecta" sino una clave de API inválida: debe verse como fallo de configuración.
  if (res.status === 400 || res.status === 422) return null;
  throw new SupabaseError(`Supabase respondió ${res.status}`, res.status, data.error_code);
}

/**
 * Pide a Supabase que envíe el correo de recuperación. Supabase responde igual exista o no el correo
 * (no se revela nada) y es quien envía el mensaje, con el SMTP configurado en su panel.
 * `redirectTo` debe estar en Authentication → URL Configuration → Redirect URLs.
 */
export async function solicitarRecuperacion(cfg: SupabaseConfig, fetchFn: FetchFn, correo: string, redirectTo: string): Promise<void> {
  if (!cfg.publishableKey) throw new SupabaseError('Falta SUPABASE_PUBLISHABLE_KEY');
  let res: Response;
  try {
    res = await fetchFn(`${cfg.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: { apikey: cfg.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo }),
    });
  } catch {
    throw new SupabaseError('No se pudo contactar a Supabase');
  }
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { error_code?: string };
  throw new SupabaseError(`Supabase respondió ${res.status}`, res.status, data.error_code);
}

export type ResultadoCambioContrasena = 'ok' | 'enlace_invalido' | 'contrasena_debil' | 'misma_contrasena';

/**
 * Fija la contraseña nueva con el token temporal que llegó en el enlace del correo (viaja una sola vez, en el
 * encabezado Authorization hacia Supabase; no se guarda ni se registra). Supabase guarda solo el hash.
 */
export async function restablecerContrasena(cfg: SupabaseConfig, fetchFn: FetchFn, tokenEnlace: string, nueva: string): Promise<ResultadoCambioContrasena> {
  if (!cfg.publishableKey) throw new SupabaseError('Falta SUPABASE_PUBLISHABLE_KEY');
  let res: Response;
  try {
    res = await fetchFn(`${cfg.url}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: cfg.publishableKey, Authorization: `Bearer ${tokenEnlace}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: nueva }),
    });
  } catch {
    throw new SupabaseError('No se pudo contactar a Supabase');
  }
  if (res.ok) return 'ok';
  const data = (await res.json().catch(() => ({}))) as { error_code?: string };
  if (res.status === 401 || res.status === 403) return 'enlace_invalido'; // token vencido, ya usado o falso
  if (data.error_code === 'same_password') return 'misma_contrasena';
  if (res.status === 422 || data.error_code === 'weak_password') return 'contrasena_debil';
  throw new SupabaseError(`Supabase respondió ${res.status}`, res.status, data.error_code);
}
