import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { componerExpediente } from './expediente';
import { firmarArchivo } from './archivos-expediente';
import { CAUSAS_CORRECCION } from '../src/application/revision-documental';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
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
import { sincronizarProyecto } from '../src/application/integracion/sincronizar-proyecto';
import { PERMISOS_PORTAL_POR_DEFECTO, type PermisosPortal } from '../src/application/portal-cliente';
import { catalogoParaZona, CONFIGURACION_ZONA_POR_DEFECTO } from '../src/domain/checklist/checklist';
import { hayRequisitosPendientesDeIDC } from '../src/domain/checklist/catalogo';
import { catalogoDeDemostracion, leerCatalogoSupabase, requisitosChecklist } from './catalogo';
import { crearAccesosMemoria, crearParticipantesDemo, crearRecepcionesMemoria, almacenDescarte, fuenteDemo, fuenteDemosLocales, CODIGO_DEMO } from './portal/memoria';
import { crearFuenteZoho, fuenteVacia } from './portal/fuente-zoho';
import { crearRutasPortal } from './portal/rutas';
import { crearParticipantesSupabase } from './portal/participantes';
import { crearPreparacionDemo, crearPreparacionSupabase } from './portal/preparacion';
import { crearCartasSupabase } from './portal/cartas-supabase';
import { derivarSecretoPortal } from './portal/sesion';
import { crearAccesosSupabase, crearAlmacenSupabase, crearRecepcionesSupabase } from './portal/supabase';
import { crearIntegracion } from './integracion/fabrica';
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

