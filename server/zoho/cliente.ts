import type { ZohoConfig } from '../config';
import { ZohoError, type CategoriaError, type FetchFn, type ObtenerSesion } from './auth';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Servicio = 'CRM' | 'Projects' | 'WorkDrive';

export interface OpcionesLlamada {
  /**
   * Un POST normalmente NO se reintenta tras un 5xx o un corte de red (podría haberse ejecutado ya y duplicar el registro).
   * Márcalo `true` cuando repetirlo sea seguro (p. ej. un upsert por identificador externo).
   */
  idempotente?: boolean;
}

export interface ClienteZoho {
  /** Llamada a Zoho CRM (ruta relativa al dominio de API, p. ej. `/crm/v6/Deals`). */
  crm<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown, opciones?: OpcionesLlamada): Promise<T>;
  /** Llamada a Zoho Projects (ruta relativa a la base de Projects). */
  projects<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown, opciones?: OpcionesLlamada): Promise<T>;
  /** Llamada a Zoho WorkDrive (ruta relativa a `/workdrive/api/v1`). Un `FormData` se envía tal cual (subida de archivos). */
  workdrive<T = unknown>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown, opciones?: OpcionesLlamada): Promise<T>;
  readonly portalId: string | null;
}

/** Codifica un segmento de ruta (ids provenientes de Zoho o del usuario). */
export const seg = (valor: string): string => encodeURIComponent(valor);

export interface PoliticaReintento {
  maxIntentos: number;
  baseMs: number;
  maxMs: number;
  /** Tope de espera cuando Zoho pide esperar con `Retry-After`. */
  maxEsperaRetryAfterMs: number;
}

export const POLITICA_POR_DEFECTO: PoliticaReintento = { maxIntentos: 4, baseMs: 400, maxMs: 6_000, maxEsperaRetryAfterMs: 30_000 };

export interface DependenciasCliente {
  politica?: Partial<PoliticaReintento>;
  /** Inyectables para probar sin esperas reales. */
  esperar?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
}

interface DetalleError { codigo: string | null; mensaje: string | null; titulo: string | null }

/** Zoho responde distinto según el servicio: CRM `{code,message}`, Projects `{error:{title,details}}`, WorkDrive `{errors:[{id,title}]}`. */
function leerDetalle(data: unknown): DetalleError {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, 200) : null);
  const error = (d.error && typeof d.error === 'object' ? d.error : {}) as Record<string, unknown>;
  const primero = Array.isArray(d.errors) && d.errors[0] && typeof d.errors[0] === 'object' ? (d.errors[0] as Record<string, unknown>) : {};
  const det = Array.isArray(error.details) && error.details[0] && typeof error.details[0] === 'object' ? (error.details[0] as Record<string, unknown>) : {};
  return {
    codigo: txt(d.code) ?? txt(error.title) ?? txt(primero.id),
    mensaje: txt(d.message) ?? txt(det.message) ?? txt(primero.title),
    titulo: txt(error.title) ?? txt(primero.title) ?? txt(d.code),
  };
}

const ES_PERMISO = /OAUTH_?SCOPE|SCOPE_MISMATCH|Invalid OAuth scope|NO_PERMISSION|NOT_ALLOWED/i;

export function clasificar(status: number, d: DetalleError): CategoriaError {
  if (ES_PERMISO.test(`${d.codigo ?? ''} ${d.titulo ?? ''} ${d.mensaje ?? ''}`)) return 'permiso'; // un 401/500 por scope no se arregla reintentando
  if (status === 401) return 'autenticacion';
  if (status === 403) return 'permiso';
  if (status === 404) return 'no_encontrado';
  if (status === 429) return 'limite';
  if (status === 400 || status === 409 || status === 422) return 'validacion';
  if (status >= 500) return 'servidor';
  return 'desconocido';
}

export function crearClienteZoho(config: ZohoConfig, obtenerSesion: ObtenerSesion, fetchFn: FetchFn = fetch, deps: DependenciasCliente = {}): ClienteZoho {
  const politica: PoliticaReintento = { ...POLITICA_POR_DEFECTO, ...deps.politica };
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const aleatorio = deps.aleatorio ?? Math.random;

  const demora = (intento: number, retryAfter: string | null): number => {
    const seg = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(seg) && seg >= 0) return Math.min(politica.maxEsperaRetryAfterMs, seg * 1000);
    const exponencial = Math.min(politica.maxMs, politica.baseMs * 2 ** (intento - 1));
    return Math.round(exponencial * (0.5 + aleatorio() / 2)); // jitter: evita que varios reintentos coincidan
  };

  async function llamar<T>(servicio: Servicio, metodo: MetodoHttp, ruta: string, cuerpo?: unknown, opc?: OpcionesLlamada): Promise<T> {
    const idempotente = metodo !== 'POST' || opc?.idempotente === true;
    let tokenRefrescado = false;

    for (let intento = 1; ; intento++) {
      const { token, apiDomain } = await obtenerSesion();
      const base = servicio === 'CRM' ? apiDomain : servicio === 'Projects' ? config.projectsUrl : `${apiDomain}/workdrive/api/v1`;
      const esForm = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
      const tipo = servicio === 'WorkDrive' ? 'application/vnd.api+json' : 'application/json';

      let res: Response;
      try {
        res = await fetchFn(`${base}${ruta}`, {
          method: metodo,
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            ...(servicio === 'WorkDrive' && { Accept: 'application/vnd.api+json' }),
            ...(cuerpo !== undefined && !esForm && { 'Content-Type': tipo }),
          },
          ...(cuerpo !== undefined && { body: esForm ? (cuerpo as FormData) : JSON.stringify(cuerpo) }),
        });
      } catch {
        // Corte de red: solo se repite si la operación es idempotente (si no, podría haberse ejecutado ya).
        if (idempotente && intento < politica.maxIntentos) { await esperar(demora(intento, null)); continue; }
        throw new ZohoError(`No se pudo contactar a Zoho ${servicio}`, undefined, 'red', idempotente, intento);
      }

      if (res.status === 204) return {} as T;
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (res.ok) return data as T;

      const det = leerDetalle(data);
      const categoria = clasificar(res.status, det);

      // Token vencido antes de tiempo: se pide uno nuevo UNA vez y se repite (la petición no se procesó, es seguro con cualquier método).
      if (categoria === 'autenticacion' && !tokenRefrescado) {
        obtenerSesion.invalidar();
        tokenRefrescado = true;
        continue;
      }
      // 429 = Zoho no procesó la petición (seguro repetir). 5xx = pudo procesarla: solo si es idempotente. Nunca reintentar permisos ni validaciones.
      const reintenta = intento < politica.maxIntentos && (categoria === 'limite' || (idempotente && categoria === 'servidor'));
      if (reintenta) { await esperar(demora(intento, res.headers.get('Retry-After'))); continue; }

      const code = det.codigo ? ` (${det.codigo})` : '';
      const msg = det.mensaje ? `: ${det.mensaje}` : '';
      throw new ZohoError(`Zoho ${servicio} respondió ${res.status}${code}${msg}`, res.status, categoria, categoria === 'limite' || categoria === 'servidor', intento);
    }
  }

  return {
    crm: (m, r, c, o) => llamar('CRM', m, r, c, o),
    projects: (m, r, c, o) => llamar('Projects', m, r, c, o),
    workdrive: (m, r, c, o) => llamar('WorkDrive', m, r, c, o),
    portalId: config.portalId,
  };
}
