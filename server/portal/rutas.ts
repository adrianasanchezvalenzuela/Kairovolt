import { createHash, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { pasosParticipantes, validarParticipantes } from '../../src/application/participantes';
import { SupabaseError } from '../supabase/cliente';
import type { ParticipantesPortal } from './participantes';
import type { PreparacionPortal } from './preparacion';
import { datosCartaDisponibles, generarCartaDemo, MARCA_CARTA_DEMO } from './carta-demo';
import type { CartasSupabase } from './cartas-supabase';
import { generarDocumentoIlustrativo } from './recibo-demo';
import { participantesCasoEnviado, participantesCasoListo } from './memoria';
import { demosPortal } from '../../src/data/demos-portal';
import {
  construirChecklistVisita,
  evaluarElegibilidadCita,
  generarICS,
  TIPOS_VISITA,
  type TipoVisita,
} from '../../src/domain/citas/cita';
import { ErrorCita, type ProveedorAgenda } from '../citas/proveedor';
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
  abrirArchivo?: (folio: string, recibo: string) => Promise<string | null>;
  simulacion?: (folio: string, recibo: string, estado: 'rechazado' | 'prevalidado', motivo: string) => Promise<boolean>;
  citas?: ProveedorAgenda;
  simularCita?: boolean;
  preparacion?: PreparacionPortal;
  cartaDemo?: boolean;
  cartas?: CartasSupabase;
  cookie?: { nombre: string; ruta: string };
  participantes?: ParticipantesPortal;
  accesos: AccesosPortal;
  recepciones: RecepcionesPortal;
  almacen: AlmacenPortal;
  fuente: FuenteProyectoPortal;
  catalogo: (folio: string) => Promise<readonly Requisito[]>;
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
  const cookie = o.cookie ?? { nombre: COOKIE_PORTAL, ruta: '/' };
  const sesiones = o.secreto ? crearSesionesPortal(o.secreto, ahora) : null;
  const intentosFolio = crearLimitadores(5, 60_000, ahora);
  const intentosIp = crearLimitadores(30, 10 * 60_000, ahora);
  const subidas = crearLimitadores(20, 10 * 60_000, ahora);
  const ediciones = crearLimitadores(40, 10 * 60_000, ahora);
  const cartasGeneradas = new Map<string, Awaited<ReturnType<typeof generarCartaDemo>>>();
  const archivosDemo = new Map<string, { bytes: Uint8Array; mime: string }>();
  let bytesDemo = 0;
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
    setCookie(c, cookie.nombre, sesiones.crear({ acceso: acceso.id, folio: acceso.folio }), { httpOnly: true, secure: o.secureCookies === true, sameSite: 'Strict', path: cookie.ruta, maxAge: DURACION_PORTAL_S });
    return c.json({ ok: true, folio: acceso.folio });
  });

  app.delete('/sesion', (c) => {
    deleteCookie(c, cookie.nombre, { secure: o.secureCookies === true, sameSite: 'Strict', path: cookie.ruta });
    return c.json({ ok: true });
  });

  // ---- Todo lo demás exige un acceso vigente ----
  app.use('*', async (c, next) => {
    const ruta = new URL(c.req.url).pathname;
    if (ruta.endsWith('/estado') || ruta.endsWith('/acceso') || ruta.endsWith('/sesion')) return next();
    if (!sesiones) return c.json({ error: 'portal_no_disponible' }, 503);
    const datos = sesiones.leer(getCookie(c, cookie.nombre));
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
    const catalogo = await o.catalogo(acceso.folio);
    const participantes = acceso.permisos.editar_participantes === true ? await o.participantes?.consultar(acceso) : null;
    const datosAplicabilidad = participantes?.confirmado ? { tipo_titular: participantes.datos.tipoTitular } : {};
    return construirVistaPortal({ proyecto, catalogo, hoy: hoy(), recepciones, permisos: acceso.permisos, datosAplicabilidad });
  }

  app.get('/vista', async (c) => {
    const acceso = c.get('acceso');
    if (!acceso.permisos.ver_progreso) return c.json({ error: 'sin_permiso', detalle: 'Tu acceso no incluye ver el avance.' }, 403);
    const v = await vista(acceso).catch(() => 'error' as const);
    if (v === 'error') return c.json({ error: 'no_disponible', detalle: 'No se pudo consultar tu proyecto. Intenta de nuevo en un momento.' }, 502);
    if (!v) return c.json({ error: 'proyecto_no_disponible', detalle: 'Tu proyecto todavía no está disponible en el portal.' }, 404);
    const entregas = acceso.permisos.ver_documentos_autorizados ? await o.preparacion?.entregas?.(acceso).catch(() => null) : [];
    if (entregas === null) return c.json({ error: 'no_disponible', detalle: 'No pudimos consultar las entregas de tu expediente.' }, 502);
    const notifsCita = o.citas ? await o.citas.notificacionesDe(acceso.folio).catch(() => []) : [];
    const historialCita = o.citas ? await o.citas.historialDe(acceso.folio).catch(() => []) : [];
    const notificaciones = [...v.notificaciones, ...(entregas ?? []), ...notifsCita].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const historial = [...v.historial, ...historialCita].sort((a, b) => b.fecha.localeCompare(a.fecha));
    return c.json({ ...v, notificaciones, historial, persistencia: o.persistencia,
      permisos: { ...v.permisos, editarParticipantes: !!o.participantes && acceso.permisos.editar_participantes === true } });
  });

  app.get('/archivos/:recibo', async (c) => {
    const acceso = c.get('acceso');
    const recibo = c.req.param('recibo');
    if (!acceso.permisos.ver_documentos_autorizados || !/^REC-[0-9A-F]{6,12}$/.test(recibo)) {
      return c.json({ error: 'archivo_no_disponible' }, 404);
    }
    try {
      if (o.abrirArchivo) {
        const url = await o.abrirArchivo(acceso.folio, recibo);
        return url ? c.redirect(url) : c.json({ error: 'archivo_no_disponible' }, 404);
      }
      if (!o.simulacion) return c.json({ error: 'archivo_no_disponible' }, 404);
      const r = (await o.recepciones.listar(acceso.folio)).find((item) => item.recibo === recibo);
      if (!r) return c.json({ error: 'archivo_no_disponible' }, 404);
      const temporal = archivosDemo.get(acceso.folio + ':' + recibo);
      let bytes = temporal?.bytes;
      const mime = temporal?.mime ?? 'application/pdf';
      if (!bytes) {
        if (recibo === 'REC-DE0004' && acceso.folio === demosPortal[1].folio) {
          bytes = (await generarCartaDemo({ folio: acceso.folio, nombre: 'Expediente de demostración', municipio: 'Hermosillo' },
            participantesCasoEnviado, Date.parse(r.fecha), true)).bytes;
        } else if (r.documentoId === 'carta_poder' && acceso.folio === demosPortal[2].folio) {
          bytes = (await generarCartaDemo({ folio: acceso.folio, nombre: 'Expediente de demostración', municipio: 'Hermosillo' },
            participantesCasoListo, Date.parse(r.fecha), false)).bytes;
        } else {
          bytes = await generarDocumentoIlustrativo(r.documentoId);
        }
      }
      if (!bytes) return c.json({ error: 'archivo_no_disponible' }, 404);
      const extension = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1];
      return c.body(Uint8Array.from(bytes).buffer, 200, {
        'Content-Type': mime, 'Content-Disposition': (c.req.query('descargar') ? 'attachment' : 'inline') + `; filename="${recibo}.${extension}"`,
        'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "frame-ancestors 'self'",
      });
    } catch { return c.json({ error: 'archivo_no_disponible' }, 503); }
  });

  app.post('/simular-revision/:recibo', bodyLimit({ maxSize: 4096 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.simulacion || o.fuente.modo !== 'demo' || !acceso.permisos.ver_documentos_autorizados ||
        c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) return c.json({ error: 'sin_permiso' }, 403);
    const b = await c.req.json().catch(() => null) as { estado?: string; comentario?: string } | null;
    const comentario = typeof b?.comentario === 'string' ? b.comentario.trim() : '';
    if ((b?.estado !== 'rechazado' && b?.estado !== 'prevalidado') ||
        (b.estado === 'rechazado' && !comentario) || comentario.length > 500) return c.json({ error: 'datos_invalidos' }, 422);
    const ok = await o.simulacion(acceso.folio, c.req.param('recibo'), b.estado, comentario);
    return ok ? c.json({ ok: true }) : c.json({ error: 'revision_en_conflicto' }, 409);
  });

  app.get('/participantes', async (c) => {
    const acceso = c.get('acceso');
    if (!o.participantes || acceso.permisos.editar_participantes !== true) return c.json({ error: 'sin_permiso', detalle: 'El acceso no tiene habilitada la captura.' }, 403);
    try {
      return c.json({ actual: await o.participantes.consultar(acceso) });
    } catch {
      return c.json({ error: 'no_disponible', detalle: 'No se pudieron consultar tus datos.' }, 503);
    }
  });

  app.get('/preparacion', async (c) => {
    const acceso = c.get('acceso');
    if (!o.preparacion || !acceso.permisos.ver_documentos_autorizados) return c.json({ error: 'sin_permiso' }, 403);
    try { return c.json({ progreso: await o.preparacion.listar(acceso) }); }
    catch { return c.json({ error: 'no_disponible', detalle: 'No se pudo consultar la preparación.' }, 503); }
  });

  app.post('/preparacion/:id', bodyLimit({ maxSize: 2048 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.preparacion || !acceso.permisos.ver_documentos_autorizados ||
        c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) return c.json({ error: 'sin_permiso' }, 403);
    const limite = 'prep:' + acceso.id;
    if (ediciones.bloqueado(limite)) return c.json({ error: 'demasiados_intentos' }, 429);
    ediciones.falla(limite);
    const b = await c.req.json().catch(() => null) as { marcadas?: unknown; preparado?: unknown } | null;
    if (!Array.isArray(b?.marcadas) || b.marcadas.length > 30 || typeof b.preparado !== 'boolean') return c.json({ error: 'datos_invalidos' }, 422);
    try {
      const v = await vista(acceso);
      const documento = v?.documentos?.find((d) => d.id === c.req.param('id') && d.estado !== 'no_aplica');
      const guia = v?.guiaDocumental?.find((g) => g.id === documento?.id);
      if (!documento || !guia || (guia.condicion && guia.aplicabilidad !== 'aplica')) return c.json({ error: 'documento_no_solicitado' }, 404);
      const cantidad = guia.guiaPreparacion?.comprobaciones?.length ?? 0;
      const marcadas = [...new Set(b.marcadas)];
      if (marcadas.some((n) => !Number.isInteger(n) || n < 0 || n >= cantidad) || (b.preparado && marcadas.length !== cantidad)) {
        return c.json({ error: 'datos_invalidos', detalle: 'Revisa la lista antes de marcar el documento como preparado.' }, 422);
      }
      return c.json(await o.preparacion.guardar(acceso, { documento: documento.id, preparado: b.preparado, marcadas }));
    } catch { return c.json({ error: 'no_disponible', detalle: 'No se pudo guardar la lista.' }, 503); }
  });

  app.post('/carta-poder-demo', async (c) => {
    const acceso = c.get('acceso');
    if ((!o.cartaDemo && !o.cartas) || !o.participantes || !acceso.permisos.editar_participantes || !acceso.permisos.ver_documentos_autorizados ||
        c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) return c.json({ error: 'sin_permiso' }, 403);
    const limite = 'carta:' + acceso.id;
    if (ediciones.bloqueado(limite) || cartasGeneradas.size >= 250) return c.json({ error: 'demasiados_intentos' }, 429);
    ediciones.falla(limite);
    try {
      const version = await o.participantes.consultar(acceso);
      const proyecto = await o.fuente.obtener(acceso.folio);
      if (!proyecto || !datosCartaDisponibles(version)) return c.json({
        error: 'datos_invalidos', detalle: 'Confirma el titular y el representante o apoderado en Mis datos.',
      }, 422);
      if (!o.cartaDemo && !(await o.catalogo(acceso.folio)).some((r) => r.tipo === 'carta_poder' && r.activo !== false && r.generacionAutomatica)) {
        return c.json({ error: 'sin_permiso', detalle: 'IDC aún no habilitó la generación demostrativa.' }, 403);
      }
      const registro = await generarCartaDemo({ folio: proyecto.folio, nombre: proyecto.nombre, municipio: proyecto.municipio }, version, ahora());
      if (o.cartas) await o.cartas.guardar(acceso, registro);
      else cartasGeneradas.set(registro.id, registro);
      return c.body(Uint8Array.from(registro.bytes).buffer, 200, { 'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="carta-poder-demostracion.pdf"', 'X-Documento-Id': registro.id });
    } catch { return c.json({ error: 'no_disponible', detalle: 'No se pudo generar la Carta Poder.' }, 503); }
  });
  app.get('/carta-poder-demo', async (c) => {
    const acceso = c.get('acceso');
    if ((!o.cartaDemo && !o.cartas) || !acceso.permisos.editar_participantes || !acceso.permisos.ver_documentos_autorizados) {
      return c.json({ error: 'sin_permiso' }, 403);
    }
    try {
      const historial = o.cartas ? await o.cartas.listar(acceso) : [...cartasGeneradas.values()]
        .filter((r) => r.snapshot.proyecto.folio === acceso.folio).reverse().slice(0, 20)
        .map((r) => ({ id: r.id, plantilla: r.plantilla, generado_en: r.fecha }));
      return c.json({ historial });
    } catch { return c.json({ error: 'no_disponible' }, 503); }
  });
  app.get('/carta-poder-demo/:id', async (c) => {
    const acceso = c.get('acceso');
    const id = c.req.param('id');
    if (!acceso.permisos.editar_participantes || !acceso.permisos.ver_documentos_autorizados ||
        !/^[\da-f-]{36}$/i.test(id)) return c.json({ error: 'documento_no_disponible' }, 404);
    if (o.cartas) {
      try {
        const url = await o.cartas.enlazar(acceso, id);
        return url ? c.redirect(url) : c.json({ error: 'documento_no_disponible' }, 404);
      } catch { return c.json({ error: 'no_disponible' }, 503); }
    }
    const registro = cartasGeneradas.get(id);
    if (!o.cartaDemo ||
        registro?.snapshot.proyecto.folio !== acceso.folio) return c.json({ error: 'documento_no_disponible' }, 404);
    return c.body(Uint8Array.from(registro.bytes).buffer, 200, { 'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="carta-poder-demostracion.pdf"' });
  });

  app.post('/participantes', bodyLimit({ maxSize: 12_000 }), async (c) => {
    const acceso = c.get('acceso');
    if (c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) return c.json({ error: 'csrf' }, 403);
    if (!o.participantes || acceso.permisos.editar_participantes !== true) return c.json({ error: 'sin_permiso', detalle: 'El acceso no tiene habilitada la captura.' }, 403);
    if (ediciones.bloqueado(acceso.id)) return c.json({ error: 'demasiados_intentos', detalle: 'Espera unos minutos antes de volver a guardar.' }, 429);
    const entrada = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const datos = validarParticipantes(entrada?.datos);
    const version = entrada?.version;
    const confirmado = entrada?.confirmado;
    if (!datos || typeof version !== 'number' || !Number.isInteger(version) || version < 0 || version >= 2_147_483_647 ||
        typeof confirmado !== 'boolean' || (confirmado && !pasosParticipantes(datos).every(Boolean))) {
      return c.json({ error: 'datos_invalidos', detalle: 'Revisa los datos del titular y de quien tramita.' }, 422);
    }
    ediciones.falla(acceso.id);
    try {
      return c.json({ actual: await o.participantes.guardar(acceso, { datos, version, confirmado }) });
    } catch (error) {
      if (error instanceof SupabaseError && error.codigo === '40001') return c.json({ error: 'conflicto', detalle: 'Otra sesión guardó una versión. Carga la versión vigente antes de editar.' }, 409);
      if (error instanceof SupabaseError && error.codigo === '42501') return c.json({ error: 'sin_permiso', detalle: 'El acceso dejó de estar vigente.' }, 403);
      return c.json({ error: 'no_disponible', detalle: 'No se pudieron guardar tus datos.' }, 503);
    }
  });

  /** multipart/form-data con el campo `archivo`. El documento (`:id`) debe estar entre los que se le pidieron al cliente. */
  app.post('/documentos/:id', bodyLimit({ maxSize: MAX_BYTES + 1024 * 1024 }), async (c) => {
    const acceso = c.get('acceso');
    if (c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) return c.json({ error: 'csrf' }, 403);
    const permisos: PermisosPortal = acceso.permisos;
    if (!permisos.subir_documentos || !permisos.ver_documentos_autorizados) return c.json({ error: 'sin_permiso', detalle: 'Tu acceso no permite subir archivos.' }, 403);
    if (subidas.bloqueado(`s:${acceso.id}`)) return c.json({ error: 'demasiados_intentos', detalle: 'Subiste muchos archivos seguidos. Espera unos minutos.' }, 429);
    const largo = Number(c.req.header('content-length') ?? 0);
    if (largo > MAX_BYTES + 1024 * 1024) return c.json({ error: 'demasiado_grande', detalle: 'El archivo es demasiado grande (máximo 10 MB).' }, 413);

    const v = await vista(acceso).catch(() => 'error' as const);
    if (v === 'error') return c.json({ error: 'no_disponible', detalle: 'No pudimos verificar los requisitos de tu expediente.' }, 502);
    const documento = v?.documentos?.find((d) => d.id === c.req.param('id'));
    if (!v || !documento) return c.json({ error: 'documento_no_solicitado', detalle: 'Ese documento no está entre los que se te pidieron.' }, 404);
    if (!documento.puedeSubir) return c.json({ error: 'documento_no_admite_envio', detalle: 'Ese documento no necesita un envío nuevo por ahora.' }, 409);

    const form = await c.req.formData().catch(() => null);
    const archivo = form?.get('archivo');
    if (!(archivo instanceof File)) return c.json({ error: 'datos_invalidos', detalle: 'Falta el archivo.' }, 400);
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const r = validarArchivo(archivo.name, archivo.type, bytes);
    if (!r.ok) return c.json({ error: r.error, detalle: r.detalle }, r.error === 'demasiado_grande' ? 413 : 422);
    const reenvioFicticio = !!o.simulacion && acceso.folio === demosPortal[1].folio && documento.id === 'carta_poder';
    if (!reenvioFicticio && Buffer.from(r.bytes).includes(MARCA_CARTA_DEMO)) return c.json({
      error: 'documento_no_admite_envio', detalle: 'La Carta Poder de demostración no se admite como documento de revisión.',
    }, 422);

    if (o.simulacion && bytesDemo + bytes.byteLength > 24 * 1024 * 1024) return c.json({ error: 'demo_llena', detalle: 'Se alcanzó el límite temporal de archivos en la demo.' }, 413);
    if (o.simulacion) bytesDemo += r.bytes.byteLength;
    subidas.falla(`s:${acceso.id}`);
    const ruta = `${acceso.folio}/portal/${randomUUID()}/${r.nombre}`;
    try {
      await o.almacen.guardar(ruta, r.bytes, r.tipo);
      const recepcion = await o.recepciones.registrar({
        folio: acceso.folio, accesoId: acceso.id, documentoId: documento.id, documento: documento.nombre, archivo: r.nombre, mime: r.tipo,
        tamano: r.bytes.byteLength, sha256: createHash('sha256').update(r.bytes).digest('hex'), rutaAlmacen: ruta,
      });
      if (o.simulacion) {
        archivosDemo.set(acceso.folio + ':' + recepcion.recibo, { bytes: r.bytes, mime: r.tipo });
      }
      return c.json({ ok: true, recepcion, archivosGuardados: o.persistencia.archivos === 'supabase' }, 201);
    } catch (error) {
      if (o.simulacion) bytesDemo -= r.bytes.byteLength;
      // Una respuesta SQL de rechazo confirma que la transacción no insertó la recepción.
      // Ante una desconexión no se borra el archivo, porque la escritura pudo haberse confirmado.
      if (error instanceof SupabaseError && error.codigo && /^(22|23|40|42|PGRST)/.test(error.codigo)) {
        await o.almacen.retirar?.(ruta).catch(() => undefined);
        if (error.codigo === '40001') return c.json({ error: 'documento_no_admite_envio', detalle: 'Ya existe un envío pendiente de revisión.' }, 409);
      }
      return c.json({ error: 'no_se_pudo_guardar', detalle: 'No pudimos guardar tu archivo. Inténtalo de nuevo.' }, 502);
    }
  });

  // ---- Mi próxima visita a IDC (checklist dinámico, disponibilidad y citas) ----
  const responderErrorCita = (c: Context<Env>, e: unknown) => {
    if (e instanceof ErrorCita) return c.json({ error: e.codigo, detalle: e.message }, e.httpStatus);
    return c.json({ error: 'no_disponible', detalle: 'No pudimos completar la operación de cita.' }, 503);
  };

  app.get('/visita/resumen', async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados) return c.json({ error: 'sin_permiso' }, 403);
    try {
      const v = await vista(acceso);
      if (!v) return c.json({ error: 'proyecto_no_disponible' }, 404);
      const preparacion = (await o.preparacion?.listar(acceso).catch(() => [])) ?? [];
      const entregasRegistradas = (await o.preparacion?.entregasRegistradas?.(acceso).catch(() => [])) ?? [];
      const marcados = await o.citas.obtenerChecklistVisita(acceso.folio);
      const [config, citaActiva, citas] = await Promise.all([
        o.citas.obtenerConfig(),
        o.citas.obtenerActiva(acceso.folio),
        o.citas.listarPorFolio(acceso.folio),
      ]);
      const elegibilidad = evaluarElegibilidadCita('entrega_expediente', v, preparacion);
      const checklist = construirChecklistVisita(v, marcados, entregasRegistradas);
      return c.json({
        elegibilidad,
        checklist,
        citaActiva,
        citas,
        config,
        correoContacto: o.fuente.modo === 'demo' ? 'cliente-demo@example.invalid' : null,
      });
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  app.post('/visita/checklist', bodyLimit({ maxSize: 4096 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados || c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) {
      return c.json({ error: 'sin_permiso' }, 403);
    }
    const b = await c.req.json().catch(() => null) as { marcados?: unknown } | null;
    if (!Array.isArray(b?.marcados) || b.marcados.length > 40 || b.marcados.some((x) => typeof x !== 'string')) {
      return c.json({ error: 'datos_invalidos', detalle: 'Lista de preparación inválida.' }, 422);
    }
    try {
      const v = await vista(acceso);
      const validos = new Set((v?.documentos ?? []).filter((d) => d.estado !== 'no_aplica').map((d) => d.id));
      const filtrados = (b.marcados as string[]).filter((id) => validos.has(id));
      const guardados = await o.citas.guardarChecklistVisita(acceso.folio, acceso.id, filtrados);
      return c.json({ marcados: guardados });
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  app.get('/visita/disponibilidad', async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados) return c.json({ error: 'sin_permiso' }, 403);
    const mes = c.req.query('mes') ?? hoy().slice(0, 7);
    const tipoParam = c.req.query('tipo') ?? 'entrega_expediente';
    const tipo = TIPOS_VISITA.find((t) => t === tipoParam);
    if (!tipo || !/^\d{4}-\d{2}$/.test(mes)) return c.json({ error: 'datos_invalidos', detalle: 'Parámetros de calendario inválidos.' }, 422);
    try {
      return c.json(await o.citas.consultarDisponibilidad(mes, tipo));
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  app.post('/visita/solicitar', bodyLimit({ maxSize: 4096 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados || c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) {
      return c.json({ error: 'sin_permiso' }, 403);
    }
    const limite = 'cita:' + acceso.id;
    if (ediciones.bloqueado(limite)) return c.json({ error: 'demasiados_intentos', detalle: 'Espera un momento antes de enviar otra solicitud.' }, 429);
    ediciones.falla(limite);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const tipoVisita = TIPOS_VISITA.find((t) => t === b?.tipoVisita) as TipoVisita | undefined;
    const fecha = typeof b?.fecha === 'string' ? b.fecha.trim() : '';
    const horaInicio = typeof b?.horaInicio === 'string' ? b.horaInicio.trim() : '';
    const notasCliente = typeof b?.notasCliente === 'string' ? b.notasCliente.trim().slice(0, 500) || null : null;
    const idempotencyKey = typeof b?.idempotencyKey === 'string' && b.idempotencyKey.trim().length >= 8 && b.idempotencyKey.trim().length <= 80
      ? b.idempotencyKey.trim() : null;
    if (!tipoVisita || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(horaInicio)) {
      return c.json({ error: 'datos_invalidos', detalle: 'Elige tipo de visita, fecha y horario válidos.' }, 422);
    }
    try {
      const v = await vista(acceso);
      if (!v) return c.json({ error: 'proyecto_no_disponible' }, 404);
      const preparacion = (await o.preparacion?.listar(acceso).catch(() => [])) ?? [];
      const elegibilidad = evaluarElegibilidadCita(tipoVisita, v, preparacion);
      const resultado = await o.citas.solicitar({
        folio: acceso.folio,
        accesoId: acceso.id,
        tipoVisita,
        fecha,
        horaInicio,
        notasCliente,
        idempotencyKey,
        expedienteListo: elegibilidad.permitida,
        motivoNoListo: elegibilidad.motivoBloqueo,
      });
      return c.json(resultado, resultado.duplicada ? 200 : 201);
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  app.post('/visita/:id/reprogramar', bodyLimit({ maxSize: 4096 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados || c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) {
      return c.json({ error: 'sin_permiso' }, 403);
    }
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const accion = b?.accion === 'aceptar_propuesta' ? 'aceptar_propuesta' : 'solicitar_cambio';
    const nuevaFecha = typeof b?.nuevaFecha === 'string' ? b.nuevaFecha.trim() : null;
    const nuevaHoraInicio = typeof b?.nuevaHoraInicio === 'string' ? b.nuevaHoraInicio.trim() : null;
    const motivo = typeof b?.motivo === 'string' ? b.motivo.trim().slice(0, 500) : null;
    try {
      const cita = await o.citas.accionCliente({
        folio: acceso.folio,
        citaId: c.req.param('id'),
        accion,
        nuevaFecha,
        nuevaHoraInicio,
        motivo,
      });
      return c.json({ cita });
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  app.post('/visita/:id/cancelar', bodyLimit({ maxSize: 2048 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados || c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) {
      return c.json({ error: 'sin_permiso' }, 403);
    }
    const b = await c.req.json().catch(() => null) as { motivo?: unknown } | null;
    const motivo = typeof b?.motivo === 'string' ? b.motivo.trim().slice(0, 500) : null;
    try {
      const cita = await o.citas.accionCliente({
        folio: acceso.folio,
        citaId: c.req.param('id'),
        accion: 'cancelar',
        motivo,
      });
      return c.json({ cita });
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  app.get('/visita/:id/ics', async (c) => {
    const acceso = c.get('acceso');
    if (!o.citas || !acceso.permisos.ver_documentos_autorizados) return c.json({ error: 'sin_permiso' }, 403);
    const cita = await o.citas.obtenerPorId(c.req.param('id')).catch(() => null);
    if (!cita || cita.folio !== acceso.folio) return c.json({ error: 'cita_no_encontrada' }, 404);
    const ics = generarICS(cita);
    if (!ics) return c.json({ error: 'transicion_invalida', detalle: 'El archivo de calendario solo está disponible cuando tu cita está confirmada.' }, 409);
    return c.body(ics, 200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${cita.referencia}.ics"`,
    });
  });

  /** Simulador exclusivo del entorno local de demos para probar la respuesta de IDC en Demo 3. Nunca se monta en /api/portal. */
  app.post('/simular-cita/:id', bodyLimit({ maxSize: 4096 }), async (c) => {
    const acceso = c.get('acceso');
    if (!o.simularCita || !o.citas || o.fuente.modo !== 'demo' || c.req.header(CABECERA_CSRF_PORTAL) !== VALOR_CSRF_PORTAL) {
      return c.json({ error: 'sin_permiso' }, 403);
    }
    const cita = await o.citas.obtenerPorId(c.req.param('id')).catch(() => null);
    if (!cita || cita.folio !== acceso.folio) return c.json({ error: 'cita_no_encontrada' }, 404);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const acciones = ['confirmar', 'proponer_horario', 'reprogramar', 'cancelar', 'realizada'] as const;
    const accion = acciones.find((a) => a === b?.accion);
    if (!accion) return c.json({ error: 'datos_invalidos' }, 422);
    try {
      const actualizada = await o.citas.accionAdmin({
        citaId: cita.id,
        actorId: null,
        accion,
        nuevaFecha: typeof b?.nuevaFecha === 'string' ? b.nuevaFecha.trim() : null,
        nuevaHoraInicio: typeof b?.nuevaHoraInicio === 'string' ? b.nuevaHoraInicio.trim() : null,
        motivo: typeof b?.motivo === 'string' ? b.motivo.trim().slice(0, 500) : null,
        ubicacionAutorizada: typeof b?.ubicacionAutorizada === 'string' ? b.ubicacionAutorizada.trim().slice(0, 240) : undefined,
      });
      return c.json({ cita: actualizada });
    } catch (e) {
      return responderErrorCita(c, e);
    }
  });

  return app;
}
