import type { ZohoConfig } from '../config';
import { ZohoError, type FetchFn, type ObtenerSesion } from './auth';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH';

export interface ClienteZoho {
  /** Llamada a Zoho CRM (ruta relativa al dominio de API, p. ej. `/crm/v6/Deals`). */
  crm<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T>;
  /** Llamada a Zoho Projects (ruta relativa a la base de Projects). */
  projects<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T>;
  readonly portalId: string | null;
}

/** Codifica un segmento de ruta (ids provenientes de Zoho o del usuario). */
export const seg = (valor: string): string => encodeURIComponent(valor);

export function crearClienteZoho(config: ZohoConfig, obtenerSesion: ObtenerSesion, fetchFn: FetchFn = fetch): ClienteZoho {
  async function llamar<T>(servicio: 'CRM' | 'Projects', metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T> {
    const { token, apiDomain } = await obtenerSesion();
    const base = servicio === 'CRM' ? apiDomain : config.projectsUrl;
    let res: Response;
    try {
      res = await fetchFn(`${base}${ruta}`, {
        method: metodo,
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
      });
    } catch {
      throw new ZohoError(`No se pudo contactar a Zoho ${servicio}`);
    }
    if (res.status === 204) return {} as T;
    const data = (await res.json().catch(() => ({}))) as { code?: unknown; message?: unknown };
    if (!res.ok) {
      const code = typeof data.code === 'string' ? ` (${data.code})` : '';
      const msg = typeof data.message === 'string' ? `: ${data.message.slice(0, 200)}` : '';
      throw new ZohoError(`Zoho ${servicio} respondió ${res.status}${code}${msg}`, res.status);
    }
    return data as T;
  }

  return {
    crm: (m, r, c) => llamar('CRM', m, r, c),
    projects: (m, r, c) => llamar('Projects', m, r, c),
    portalId: config.portalId,
  };
}