export function crearApp(config: ConfigServidor, fetchFn: FetchFn = fetch, ahora: () => number = Date.now, demoLocal = false) {
  const app = new Hono<Env>();
  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: config.secureCookies ? ["'self'"] : ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'blob:', ...(config.supabase ? [config.supabase.url] : [])],
      frameSrc: ["'self'", ...(config.supabase ? [config.supabase.url] : [])],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      styleSrcAttr: ["'unsafe-inline'"],
    },
    crossOriginResourcePolicy: 'same-origin',
    strictTransportSecurity: config.secureCookies ? 'max-age=31536000; includeSubDomains' : false,
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  }));
  const obtenerSesion = config.zoho ? crearZohoAuth(config.zoho, fetchFn) : null;
  const cli = config.zoho && obtenerSesion ? crearClienteZoho(config.zoho, obtenerSesion, fetchFn) : null;
  const sb = config.supabase ? crearClienteSupabase(config.supabase, fetchFn) : null;
  const perfilDe = sb ? crearBuscadorPerfiles(sb, ahora) : null;

  // ---- Portal del cliente. Demo = datos de prueba y todo en memoria (sin Supabase ni Zoho, o PORTAL_MODO_DEMO). ----
  const portalDemo = config.portalDemo === true || (!cli && !sb);
  const baseSecretoPortal = config.sessionSecret ?? config.adminToken ?? config.supabase?.secretKey ?? null;
  const supabasePortal = !portalDemo && sb !== null && config.supabase ? { sb, cfg: config.supabase } : null;
  const accesosPortal = supabasePortal ? crearAccesosSupabase(supabasePortal.sb, ahora) : crearAccesosMemoria(ahora, portalDemo);
  const fuenteZoho = cli ? crearFuenteZoho(cli) : fuenteVacia;
  const fuentePortal = portalDemo ? fuenteDemo : {
    ...fuenteZoho,
    async obtener(folio: string) {
      if (!supabasePortal) throw new Error('Supabase no está configurado.');
      const proyecto = await fuenteZoho.obtener(folio);
      return proyecto && componerExpediente(supabasePortal.sb, proyecto, false);
    },
  };
  const portal = crearRutasPortal({
    ...(portalDemo ? { preparacion: crearPreparacionDemo(), cartaDemo: true } :
      supabasePortal ? { preparacion: crearPreparacionSupabase(supabasePortal.sb),
        cartas: crearCartasSupabase(supabasePortal.sb, supabasePortal.cfg, crearAlmacenSupabase(supabasePortal.cfg, fetchFn), fetchFn) } : {}),
    ...(portalDemo ? { participantes: crearParticipantesDemo() } :
      supabasePortal ? { participantes: crearParticipantesSupabase(supabasePortal.sb) } : {}),
    accesos: accesosPortal,
    recepciones: supabasePortal ? crearRecepcionesSupabase(supabasePortal.sb) : crearRecepcionesMemoria(ahora),
    almacen: supabasePortal ? crearAlmacenSupabase(supabasePortal.cfg, fetchFn) : almacenDescarte,
    fuente: fuentePortal,
    catalogo: async () => {
      const catalogo = portalDemo ? catalogoDeDemostracion() : await leerCatalogoSupabase(sb!);
      return catalogoParaZona(requisitosChecklist(catalogo), CONFIGURACION_ZONA_POR_DEFECTO);
    },
    secreto: baseSecretoPortal ? derivarSecretoPortal(baseSecretoPortal) : null,
    persistencia: { accesos: supabasePortal ? 'supabase' : 'memoria', archivos: supabasePortal ? 'supabase' : 'no_se_guardan' },
    codigoDemo: portalDemo ? CODIGO_DEMO : null,
    secureCookies: config.secureCookies,
    ahora,
  });
  app.route('/api/portal', portal);
  if (demoLocal) {
    app.route('/api/demo/portal', crearRutasPortal({
      preparacion: crearPreparacionDemo(),
      cartaDemo: true,
      accesos: crearAccesosMemoria(ahora, true, true),
      recepciones: crearRecepcionesMemoria(ahora, true),
      participantes: crearParticipantesDemo(true),
      almacen: almacenDescarte,
      fuente: fuenteDemosLocales,
      catalogo: async () => requisitosChecklist(catalogoDeDemostracion()),
      secreto: derivarSecretoPortal(crypto.randomUUID()),
      cookie: { nombre: 'kv_portal_demo', ruta: '/api/demo/portal' },
      persistencia: { accesos: 'memoria', archivos: 'no_se_guardan' },
      codigoDemo: CODIGO_DEMO,
      ahora,
    }));
  }

  const metodos = { token: config.adminToken !== null, correo: sb !== null && !!config.supabase?.publishableKey };
  const loginHabilitado = metodos.token || metodos.correo;
  const sesiones = crearSesiones(derivarSecreto(config.sessionSecret ?? config.adminToken ?? config.supabase?.secretKey ?? ''), ahora);
  const limitadores = crearLimitadores(5, 60_000, ahora);
  const verificacionesCorreo = crearLimitadores(60, 60_000, ahora);
  app.post('/api/verificar-correo-portal', bodyLimit({ maxSize: 1024 }), async (c) => {
    if (!sb || portalDemo || c.req.header(CABECERA_CSRF) !== VALOR_CSRF) return c.json({ error: 'no_disponible' }, 403);
    if (verificacionesCorreo.bloqueado('portal')) return c.json({ error: 'demasiados_intentos' }, 429);
    verificacionesCorreo.falla('portal');
    const b = await c.req.json().catch(() => null) as { token?: unknown } | null;
    if (typeof b?.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token)) return c.json({ error: 'enlace_invalido' }, 400);
    try {
      const ok = await sb.rest<boolean>('POST', '/rpc/verificar_correo_portal', {
        p_hash: createHash('sha256').update(b.token).digest('hex'),
      });
      return ok ? c.json({ ok: true }) : c.json({ error: 'enlace_invalido' }, 400);
    } catch { return c.json({ error: 'no_disponible' }, 503); }
  });
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
    } catch {
      // Este endpoint es público y alimenta la selección MOCK/Zoho del cliente.
      // Los detalles del error de OAuth no deben aparecer en la respuesta.
      return c.json<RespuestaEstado>({ zoho: 'error', detalle: 'Zoho no está disponible en este momento.' });
    }
  });

  // ---- Sesión: correo + contraseña (Supabase Auth) o token de emergencia. Ambos se canjean por una cookie HttpOnly firmada. ----
  app.get('/api/sesion', async (c) => {
    const actor = await resolverActor(c).catch(() => null);
    return c.json({ loginHabilitado, metodos, autenticado: actor !== null, usuario: actor ? publico(actor) : null });
  });

  const iniciar = (c: Context, actor: Actor) => {
    setCookie(c, COOKIE_SESION, sesiones.crear(actor.uid), { httpOnly: true, secure: config.secureCookies === true, sameSite: 'Strict', path: '/', maxAge: DURACION_SESION_S });
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
    deleteCookie(c, COOKIE_SESION, { secure: config.secureCookies === true, sameSite: 'Strict', path: '/' });
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
    c.header('Cache-Control', 'no-store');
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
  app.get('/api/admin/catalogo', exigir('ver_datos'), async (c) => {
    if (portalDemo) return c.json({ requisitos: catalogoDeDemostracion(), demo: true });
    if (!sb) return c.json({ error: 'supabase_no_configurado', detalle: 'El catálogo documental no está disponible.' }, 503);
    try {
      return c.json({ requisitos: await leerCatalogoSupabase(sb, false), demo: false });
    } catch (error) {
      if (error instanceof SupabaseError && error.codigo === '42703') {
        return c.json({
          error: 'catalogo_migracion_pendiente',
          detalle: 'El catálogo documental requiere actualizar Supabase. Pide al administrador que aplique la migración 009 y vuelve a intentar.',
        }, 503);
      }
      return c.json({ error: 'catalogo_no_disponible', detalle: 'No se pudo consultar el catálogo documental.' }, 503);
    }
  });

  const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  app.use('/api/admin/revision/*', exigir('gestionar_validaciones'), async (c, next) => {
    if (!supabasePortal) return c.json({ error: 'revision_no_disponible' }, 503);
    await next();
  });
  app.patch('/api/admin/revision/catalogo/:id', exigir('gestionar_portal'), bodyLimit({ maxSize: 1024 }), async (c) => {
    const id = c.req.param('id');
    const b = await c.req.json().catch(() => null) as { modo?: unknown } | null;
    if (!uuid.test(id) || (b?.modo !== 'opcional' && b?.modo !== 'obligatoria' && b?.modo !== 'no_disponible')) {
      return c.json({ error: 'datos_invalidos' }, 422);
    }
    try {
      const ok = await sb!.rest<boolean>('POST', '/rpc/configurar_revision_digital', {
        p_id: id, p_modo: b.modo, p_actor: c.get('actor').uid,
      });
      return ok ? c.json({ ok: true }) : c.json({ error: 'requisito_no_disponible' }, 404);
    } catch { return c.json({ error: 'catalogo_no_disponible' }, 503); }
  });
  app.get('/api/admin/revision/recepciones', async (c) => {
    const folio = c.req.query('folio')?.trim().toUpperCase();
    const estado = c.req.query('estado');
    const tipo = c.req.query('tipo');
    const desde = c.req.query('desde');
    const offset = Number(c.req.query('offset') ?? 0);
    if ((folio && !FOLIO.test(folio)) || (estado && !['recibido', 'en_revision', 'prevalidado', 'aceptado', 'rechazado'].includes(estado)) ||
        (tipo && !/^[a-z_]{1,50}$/.test(tipo)) || (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) ||
        !Number.isSafeInteger(offset) || offset < 0) return c.json({ error: 'filtros_invalidos' }, 400);
    const consulta = new URLSearchParams({
      select: 'id,recibo,folio,documento_id,documento_nombre,archivo_nombre,mime,creado_en,estado,motivo_rechazo,causa_correccion,sustituye_recepcion_id',
      order: 'creado_en.desc,id.desc', limit: '51', offset: String(offset),
    });
    if (folio) consulta.set('folio', 'eq.' + folio);
    if (estado) consulta.set('estado', 'eq.' + estado);
    if (tipo) consulta.set('documento_id', 'eq.' + tipo);
    if (desde) consulta.set('creado_en', 'gte.' + desde + 'T00:00:00-07:00');
    try {
      const filas = await sb!.rest<unknown[]>('GET', '/portal_recepciones?' + consulta);
      c.header('Cache-Control', 'no-store');
      return c.json({ recepciones: filas.slice(0, 50), hayMas: filas.length > 50 });
    } catch {
      return c.json({ error: 'revision_no_disponible' }, 503);
    }
  });

  app.post('/api/admin/revision/recepciones/:id', bodyLimit({ maxSize: 4096 }), async (c) => {
    const id = c.req.param('id');
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const decision = b?.decision;
    const causa = b?.causa;
    const mensaje = typeof b?.mensaje === 'string' ? b.mensaje.trim() : '';
    if (!uuid.test(id) || (decision !== 'aceptado' && decision !== 'rechazado' && decision !== 'en_revision' &&
        decision !== 'prevalidado' && decision !== 'entregado') ||
        (decision === 'rechazado' && (typeof causa !== 'string' || !Object.hasOwn(CAUSAS_CORRECCION, causa) ||
          !mensaje || mensaje.length > 500))) return c.json({ error: 'decision_invalida' }, 422);
    try {
      const resultado = decision === 'prevalidado' || decision === 'entregado' || decision === 'aceptado'
        ? await sb!.rest('POST', '/rpc/revisar_entrega_portal', { p_id: id, p_actor: c.get('actor').uid, p_accion: decision })
        : await sb!.rest('POST', '/rpc/revisar_recepcion_portal', {
        p_id: id, p_actor: c.get('actor').uid, p_decision: decision,
        p_causa: decision === 'rechazado' ? causa : null, p_mensaje: decision === 'rechazado' ? mensaje : null,
      });
      return resultado ? c.json(resultado) : c.json({ error: 'recepcion_no_encontrada' }, 404);
    } catch (error) {
      if (error instanceof SupabaseError && error.codigo === '40001') return c.json({ error: 'revision_en_conflicto' }, 409);
      if (error instanceof SupabaseError && error.codigo === '22023') return c.json({ error: 'requisito_sin_mapeo' }, 422);
      return c.json({ error: 'revision_no_disponible' }, 503);
    }
  });

  app.post('/api/admin/revision/entregas', bodyLimit({ maxSize: 2048 }), async (c) => {
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const folio = typeof b?.folio === 'string' ? b.folio.trim().toUpperCase() : '';
    const tipo = typeof b?.tipo === 'string' ? b.tipo : '';
    if (!FOLIO.test(folio) || !/^[a-z_]{1,50}$/.test(tipo) || typeof b?.validar !== 'boolean') {
      return c.json({ error: 'datos_invalidos' }, 422);
    }
    try {
      const ok = await sb!.rest<boolean>('POST', '/rpc/registrar_entrega_sin_copia', {
        p_folio: folio, p_tipo: tipo, p_actor: c.get('actor').uid, p_validar: b.validar,
      });
      return ok ? c.json({ ok: true }) : c.json({ error: 'proyecto_no_encontrado' }, 404);
    } catch (e) {
      if (e instanceof SupabaseError && e.codigo === '40001') return c.json({ error: 'entrega_en_conflicto', detalle: e.message }, 409);
      return c.json({ error: 'entrega_no_disponible' }, 503);
    }
  });

  const abrirArchivo = (tipo: 'recepcion' | 'documento') => async (c: Context<Env>) => {
    const id = c.req.param('id') ?? '';
    if (!uuid.test(id)) return c.json({ error: 'archivo_no_encontrado' }, 404);
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    try {
      const ruta = tipo === 'recepcion'
        ? (await sb!.rest<{ ruta_almacen: string; folio: string }[]>('GET',
          '/portal_recepciones?select=ruta_almacen,folio&id=eq.' + id + '&limit=1')).map((r) => ({ path: r.ruta_almacen, folio: r.folio }))[0]
        : (await sb!.rest<{ storage_path: string; proyectos: { folio: string } }[]>('GET',
          '/documentos?select=storage_path,proyectos!inner(folio)&proyectos.es_demo=eq.false&storage_bucket=eq.expedientes&id=eq.' + id + '&limit=1'))
          .map((r) => ({ path: r.storage_path, folio: r.proyectos.folio }))[0];
      if (!ruta || !FOLIO.test(ruta.folio) || !ruta.path.startsWith(ruta.folio + '/') ||
          (tipo === 'recepcion' && !ruta.path.startsWith(ruta.folio + '/portal/')) ||
          ruta.path.split('/').some((parte) => !parte || parte === '.' || parte === '..')) {
        return c.json({ error: 'archivo_no_encontrado' }, 404);
      }
      return c.redirect(await firmarArchivo(config.supabase!, fetchFn, ruta.path));
    } catch {
      return c.json({ error: 'archivo_no_disponible' }, 503);
    }
  };
  app.get('/api/admin/revision/archivos/:id', abrirArchivo('recepcion'));
  app.get('/api/admin/expediente/archivos/:id', exigir('ver_datos'), supabaseRequerido, abrirArchivo('documento'));
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
      const kv = await Promise.all(proyectos.map(async (p) => {
        const proyecto = aProyectoKv(p, p.deal ? await leerObservaciones(cli!, p.deal.id) : []);
        return sb ? componerExpediente(sb, proyecto) : proyecto;
      }));
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
      if (estado === 'liberada' && b?.simular !== true) {
        if (!sb) return c.json({ error: 'catalogo_no_disponible', detalle: 'No se puede validar el catálogo antes de liberar la compuerta.' }, 503);
        let catalogo;
        try { catalogo = await leerCatalogoSupabase(sb); }
        catch { return c.json({ error: 'catalogo_no_disponible', detalle: 'No se pudo validar el catálogo antes de liberar la compuerta.' }, 503); }
        if (hayRequisitosPendientesDeIDC(catalogo)) return c.json({ error: 'catalogo_pendiente_idc', detalle: 'IDC debe validar el catálogo documental antes de liberar una compuerta.' }, 409);
      }
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

  // ---- Integración Zoho por adaptadores (CRM + Projects + WorkDrive). Sin credenciales: DEMO, claramente etiquetado, sin llamadas reales. ----
  app.use('/api/admin/integracion/*', exigir('sincronizar_zoho'));
  const integracion = crearIntegracion({ cli, sb, workdriveRootId: config.zoho?.workdriveRootId ?? null, ahora: () => new Date(ahora()).toISOString() });

  app.get('/api/admin/integracion/estado', (c) =>
    c.json({ modo: integracion.modo, etiqueta: integracion.etiqueta, persistencia: integracion.persistencia, servicios: integracion.servicios }));

  app.get('/api/admin/integracion/registro', (c) =>
    conErrores(c, async () => {
      const folio = folioQuery(c);
      if (folio === 'invalido') return c.json({ error: 'folio_invalido' }, 400);
      return c.json({ modo: integracion.modo, registros: await integracion.deps.registro.recientes({ folio, limite: 100 }) });
    }));

  /** Body: { folio, nombre, descripcion?, tareas[], subcarpetas[], simular? (por defecto TRUE), forzar? }. Escribir de verdad exige simular:false. */
  app.post('/api/admin/integracion/sincronizar-proyecto', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      const folio = str(b?.folio, 40);
      const nombre = str(b?.nombre, 200);
      if (!folio || !FOLIO.test(folio) || !nombre || !Array.isArray(b?.tareas) || b.tareas.length > 50) return c.json({ error: 'datos_invalidos' }, 400);
      const fecha = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
      const tareas = [];
      for (const t of b.tareas as Record<string, unknown>[]) {
        const clave = en(COMPUERTAS, t?.clave);
        const nom = str(t?.nombre, 200);
        if (!clave || !nom) return c.json({ error: 'datos_invalidos', detalle: 'Cada tarea necesita una clave de compuerta (G0–G3) y un nombre.' }, 400);
        tareas.push({ clave, nombre: nom, inicioPlan: fecha(t.inicioPlan), finPlan: fecha(t.finPlan), responsableCorreo: str(t.responsableCorreo, 200), predecesora: en(COMPUERTAS, t.predecesora) ?? null });
      }
      const subcarpetas = Array.isArray(b.subcarpetas) ? b.subcarpetas.map((s) => str(s, 60)).filter((s): s is string => s !== null).slice(0, 20) : [];
      const simular = b.simular !== false;
      if (!simular && integracion.modo === 'demo') return c.json({ error: 'demo_no_conectado', detalle: integracion.etiqueta }, 422);
      const r = await sincronizarProyecto(integracion.deps, { folio: folio.toUpperCase(), nombre, descripcion: str(b.descripcion), tareas, subcarpetas }, { simular, forzar: b.forzar === true });
      const auditado = !simular && integracion.modo === 'real' ? await auditarSync(c.get('actor'), folio, 'proyecto_sincronizado', { ok: r.ok, pasos: r.pasos.length }) : undefined;
      return c.json({ ...r, etiqueta: integracion.etiqueta, ...(auditado !== undefined && { auditado }) });
    }));

  // ---- Accesos del portal del cliente (los genera y revoca el personal; el código en claro se muestra UNA vez). ----
  app.use('/api/admin/portal/*', exigir('gestionar_portal'));
  app.post('/api/admin/portal/correo', bodyLimit({ maxSize: 2048 }), async (c) => {
    if (!supabasePortal) return c.json({ error: 'no_disponible' }, 503);
    const b = await c.req.json().catch(() => null) as { folio?: unknown; correo?: unknown } | null;
    const folio = typeof b?.folio === 'string' ? b.folio.trim().toUpperCase() : '';
    const correo = typeof b?.correo === 'string' ? normalizarCorreo(b.correo) : null;
    if (!FOLIO.test(folio) || !correo || correo.length > 254) return c.json({ error: 'datos_invalidos' }, 422);
    const token = randomBytes(32).toString('hex');
    try {
      const ok = await supabasePortal.sb.rest<boolean>('POST', '/rpc/autorizar_correo_portal', {
        p_folio: folio, p_correo: correo, p_hash: createHash('sha256').update(token).digest('hex'),
        p_token: token, p_actor: c.get('actor').uid,
      });
      return ok ? c.json({ estado: 'en_cola' }, 202) : c.json({ error: 'proyecto_no_encontrado' }, 404);
    } catch (e) {
      if (e instanceof SupabaseError && e.codigo === '40001') return c.json({ error: 'demasiados_intentos' }, 429);
      return c.json({ error: 'no_disponible' }, 503);
    }
  });
  const FOLIO_PORTAL = /^KV-(\d{4}|MOCK)-\d{3,}$/;
  const auditarPortal = async (actor: Actor, folio: string | null, accion: string, detalles: Record<string, unknown>) =>
    sb ? registrarEvento(sb, actor, { entidad: 'portal_acceso', folio, accion, detalles }) : undefined;

  /** Body: { folio, dias? (1–365, por defecto 90), permisos? }. Devuelve el código y un enlace; el código NO se vuelve a mostrar. */
  app.post('/api/admin/portal/accesos', (c) =>
    conErrores(c, async () => {
      const b = (await c.req.json().catch(() => null)) as { folio?: unknown; dias?: unknown; permisos?: Partial<PermisosPortal> } | null;
      const folio = typeof b?.folio === 'string' ? b.folio.trim().toUpperCase() : '';
      if (!FOLIO_PORTAL.test(folio)) return c.json({ error: 'folio_invalido' }, 400);
      const dias = b?.dias === undefined ? 90 : Number(b.dias);
      if (!Number.isInteger(dias) || dias < 1 || dias > 365) return c.json({ error: 'datos_invalidos', detalle: 'Los días de vigencia deben ser de 1 a 365.' }, 400);
      const p = b?.permisos ?? {};
      const permisos: PermisosPortal = {
        ver_progreso: p.ver_progreso !== false, ver_documentos_autorizados: p.ver_documentos_autorizados ?? PERMISOS_PORTAL_POR_DEFECTO.ver_documentos_autorizados,
        subir_documentos: p.subir_documentos ?? PERMISOS_PORTAL_POR_DEFECTO.subir_documentos,
        ...(p.editar_participantes === true && { editar_participantes: true }),
      };
      if (!(await fuentePortal.obtener(folio).catch(() => null))) return c.json({ error: 'proyecto_no_encontrado', detalle: 'No existe un proyecto con ese folio en la fuente de datos.' }, 404);
      const actor = c.get('actor');
      const { acceso, codigo } = await accesosPortal.crear(folio, { permisos, dias, creadoPor: actor.uid });
      const auditado = await auditarPortal(actor, folio, 'acceso_portal_creado', { accesoId: acceso.id, dias, permisos });
      const base = config.appUrl ?? new URL(c.req.url).origin;
      // El enlace lleva el código en el FRAGMENTO (#): el navegador no lo envía a ningún servidor ni queda en bitácoras.
      return c.json({ acceso, codigo, enlace: `${base}/portal#folio=${encodeURIComponent(folio)}&codigo=${encodeURIComponent(codigo)}`, ...(auditado !== undefined && { auditado }) }, 201);
    }));

  app.get('/api/admin/portal/accesos', (c) =>
    conErrores(c, async () => {
      const folio = (c.req.query('folio') ?? '').trim().toUpperCase();
      if (!FOLIO_PORTAL.test(folio)) return c.json({ error: 'folio_invalido' }, 400);
      return c.json({ accesos: await accesosPortal.listar(folio), persistencia: supabasePortal ? 'supabase' : 'memoria', demo: portalDemo });
    }));

  app.delete('/api/admin/portal/accesos/:id', (c) =>
    conErrores(c, async () => {
      const id = c.req.param('id');
      if (!/^[\w-]{8,64}$/.test(id)) return c.json({ error: 'datos_invalidos' }, 400);
      const actor = c.get('actor');
      const ok = await accesosPortal.revocar(id, actor.uid);
      if (!ok) return c.json({ error: 'no_encontrado' }, 404);
      const auditado = await auditarPortal(actor, null, 'acceso_portal_revocado', { accesoId: id });
      return c.json({ ok: true, ...(auditado !== undefined && { auditado }) });
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
