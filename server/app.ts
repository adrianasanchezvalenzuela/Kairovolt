import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { normalizarCorreo, validarContrasena } from '../src/domain/usuarios/credenciales';
import { puede, type Accion } from '../src/domain/usuarios/permisos';
import { ROLES_USUARIO, type RolUsuario } from '../src/domain/usuarios/rol';
import type { ConfigServidor } from './config';
import { COOKIE_SESION, DURACION_SESION_S, crearLimitadores, crearSesiones, derivarSecreto } from './sesiones';
import { registrarEvento, type ActorAuditoria } from './supabase/auditoria';
import { crearClienteSupabase, SupabaseError } from './supabase/cliente';
import { cambiarMiContrasena, CuentaError, type CodigoCuenta } from './supabase/cuenta';
import { autenticarConContrasena, restablecerContrasena, solicitarRecuperacion } from './supabase/login';
import { buscarPerfilActivo, crearBuscadorPerfiles } from './supabase/perfiles';
import { actualizarUsuario, crearUsuario, listarUsuarios, UsuarioError, type CodigoUsuario } from './supabase/usuarios';
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

/** Quién hace la petición: un usuario de Supabase (con su rol real) o el token de emergencia (admin). */
export interface Actor extends ActorAuditoria {
  rol: RolUsuario;
  nombre: string | null;
}
type Env = { Variables: { actor: Actor } };

/** Cabecera que deben enviar las peticiones que escriben cuando se autentican por cookie (defensa CSRF). */
export const CABECERA_CSRF = 'x-requested-with';
export const VALOR_CSRF = 'kairovolt';

const ACTOR_TOKEN: Actor = { via: 'token', uid: null, correo: null, nombre: 'Administrador (token)', rol: 'admin' };

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const FOLIO = /^KV-\d{4}-\d{3,}$/i;
const STATUS_SYNC: Record<CodigoSync, 404 | 422 | 502> = {
  proyecto_no_encontrado: 404, tarea_no_encontrada: 404, sin_proyecto_projects: 422, sin_trato_crm: 422,
  portal_no_configurado: 422, estado_sin_id: 422, respuesta_inesperada: 502,
};
const STATUS_USUARIO: Record<CodigoUsuario, 400 | 404 | 409 | 422 | 502> = {
  datos_invalidos: 400, no_encontrado: 404, correo_duplicado: 409, contrasena_debil: 422, perfil_fallo: 502, auto_modificacion: 409,
};

const STATUS_CUENTA: Record<CodigoCuenta, 400 | 422> = { sin_cuenta: 400, contrasena_actual_incorrecta: 422, contrasena_debil: 422, misma_contrasena: 422 };

const str = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v.trim() !== '' && v.length <= max ? v.trim() : null);
const en = <T extends string>(lista: readonly T[], v: unknown): T | undefined => lista.find((x) => x === v);
const publico = (a: Actor) => ({ correo: a.correo, nombre: a.nombre, rol: a.rol, via: a.via });

