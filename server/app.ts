import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ConfigServidor } from './config';
import { COOKIE_SESION, DURACION_SESION_S, crearLimitador, crearSesiones, derivarSecreto } from './sesiones';
import { aProyectoKv } from './zoho/adaptar';
import { crearZohoAuth, ZohoError, type FetchFn } from './zoho/auth';
import { crearClienteZoho } from './zoho/cliente';
import { COMPUERTAS, ESTADOS, SyncError, sincronizarCompuerta, sincronizarObservacion, type CodigoSync } from './zoho/escritura';
import { leerProyectos, listarModulosCrm, listarPortales } from './zoho/lectura';
import { MAPEO_ZOHO } from './zoho/mapeo';
import { ESTADOS_OBSERVACION, ORIGENES_OBSERVACION, leerObservaciones } from './zoho/observaciones';

export type EstadoZoho = 'no_configurado' | 'conectado' | 'error';
export interface RespuestaEstado {
  zoho: EstadoZoho;
  detalle: string;
}

/** Cabecera que deben enviar las peticiones que escriben cuando se autentican por cookie (defensa CSRF). */
export const CABECERA_CSRF = 'x-requested-with';
export const VALOR_CSRF = 'kairovolt';

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const FOLIO = /^KV-\d{4}-\d{3,}$/i;
const STATUS_SYNC: Record<CodigoSync, 404 | 422 | 502> = {
  proyecto_no_encontrado: 404, tarea_no_encontrada: 404, sin_proyecto_projects: 422, sin_trato_crm: 422,
  portal_no_configurado: 422, estado_sin_id: 422, respuesta_inesperada: 502,
};

const str = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v.trim() !== '' && v.length <= max ? v.trim() : null);
const en = <T extends string>(lista: readonly T[], v: unknown): T | undefined => lista.find((x) => x === v);

