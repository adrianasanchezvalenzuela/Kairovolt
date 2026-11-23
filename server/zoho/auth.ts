import type { ZohoConfig } from '../config';

export type FetchFn = typeof fetch;

export class ZohoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ZohoError';
  }
}

export interface SesionZoho {
  token: string;
  apiDomain: string;
}

/** El dominio de API que devuelve Zoho se valida antes de enviarle el token. */
const API_DOMAIN_PERMITIDO = /^https:\/\/www\.zohoapis\.[a-z.]+$/;
const MARGEN_MS = 60_000;

/**
 * Renueva y cachea el access token a partir del refresh token. Las credenciales viven solo en el servidor
 * y nunca aparecen en mensajes de error.
 */
export function crearZohoAuth(config: ZohoConfig, fetchFn: FetchFn = fetch, ahora: () => number = Date.now) {
  let cache: (SesionZoho & { expiraEn: number }) | null = null;

  return async function obtenerSesion(): Promise<SesionZoho> {
    if (cache && ahora() < cache.expiraEn) return { token: cache.token, apiDomain: cache.apiDomain };

    let res: Response;
    try {
      res = await fetchFn(`${config.accountsUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
    } catch {
      throw new ZohoError('No se pudo contactar a Zoho');
    }

    const data = (await res.json().catch(() => ({}))) as { access_token?: string; api_domain?: string; expires_in?: number; error?: string };
    if (!res.ok || data.error || !data.access_token) {
      throw new ZohoError(`Zoho rechazó la renovación del token${data.error ? `: ${data.error}` : ''}`, res.status);
    }
    const apiDomain = data.api_domain ?? '';
    if (!API_DOMAIN_PERMITIDO.test(apiDomain)) throw new ZohoError('Zoho devolvió un dominio de API no reconocido');

    cache = { token: data.access_token, apiDomain, expiraEn: ahora() + (data.expires_in ?? 3600) * 1000 - MARGEN_MS };
    return { token: cache.token, apiDomain };
  };
}

export type ObtenerSesion = ReturnType<typeof crearZohoAuth>;
