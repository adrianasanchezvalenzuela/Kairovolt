import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { construirVistaPortal, normalizarFolio, type PermisosPortal } from '../../src/application/portal-cliente';
import type { Requisito } from '../../src/domain/checklist/checklist';
import { crearLimitadores } from '../sesiones';
import { validarArchivo, MAX_BYTES } from './archivos';
import { FORMATO_CODIGO } from './codigo';
import { COOKIE_PORTAL, crearSesionesPortal, DURACION_PORTAL_S } from './sesion';
import type { AccesoPortal, AccesosPortal, AlmacenPortal, FuenteProyectoPortal, RecepcionesPortal } from './tipos';

export const CABECERA_CSRF_PORTAL = 'x-requested-with';
export const VALOR_CSRF_PORTAL = 'kairovolt';
const FOLIO = /^KV-(\d{4}|MOCK)-\d{3,}$/;

export interface OpcionesPortal {
  accesos: AccesosPortal;
  recepciones: RecepcionesPortal;
  almacen: AlmacenPortal;
  fuente: FuenteProyectoPortal;
  catalogo: () => Promise<readonly Requisito[]>;
  /** Clave de firma de las cookies del portal; null = portal deshabilitado (503). */
  secreto: string | null;
  /** Qué se guarda de verdad (para informarlo en pantalla). */
  persistencia: { accesos: 'supabase' | 'memoria'; archivos: 'supabase' | 'no_se_guardan' };
  /** Solo en modo demo: código de ejemplo que la pantalla de acceso puede mostrar. */
  codigoDemo?: string | null;
  /** Debe coincidir con el entorno TLS de la aplicación. */
  secureCookies?: boolean;
  ahora?: () => number;
}

type Env = { Variables: { acceso: AccesoPortal } };

/**
 * Rutas del portal del cliente (`/api/portal/*`). PERMISOS EN EL BACKEND:
 *  - todo (salvo /estado y /acceso) exige una cookie de portal válida, firmada y con el acceso AÚN vigente (se revalida en cada petición);
 *  - el folio sale SIEMPRE de la sesión, nunca de la petición: un cliente no puede pedir el de otro;
 *  - la respuesta es la proyección pública por lista blanca (`construirVistaPortal`);
 *  - subir exige el permiso `subir_documentos` y que el documento sea uno de los que se le pidieron.
 * La cookie del personal (`kv_sesion`) no sirve aquí ni la del portal en `/api/admin`.
 */