export function crearApp(config: ConfigServidor, fetchFn: FetchFn = fetch, ahora: () => number = Date.now) {
  const app = new Hono();
  const obtenerSesion = config.zoho ? crearZohoAuth(config.zoho, fetchFn) : null;
  const cli = config.zoho && obtenerSesion ? crearClienteZoho(config.zoho, obtenerSesion, fetchFn) : null;
  const sesiones = crearSesiones(derivarSecreto(config.adminToken ?? ''), ahora);
  const limitador = crearLimitador(5, 60_000, ahora);

  /** Estado real: solo "conectado" si Zoho entregó un access token válido. Público: no expone datos. */
  app.get('/api/integracion/estado', async (c) => {
    if (!obtenerSesion) {
      return c.json<RespuestaEstado>({ zoho: 'no_configurado', detalle: 'No conectado: faltan credenciales de Zoho en el servidor.' });
    }
    try {
      await obtenerSesion();
      return c.json<RespuestaEstado>({ zoho: 'conectado', detalle: 'Autenticación con Zoho verificada.' });
    } catch (e) {
      return c.json<RespuestaEstado>({ zoho: 'error', detalle: e instanceof ZohoError ? e.message : 'Error inesperado' });
    }
  });

  // ---- Sesión: el ADMIN_TOKEN se canjea por una cookie HttpOnly (el navegador nunca guarda el token). ----
  app.get('/api/sesion', (c) =>
    c.json({ adminHabilitado: config.adminToken !== null, autenticado: config.adminToken !== null && sesiones.valida(getCookie(c, COOKIE_SESION)) }));

  app.post('/api/sesion', async (c) => {
    if (!config.adminToken) return c.json({ error: 'deshabilitado' }, 404);
    if (limitador.bloqueado()) return c.json({ error: 'demasiados_intentos' }, 429);
    const b = (await c.req.json().catch(() => null)) as { token?: unknown } | null;
    if (typeof b?.token !== 'string' || !igual(b.token, config.adminToken)) {
      limitador.falla();
      return c.json({ error: 'token_invalido' }, 401);
    }
    limitador.exito();
    setCookie(c, COOKIE_SESION, sesiones.crear(), { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: DURACION_SESION_S });
    return c.json({ autenticado: true });
  });

  app.delete('/api/sesion', (c) => {
    deleteCookie(c, COOKIE_SESION, { path: '/' });
    return c.json({ autenticado: false });
  });

  // ---- Administrativo: lectura y escritura. Acepta `Authorization: Bearer <ADMIN_TOKEN>` o la cookie de sesión. ----
  app.use('/api/admin/*', async (c, next) => {
    if (!config.adminToken) return c.json({ error: 'deshabilitado' }, 404);
    const bearer = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
    const porBearer = bearer !== '' && igual(bearer, config.adminToken);
    const porCookie = sesiones.valida(getCookie(c, COOKIE_SESION)); // config.adminToken ya está comprobado arriba
    if (!porBearer && !porCookie) return c.json({ error: 'no_autorizado' }, 401);
    const escribe = c.req.method !== 'GET' && c.req.method !== 'HEAD';
    if (!porBearer && escribe && c.req.header(CABECERA_CSRF) !== VALOR_CSRF) return c.json({ error: 'csrf' }, 403);
    if (!cli) return c.json({ error: 'no_configurado' }, 503);
    await next();
  });

  const conErrores = async (c: Context, f: () => Promise<Response>) => {
    try {
      return await f();
    } catch (e) {
      if (e instanceof SyncError) return c.json({ error: e.codigo, detalle: e.message }, STATUS_SYNC[e.codigo]);
      return c.json({ error: e instanceof ZohoError ? e.message : 'Error inesperado' }, 502);
    }
  };
  const folioQuery = (c: Context) => {
    const folio = c.req.query('folio');
    return folio && !FOLIO.test(folio) ? ('invalido' as const) : (folio ?? undefined);
  };

  app.get('/api/admin/zoho/modulos', (c) => conErrores(c, async () => c.json({ modulos: await listarModulosCrm(cli!) })));
  app.get('/api/admin/zoho/portales', (c) => conErrores(c, async () => c.json({ portales: await listarPortales(cli!) })));
  app.get('/api/admin/zoho/mapeo', (c) => c.json({ mapeo: MAPEO_ZOHO, nota: 'Editar server/zoho/mapeo.ts' }));
  app.get('/api/admin/zoho/proyectos', (c) =>
    conErrores(c, async () => {
      const folio = folioQuery(c);
      if (folio === 'invalido') return c.json({ error: 'folio_invalido' }, 400);
      return c.json(await leerProyectos(cli!, folio ? { folio } : {}));
    }));

  /** Proyectos ya en el formato del dominio de KairóVolt (lo que consume la interfaz). */
  app.get('/api/admin/kv/proyectos', (c) =>
    conErrores(c, async () => {
      const folio = folioQuery(c);
      if (folio === 'invalido') return c.json({ error: 'folio_invalido' }, 400);
      const { proyectos, advertencias } = await leerProyectos(cli!, folio ? { folio } : {});
      const kv = await Promise.all(proyectos.map(async (p) => aProyectoKv(p, p.deal ? await leerObservaciones(cli!, p.deal.id) : [])));
      return c.json({ proyectos: kv, advertencias });
    }));

  /** Body: { folio, compuerta, estado, simular? }. Con simular=true no escribe en Zoho. */
  app.post('/api/admin/sync/compuerta', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      const folio = str(b?.folio, 40);
      const compuerta = en(COMPUERTAS, b?.compuerta);
      const estado = en(ESTADOS, b?.estado);
      if (!folio || !FOLIO.test(folio) || !compuerta || !estado) return c.json({ error: 'datos_invalidos' }, 400);
      return c.json(await sincronizarCompuerta(cli!, { folio, compuerta, estado, simular: b?.simular === true }));
    }));

  /** Body: { folio, observacionId, compuerta, origen, estado, descripcion, fechaCompromiso?, responsable?, simular? }. */
  app.post('/api/admin/sync/observacion', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      const folio = str(b?.folio, 40);
      const compuerta = en(COMPUERTAS, b?.compuerta);
      const observacionId = str(b?.observacionId, 80);
      const origen = en(ORIGENES_OBSERVACION, b?.origen);
      const estado = en(ESTADOS_OBSERVACION, b?.estado);
      const descripcion = str(b?.descripcion);
      if (!folio || !FOLIO.test(folio) || !compuerta || !observacionId || !/^[\w-]+$/.test(observacionId) || !origen || !estado || !descripcion) {
        return c.json({ error: 'datos_invalidos' }, 400);
      }
      return c.json(await sincronizarObservacion(cli!, {
        folio, compuerta, observacionId, origen, estado, descripcion,
        fechaCompromiso: str(b?.fechaCompromiso, 20), responsable: str(b?.responsable, 120), simular: b?.simular === true,
      }));
    }));

  return app;
}
