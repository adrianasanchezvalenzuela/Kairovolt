import type { SupabaseConfig } from '../config';

export type FetchFn = typeof fetch;
export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class SupabaseError extends Error {
  constructor(message: string, readonly status?: number, readonly codigo?: string) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export interface ClienteSupabase {
  /** API de administración de Auth (`/auth/v1/...`). */
  auth<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T>;
  /** PostgREST (`/rest/v1/...`). `prefer` va en la cabecera Prefer (p. ej. "return=representation"). */
  rest<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown, prefer?: string): Promise<T>;
}

/**
 * Cliente HTTP mínimo con la clave secreta. Las claves sb_secret_* no son JWT: van SOLO en `apikey`.
 * Los errores no incluyen nunca la clave.
 */
export function crearClienteSupabase(cfg: SupabaseConfig, fetchFn: FetchFn = fetch): ClienteSupabase {
  async function llamar<T>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown, prefer?: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${cfg.url}${ruta}`, {
        method: metodo,
        headers: {
          apikey: cfg.secretKey,
          ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
          ...(prefer && { Prefer: prefer }),
        },
        ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
      });
    } catch {
      throw new SupabaseError('No se pudo contactar a Supabase');
    }
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const codigo = [data.error_code, data.code].find((x): x is string => typeof x === 'string');
      const msg = [data.msg, data.message, data.error_description, data.error].find((x): x is string => typeof x === 'string');
      throw new SupabaseError(`Supabase respondió ${res.status}${msg ? `: ${msg.slice(0, 200)}` : ''}`, res.status, codigo);
    }
    return data as T;
  }

  return {
    auth: (m, r, c) => llamar(m, `/auth/v1${r}`, c),
    rest: (m, r, c, p) => llamar(m, `/rest/v1${r}`, c, p),
  };
}
