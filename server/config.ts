export interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsUrl: string;
  /** Base de la API de Zoho Projects del mismo datacenter. */
  projectsUrl: string;
  /** ID del portal de Zoho Projects; null = las operaciones de Projects quedan deshabilitadas. */
  portalId: string | null;
}

export interface SupabaseConfig {
  /** Origen del proyecto: https://<ref>.supabase.co (sin ruta). */
  url: string;
  /** sb_secret_... (o la service_role legacy). Se salta RLS: solo en el servidor. */
  secretKey: string;
  /** sb_publishable_... (o la anon legacy). Se usa para validar correo y contraseña del personal. null = login por correo deshabilitado. */
  publishableKey: string | null;
}

export interface ConfigServidor {
  port: number;
  zoho: ZohoConfig | null;
  supabase?: SupabaseConfig | null;
  /** Token de emergencia / scripts (Bearer). Con Supabase configurado, el personal entra con correo y contraseña. */
  adminToken: string | null;
  /** Clave para firmar las cookies de sesión. Por defecto se deriva de ADMIN_TOKEN o de la clave secreta de Supabase. */
  sessionSecret?: string | null;
  /** URL pública de la app (https://app.ejemplo.com) para los enlaces de los correos. Si falta, se toma del origen de la petición. */
  appUrl?: string | null;
}

/** Solo se envían credenciales/tokens a dominios oficiales de Zoho (evita fuga a hosts arbitrarios). */
const ACCOUNTS_PERMITIDO = /^https:\/\/accounts\.zoho\.(com|eu|in|com\.au|jp|ca|sa|com\.cn)$/;
const PROJECTS_PERMITIDO = /^https:\/\/projectsapi\.zoho\.(com|eu|in|com\.au|jp|ca|sa|com\.cn)$/;
/** Solo se envía la clave secreta a un proyecto de Supabase (evita fuga a hosts arbitrarios). */
export const esSupabaseUrlValida = (url: string): boolean => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url);
export const esAccountsUrlValida = (url: string): boolean => ACCOUNTS_PERMITIDO.test(url);
export const esProjectsUrlValida = (url: string): boolean => PROJECTS_PERMITIDO.test(url);

const sinBarraFinal = (url: string) => url.replace(/\/+$/, '');

export function leerConfig(env: Record<string, string | undefined>): ConfigServidor {
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN } = env;
  const accountsUrl = sinBarraFinal(env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com');
  const projectsUrl = sinBarraFinal(env.ZOHO_PROJECTS_URL ?? 'https://projectsapi.zoho.com');

  let zoho: ZohoConfig | null = null;
  if (ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN) {
    if (!esAccountsUrlValida(accountsUrl)) throw new Error('ZOHO_ACCOUNTS_URL no es un dominio de cuentas de Zoho permitido');
    if (!esProjectsUrlValida(projectsUrl)) throw new Error('ZOHO_PROJECTS_URL no es un dominio de Zoho Projects permitido');
    zoho = {
      clientId: ZOHO_CLIENT_ID,
      clientSecret: ZOHO_CLIENT_SECRET,
      refreshToken: ZOHO_REFRESH_TOKEN,
      accountsUrl,
      projectsUrl,
      portalId: env.ZOHO_PROJECTS_PORTAL_ID || null,
    };
  }
  let supabase: SupabaseConfig | null = null;
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.SUPABASE_URL && secretKey) {
    // Tolerante: si pegaron la URL con /rest/v1/ o "/" final, se queda con el origen.
    let origen: string;
    try { origen = new URL(env.SUPABASE_URL.trim()).origin; } catch { throw new Error('SUPABASE_URL no es una URL válida'); }
    if (!esSupabaseUrlValida(origen)) throw new Error('SUPABASE_URL debe ser https://<proyecto>.supabase.co');
    const publishable = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
    supabase = { url: origen, secretKey: secretKey.trim(), publishableKey: publishable || null };
  }
  return { port: Number(env.PORT) || 8787, zoho, supabase, adminToken: env.ADMIN_TOKEN || null, sessionSecret: env.SESSION_SECRET || null, appUrl: env.APP_URL ? sinBarraFinal(env.APP_URL.trim()) : null };
}