export function crearApp(config: ConfigServidor, fetchFn: FetchFn = fetch, ahora: () => number = Date.now) {
  const app = new Hono<Env>();
  const obtenerSesion = config.zoho ? crearZohoAuth(config.zoho, fetchFn) : null;
  const cli = config.zoho && obtenerSesion ? crearClienteZoho(config.zoho, obtenerSesion, fetchFn) : null;
  const sb = config.supabase ? crearClienteSupabase(config.supabase, fetchFn) : null;
  const perfilDe = sb ? crearBuscadorPerfiles(sb, ahora) : null;

  const metodos = { token: config.adminToken !== null, correo: sb !== null && !!config.supabase?.publishableKey };
  const loginHabilitado = metodos.token || metodos.correo;
  const sesiones = crearSesiones(derivarSecreto(config.sessionSecret ?? config.adminToken ?? config.supabase?.secretKey ?? ''), ahora);
  const limitadores = crearLimitadores(5, 60_000, ahora);
  // Recuperación: por correo (evita bombardear una bandeja) y global (evita usar el backend para enviar correos en masa)
  const recuperaciones = crearLimitadores(3, 10 * 60_000, ahora);
  const recuperacionesGlobal = crearLimitadores(30, 10 * 60_000, ahora);

  const bearerValido = (c: Context): boolean => {
    const bearer = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
    return config.adminToken !== null && bearer !== '' && igual(bearer, config.adminToken);
  };

  /** Identifica a quien llama. Puede lanzar SupabaseError si no se puede consultar el perfil (se responde 503: nunca se concede acceso por defecto). */
  async function resolverActor(c: Context): Promise<Actor | null> {
    if (bearerValido(c)) return ACTOR_TOKEN;
    const sesion = sesiones.leer(getCookie(c, COOKIE_SESION));
    if (!sesion) return null;
    if (sesion.uid === null) return config.adminToken !== null ? ACTOR_TOKEN : null;
    const perfil = perfilDe ? await perfilDe(sesion.uid) : null;
    return perfil ? { via: 'supabase', uid: perfil.id, correo: perfil.correo, nombre: perfil.nombre, rol: perfil.rol } : null;
  }

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

  // ---- Sesión: correo + contraseña (Supabase Auth) o token de emergencia. Ambos se canjean por una cookie HttpOnly firmada. ----
  app.get('/api/sesion', async (c) => {
    const actor = await resolverActor(c).catch(() => null);
    return c.json({ loginHabilitado, metodos, autenticado: actor !== null, usuario: actor ? publico(actor) : null });
  });

  const iniciar = (c: Context, actor: Actor) => {
    setCookie(c, COOKIE_SESION, sesiones.crear(actor.uid), { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: DURACION_SESION_S });
    return c.json({ autenticado: true, usuario: publico(actor) });
  };

  app.post('/api/sesion', async (c) => {
    const b = (await c.req.json().catch(() => null)) as { token?: unknown; correo?: unknown; contrasena?: unknown } | null;

    // Token de emergencia
    if (typeof b?.token === 'string') {
      if (!config.adminToken) return c.json({ error: 'deshabilitado' }, 404);
      if (limitadores.bloqueado('token')) return c.json({ error: 'demasiados_intentos' }, 429);
      if (!igual(b.token, config.adminToken)) {
        limitadores.falla('token');
        return c.json({ error: 'token_invalido' }, 401);
      }
      limitadores.exito('token');
      return iniciar(c, ACTOR_TOKEN);
    }

    // Correo y contraseña (Supabase Auth)
    if (typeof b?.correo === 'string' && typeof b.contrasena === 'string') {
      if (!sb || !config.supabase || !metodos.correo) return c.json({ error: 'deshabilitado' }, 404);
      const correo = normalizarCorreo(b.correo);
      const clave = `correo:${correo ?? 'invalido'}`;
      if (limitadores.bloqueado(clave)) return c.json({ error: 'demasiados_intentos' }, 429);
      if (!correo || b.contrasena.length === 0 || b.contrasena.length > 200) {
        limitadores.falla(clave);
        return c.json({ error: 'credenciales_invalidas' }, 401);
      }
      try {
        const identidad = await autenticarConContrasena(config.supabase, fetchFn, correo, b.contrasena);
        if (!identidad) {
          limitadores.falla(clave);
          return c.json({ error: 'credenciales_invalidas' }, 401);
        }
        const perfil = await buscarPerfilActivo(sb, identidad.id); // consulta fresca: sin caché al iniciar sesión
        if (!perfil) return c.json({ error: 'cuenta_inactiva' }, 403);
        limitadores.exito(clave);
        return iniciar(c, { via: 'supabase', uid: perfil.id, correo: perfil.correo, nombre: perfil.nombre, rol: perfil.rol });
      } catch {
        return c.json({ error: 'auth_no_disponible' }, 503);
      }
    }

    return c.json({ error: 'datos_invalidos' }, 400);
  });

  app.delete('/api/sesion', (c) => {
    deleteCookie(c, COOKIE_SESION, { path: '/' });
    return c.json({ autenticado: false });
  });

  // ---- Recuperación de contraseña (pública). Supabase envía el correo; la respuesta es igual exista o no la cuenta. ----
  app.post('/api/recuperar', async (c) => {
    if (!sb || !config.supabase || !metodos.correo) return c.json({ error: 'deshabilitado' }, 404);
    const b = (await c.req.json().catch(() => null)) as { correo?: unknown } | null;
    const correo = typeof b?.correo === 'string' ? normalizarCorreo(b.correo) : null;
    if (!correo) return c.json({ error: 'datos_invalidos', detalle: 'Escribe un correo válido.' }, 400);
    const clave = `recuperar:${correo}`;
    if (recuperaciones.bloqueado(clave) || recuperacionesGlobal.bloqueado('*')) {
      return c.json({ error: 'demasiados_intentos', detalle: 'Ya se pidió un enlace hace poco. Revisa tu correo o espera unos minutos.' }, 429);
    }
    recuperaciones.falla(clave);
    recuperacionesGlobal.falla('*');
    try {
      const base = config.appUrl ?? new URL(c.req.url).origin;
      await solicitarRecuperacion(config.supabase, fetchFn, correo, `${base}/restablecer`);
    } catch {
      return c.json({ error: 'no_disponible' }, 503);
    }
    return c.json({ ok: true }, 202);
  });

  /** Body: { token, contrasena }. `token` es el access_token temporal del enlace del correo. */
  app.post('/api/restablecer', async (c) => {
    if (!sb || !config.supabase || !metodos.correo) return c.json({ error: 'deshabilitado' }, 404);
    const b = (await c.req.json().catch(() => null)) as { token?: unknown; contrasena?: unknown } | null;
    if (typeof b?.token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(b.token) || b.token.length > 4096 || typeof b.contrasena !== 'string') {
      return c.json({ error: 'enlace_invalido', detalle: 'El enlace no es válido o ya venció. Pide uno nuevo.' }, 400);
    }
    if (limitadores.bloqueado('restablecer')) return c.json({ error: 'demasiados_intentos' }, 429);
    const problema = validarContrasena(b.contrasena);
    if (problema) return c.json({ error: 'contrasena_debil', detalle: problema }, 422);
    try {
      const r = await restablecerContrasena(config.supabase, fetchFn, b.token, b.contrasena);
      if (r === 'enlace_invalido') {
        limitadores.falla('restablecer');
        return c.json({ error: 'enlace_invalido', detalle: 'El enlace no es válido o ya venció. Pide uno nuevo.' }, 400);
      }
      if (r === 'misma_contrasena') return c.json({ error: 'misma_contrasena', detalle: 'La contraseña nueva debe ser distinta de la anterior.' }, 422);
      if (r === 'contrasena_debil') return c.json({ error: 'contrasena_debil', detalle: 'Supabase rechazó la contraseña por débil.' }, 422);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: 'no_disponible' }, 503);
    }
  });

  // ---- Administrativo. Acepta `Authorization: Bearer <ADMIN_TOKEN>` (scripts) o la cookie de sesión. Cada ruta exige un permiso por rol. ----
  const autenticar = async (c: Context<Env>, next: () => Promise<void>) => {
    if (!loginHabilitado) return c.json({ error: 'deshabilitado' }, 404);
    let actor: Actor | null;
    try {
      actor = await resolverActor(c);
    } catch {
      return c.json({ error: 'auth_no_disponible' }, 503);
    }
    if (!actor) return c.json({ error: 'no_autorizado' }, 401);
    const escribe = c.req.method !== 'GET' && c.req.method !== 'HEAD';
    if (!bearerValido(c) && escribe && c.req.header(CABECERA_CSRF) !== VALOR_CSRF) return c.json({ error: 'csrf' }, 403);
    c.set('actor', actor);
    await next();
  };
  app.use('/api/admin/*', autenticar);
  app.use('/api/cuenta/*', autenticar);

  const exigir = (accion: Accion) => async (c: Context<Env>, next: () => Promise<void>) => {
    if (!puede(c.get('actor').rol, accion)) return c.json({ error: 'sin_permiso', detalle: 'Tu rol no permite esta acción.' }, 403);
    await next();
  };
  const zohoRequerido = async (c: Context<Env>, next: () => Promise<void>) => {
    if (!cli) return c.json({ error: 'no_configurado' }, 503);
    await next();
  };
  const supabaseRequerido = async (c: Context<Env>, next: () => Promise<void>) => {
    if (!sb) return c.json({ error: 'supabase_no_configurado' }, 503);
    await next();
  };
  app.use('/api/admin/zoho/*', exigir('descubrir_zoho'), zohoRequerido);
  app.use('/api/admin/kv/*', exigir('ver_datos'), zohoRequerido);
  app.use('/api/admin/sync/*', exigir('sincronizar_zoho'), zohoRequerido);
  for (const ruta of ['/api/admin/usuarios', '/api/admin/usuarios/*']) app.use(ruta, exigir('gestionar_usuarios'), supabaseRequerido);

  const conErrores = async (c: Context<Env>, f: () => Promise<Response>) => {
    try {
      return await f();
    } catch (e) {
      if (e instanceof SyncError) return c.json({ error: e.codigo, detalle: e.message }, STATUS_SYNC[e.codigo]);
      if (e instanceof CuentaError) return c.json({ error: e.codigo, detalle: e.message }, STATUS_CUENTA[e.codigo]);
      if (e instanceof UsuarioError) return c.json({ error: e.codigo, detalle: e.message }, STATUS_USUARIO[e.codigo]);
      if (e instanceof SupabaseError) return c.json({ error: e.message }, 502);
      return c.json({ error: e instanceof ZohoError ? e.message : 'Error inesperado' }, 502);
    }
  };
  const folioQuery = (c: Context) => {
    const folio = c.req.query('folio');
    return folio && !FOLIO.test(folio) ? ('invalido' as const) : (folio ?? undefined);
  };
  /** Deja constancia de un envío REAL hacia Zoho (Zoho no sabe qué usuario de KairóVolt lo originó). */
  const auditarSync = async (actor: Actor, folio: string, accion: string, detalles: Record<string, unknown>): Promise<boolean | undefined> =>
    sb ? registrarEvento(sb, actor, { entidad: 'zoho_sync', folio: folio.toUpperCase(), accion, detalles }) : undefined;

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
      const r = await sincronizarCompuerta(cli!, { folio, compuerta, estado, simular: b?.simular === true });
      const auditado = r.resultado === 'sincronizado' ? await auditarSync(c.get('actor'), folio, 'compuerta_sincronizada', { compuerta, estado }) : undefined;
      return c.json({ ...r, ...(auditado !== undefined && { auditado }) });
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
      const r = await sincronizarObservacion(cli!, {
        folio, compuerta, observacionId, origen, estado, descripcion,
        fechaCompromiso: str(b?.fechaCompromiso, 20), responsable: str(b?.responsable, 120), simular: b?.simular === true,
      });
      const auditado = r.resultado === 'sincronizado' ? await auditarSync(c.get('actor'), folio, 'observacion_sincronizada', { observacionId, compuerta, estado }) : undefined;
      return c.json({ ...r, ...(auditado !== undefined && { auditado }) });
    }));

  // ---- Usuarios del personal (Supabase Auth + tabla perfiles). Solo administradores. Las contraseñas nunca se registran. ----
  app.get('/api/admin/usuarios', (c) =>
    conErrores(c, async () => c.json({ usuarios: await listarUsuarios(sb!), roles: ROLES_USUARIO })));

  /** Body: { correo, nombre, rol, contrasena }. La contraseña la hashea Supabase (bcrypt); aquí no se guarda. */
  app.post('/api/admin/usuarios', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      if (typeof b?.correo !== 'string' || typeof b.nombre !== 'string' || typeof b.rol !== 'string' || typeof b.contrasena !== 'string') {
        return c.json({ error: 'datos_invalidos', detalle: 'Faltan datos.' }, 400);
      }
      return c.json(await crearUsuario(sb!, { correo: b.correo, nombre: b.nombre, rol: b.rol, contrasena: b.contrasena }, c.get('actor')), 201);
    }));

  /** Body: { rol?, activo? }. */
  app.patch('/api/admin/usuarios/:id', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!b) return c.json({ error: 'datos_invalidos', detalle: 'Cuerpo inválido.' }, 400);
      return c.json(await actualizarUsuario(sb!, c.req.param('id'), { rol: b.rol, activo: b.activo }, c.get('actor')));
    }));

  // ---- Mi cuenta (cualquier usuario con sesión) ----
  /** Body: { actual, nueva }. Exige la contraseña actual. */
  app.post('/api/cuenta/contrasena', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as { actual?: unknown; nueva?: unknown } | null;
      if (typeof b?.actual !== 'string' || typeof b.nueva !== 'string' || b.actual.length > 200 || b.nueva.length > 200) {
        return c.json({ error: 'datos_invalidos', detalle: 'Faltan datos.' }, 400);
      }
      const actor = c.get('actor');
      const clave = `cuenta:${actor.uid ?? 'token'}`;
      if (limitadores.bloqueado(clave)) return c.json({ error: 'demasiados_intentos', detalle: 'Demasiados intentos. Espera un minuto.' }, 429);
      try {
        const r = await cambiarMiContrasena(sb!, config.supabase!, fetchFn, actor, { actual: b.actual, nueva: b.nueva });
        limitadores.exito(clave);
        return c.json({ ok: true, ...r });
      } catch (e) {
        if (e instanceof CuentaError && e.codigo === 'contrasena_actual_incorrecta') limitadores.falla(clave);
        throw e;
      }
    }));

  return app;
}