export function crearRutasPortal(o: OpcionesPortal): Hono<Env> {
  const app = new Hono<Env>();
  const ahora = o.ahora ?? Date.now;
  const sesiones = o.secreto ? crearSesionesPortal(o.secreto, ahora) : null;
  const intentosFolio = crearLimitadores(5, 60_000, ahora);
  const intentosIp = crearLimitadores(30, 10 * 60_000, ahora);
  const subidas = crearLimitadores(20, 10 * 60_000, ahora);
  const hoy = () => new Date(ahora()).toISOString().slice(0, 10);

  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store'); // nada del portal se guarda en cachés compartidas
    c.header('X-Content-Type-Options', 'nosniff');
  });

  app.get('/estado', (c) => c.json({
    disponible: sesiones !== null, demo: o.fuente.modo === 'demo', persistencia: o.persistencia, ...(o.fuente.modo === 'demo' && o.codigoDemo ? { codigoDemo: o.codigoDemo } : {}),
  }));

  /** Body: { folio, codigo }. Cualquier fallo responde lo mismo (no revela si el folio existe, si el código venció o si lo revocaron). */
  app.post('/acceso', async (c) => {
    if (!sesiones) return c.json({ error: 'portal_no_disponible' }, 503);
    const b = (await c.req.json().catch(() => null)) as { folio?: unknown; codigo?: unknown } | null;
    const folio = typeof b?.folio === 'string' ? normalizarFolio(b.folio) : '';
    const codigo = typeof b?.codigo === 'string' ? b.codigo.trim() : '';
    const ip = (c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'sin-ip').split(',')[0]!.trim();
    if (intentosFolio.bloqueado(`f:${folio}`) || intentosIp.bloqueado(`i:${ip}`)) return c.json({ error: 'demasiados_intentos', detalle: 'Demasiados intentos. Espera un minuto.' }, 429);
    const invalido = () => {
      intentosFolio.falla(`f:${folio}`);
      intentosIp.falla(`i:${ip}`);
      return c.json({ error: 'acceso_invalido', detalle: 'El folio o el código no son correctos, o el acceso ya no está vigente.' }, 401);
    };
    if (!FOLIO.test(folio) || !FORMATO_CODIGO.test(codigo)) return invalido();
    const acceso = await o.accesos.verificar(folio, codigo).catch(() => null);
    if (!acceso) return invalido();
    intentosFolio.exito(`f:${folio}`);
    setCookie(c, COOKIE_PORTAL, sesiones.crear({ acceso: acceso.id, folio: acceso.folio }), { httpOnly: true, secure: o.secureCookies === true, sameSite: 'Strict', path: '/', maxAge: DURACION_PORTAL_S });
    return c.json({ ok: true, folio: acceso.folio });
  });

  app.delete('/sesion', (c) => {
    deleteCookie(c, COOKIE_PORTAL, { secure: o.secureCookies === true, sameSite: 'Strict', path: '/' });
    return c.json({ ok: true });
  });

  // ---- Todo lo demás exige un acceso vigente ----
  app.use('*', async (c, next) => {
    const ruta = new URL(c.req.url).pathname;
    if (ruta.endsWith('/estado') || ruta.endsWith('/acceso') || ruta.endsWith('/sesion')) return next();
    if (!sesiones) return c.json({ error: 'portal_no_disponible' }, 503);
    const datos = sesiones.leer(getCookie(c, COOKIE_PORTAL));
    if (!datos) return c.json({ error: 'sin_sesion' }, 401);
    const acceso = await o.accesos.obtener(datos.acceso).catch(() => null);
    if (!acceso || acceso.folio !== datos.folio) return c.json({ error: 'sin_sesion' }, 401); // revocado, vencido o alterado
    c.set('acceso', acceso);
    return next();
  });

  async function vista(acceso: AccesoPortal) {
    const proyecto = await o.fuente.obtener(acceso.folio);
    if (!proyecto) return null;
    const recepciones = await o.recepciones.listar(acceso.folio);
    const catalogo = await o.catalogo();
    return construirVistaPortal({ proyecto, catalogo, hoy: hoy(), recepciones, permisos: acceso.permisos });
  }

  app.get('/vista', async (c) => {
    const acceso = c.get('acceso');
    if (!acceso.permisos.ver_progreso) return c.json({ error: 'sin_permiso', detalle: 'Tu acceso no incluye ver el avance.' }, 403);
    const v = await vista(acceso).catch(() => 'error' as const);
    if (v === 'error') return c.json({ error: 'no_disponible', detalle: 'No se pudo consultar tu proyecto. Intenta de nuevo en un momento.' }, 502);
    if (!v) return c.json({ error: 'proyecto_no_disponible', detalle: 'Tu proyecto todavía no está disponible en el portal.' }, 404);
    return c.json({ ...v, persistencia: o.persistencia });
  });

  /** multipart/form-data con el campo `archivo`. El documento (`:id`) debe estar entre los que se le pidieron al cliente. */
  app.post('/documentos/:id', async (c) => {
    const acceso = c.get('acceso');
    if (c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) return c.json({ error: 'csrf' }, 403);
    const permisos: PermisosPortal = acceso.permisos;
    if (!permisos.subir_documentos || !permisos.ver_documentos_autorizados) return c.json({ error: 'sin_permiso', detalle: 'Tu acceso no permite subir archivos.' }, 403);
    if (subidas.bloqueado(`s:${acceso.id}`)) return c.json({ error: 'demasiados_intentos', detalle: 'Subiste muchos archivos seguidos. Espera unos minutos.' }, 429);
    const largo = Number(c.req.header('content-length') ?? 0);
    if (largo > MAX_BYTES + 1024 * 1024) return c.json({ error: 'demasiado_grande', detalle: 'El archivo es demasiado grande (máximo 10 MB).' }, 413);

    const v = await vista(acceso).catch(() => null);
    const documento = v?.documentos?.find((d) => d.id === c.req.param('id'));
    if (!v || !documento) return c.json({ error: 'documento_no_solicitado', detalle: 'Ese documento no está entre los que se te pidieron.' }, 404);
    if (!documento.puedeSubir) return c.json({ error: 'documento_no_admite_envio', detalle: 'Ese documento no necesita un envío nuevo por ahora.' }, 409);

    const form = await c.req.formData().catch(() => null);
    const archivo = form?.get('archivo');
    if (!(archivo instanceof File)) return c.json({ error: 'datos_invalidos', detalle: 'Falta el archivo.' }, 400);
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const r = validarArchivo(archivo.name, archivo.type, bytes);
    if (!r.ok) return c.json({ error: r.error, detalle: r.detalle }, r.error === 'demasiado_grande' ? 413 : 422);

    subidas.falla(`s:${acceso.id}`);
    const ruta = `${acceso.folio}/portal/${randomUUID()}/${r.nombre}`;
    try {
      await o.almacen.guardar(ruta, r.bytes, r.tipo);
      const recepcion = await o.recepciones.registrar({
        folio: acceso.folio, accesoId: acceso.id, documentoId: documento.id, documento: documento.nombre, archivo: r.nombre, mime: r.tipo,
        tamano: r.bytes.byteLength, sha256: createHash('sha256').update(r.bytes).digest('hex'), rutaAlmacen: ruta,
      });
      return c.json({ ok: true, recepcion, archivosGuardados: o.persistencia.archivos === 'supabase' }, 201);
    } catch {
      return c.json({ error: 'no_se_pudo_guardar', detalle: 'No pudimos guardar tu archivo. Inténtalo de nuevo.' }, 502);
    }
  });

  return app;
}
