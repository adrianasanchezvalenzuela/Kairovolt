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

export interface ConfigServidor {
  port: number;
  zoho: ZohoConfig | null;
  /** Token para endpoints administrativos; sin él, esos endpoints quedan deshabilitados. */
  adminToken: string | null;
}

/** Solo se envían credenciales/tokens a dominios oficiales de Zoho (evita fuga a hosts arbitrarios). */
const ACCOUNTS_PERMITIDO = /^https:\/\/accounts\.zoho\.(com|eu|in|com\.au|jp|ca|sa|com\.cn)$/;
const PROJECTS_PERMITIDO = /^https:\/\/projectsapi\.zoho\.(com|eu|in|com\.au|jp|ca|sa|com\.cn)$/;
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
  return { port: Number(env.PORT) || 8787, zoho, adminToken: env.ADMIN_TOKEN || null };
}
