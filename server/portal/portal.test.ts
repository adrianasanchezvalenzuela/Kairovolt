import { describe, expect, it } from 'vitest';
import { crearApp } from '../app';
import type { ConfigServidor } from '../config';
import { crearClienteSupabase } from '../supabase/cliente';
import { supabaseCfg, supabaseFalso } from '../supabase/falso';
import { detectarTipo, MAX_BYTES, sanearNombre, validarArchivo } from './archivos';
import { FORMATO_CODIGO, generarCodigo, huellaCodigo, normalizarCodigo } from './codigo';
import { CODIGO_DEMO, crearAccesosMemoria, FOLIO_DEMO } from './memoria';
import { COOKIE_PORTAL, crearSesionesPortal, DURACION_PORTAL_S } from './sesion';
import { crearAccesosSupabase, crearAlmacenSupabase } from './supabase';
import { demosPortal } from '../../src/data/demos-portal';

const TOKEN = 'token-de-emergencia-largo';
const H = { 'Content-Type': 'application/json' };
const demo = (extra: Partial<ConfigServidor> = {}): ConfigServidor => ({ port: 0, zoho: null, supabase: null, adminToken: TOKEN, ...extra });
const CSRF = { 'x-requested-with': 'kairovolt' };

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0]);

async function entrar(app: ReturnType<typeof crearApp>, folio = FOLIO_DEMO, codigo = CODIGO_DEMO) {
  const r = await app.request('/api/portal/acceso', { method: 'POST', headers: H, body: JSON.stringify({ folio, codigo }) });
  return { r, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '' };
}
const get = (app: ReturnType<typeof crearApp>, ruta: string, cookie = '') => app.request(ruta, { headers: cookie ? { Cookie: cookie } : {} });

it('aísla los casos locales de Supabase y presenta un expediente con envíos previos', async () => {
  const app = crearApp(demo({ supabase: supabaseCfg }), async () => { throw new Error('La demo no debe contactar Supabase'); }, Date.now, true);
  const entrarDemo = async ({ folio, codigo }: typeof demosPortal[number]) => {
    const r = await app.request('/api/demo/portal/acceso', { method: 'POST', headers: H, body: JSON.stringify({ folio, codigo }) });
    expect(r.status).toBe(200);
    return r.headers.get('set-cookie')!.split(';')[0]!;
  };
  const primera = await entrarDemo(demosPortal[0]);
  const segunda = await entrarDemo(demosPortal[1]);
  const pendiente = await get(app, '/api/demo/portal/vista', primera);
  const enviado = await get(app, '/api/demo/portal/vista', segunda);
  expect(await pendiente.json()).toMatchObject({ folio: demosPortal[0].folio, recepciones: [] });
  expect(await enviado.json()).toMatchObject({
    folio: demosPortal[1].folio,
    recepciones: expect.arrayContaining([expect.objectContaining({ estado: 'aceptado' }), expect.objectContaining({ estado: 'en_revision' })]),
  });
  expect((await get(app, '/api/portal/vista', segunda)).status).toBe(401);
});
const subir = (app: ReturnType<typeof crearApp>, cookie: string, id: string, bytes: Uint8Array, nombre = 'doc.pdf', tipo = 'application/pdf', headers: Record<string, string> = CSRF) => {
  const f = new FormData();
  f.set('archivo', new File([bytes as unknown as BlobPart], nombre, { type: tipo }));
  return app.request(`/api/portal/documentos/${id}`, { method: 'POST', headers: { Cookie: cookie, ...headers }, body: f });
};

describe('archivos: validación por contenido', () => {
  it('detecta el tipo real por los primeros bytes', () => {
    expect(detectarTipo(PDF)).toBe('application/pdf');
    expect(detectarTipo(PNG)).toBe('image/png');
    expect(detectarTipo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(detectarTipo(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
    expect(detectarTipo(EXE)).toBeNull();
    expect(detectarTipo(new Uint8Array([]))).toBeNull();
  });
  it('rechaza vacíos, demasiado grandes, ejecutables disfrazados y tipos que no coinciden', () => {
    expect(validarArchivo('a.pdf', 'application/pdf', new Uint8Array([]))).toMatchObject({ ok: false, error: 'vacio' });
    expect(validarArchivo('a.exe', 'application/pdf', EXE)).toMatchObject({ ok: false, error: 'tipo_no_permitido' });
    expect(validarArchivo('a.pdf', 'image/png', PDF)).toMatchObject({ ok: false, error: 'tipo_no_coincide' });
    expect(validarArchivo('a.pdf', 'application/pdf', PDF, 5)).toMatchObject({ ok: false, error: 'demasiado_grande' });
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
  });
  it('acepta un tipo declarado genérico o vacío si el contenido es válido', () => {
    expect(validarArchivo('a.pdf', '', PDF).ok).toBe(true);
    expect(validarArchivo('a.pdf', 'application/octet-stream', PDF).ok).toBe(true);
  });
  it('sanea el nombre: sin rutas, sin caracteres peligrosos, con la extensión del tipo real', () => {
    expect(sanearNombre('../../etc/passwd.pdf', 'application/pdf')).toBe('passwd.pdf');
    expect(sanearNombre('C:\\Users\\x\\Identificación oficial (INE).jpeg', 'image/jpeg')).toBe('Identificación oficial (INE).jpg');
    expect(sanearNombre('<script>alert(1)</script>.png', 'image/png')).toBe('script.png');
    expect(sanearNombre('...', 'application/pdf')).toBe('documento.pdf');
    expect(sanearNombre('a'.repeat(200) + '.pdf', 'application/pdf').length).toBeLessThanOrEqual(84);
  });
});

describe('código de acceso', () => {
  it('tiene el formato esperado, sin caracteres ambiguos, y se normaliza', () => {
    const c = generarCodigo();
    expect(c).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(c).not.toMatch(/[01OIL]/);
    expect(FORMATO_CODIGO.test(c)).toBe(true);
    expect(normalizarCodigo(c.toLowerCase().replaceAll('-', ' '))).toBe(normalizarCodigo(c));
    expect(huellaCodigo(c)).toMatch(/^[a-f0-9]{64}$/);
    expect(huellaCodigo(c)).toBe(huellaCodigo(c.toLowerCase()));
    expect(generarCodigo()).not.toBe(c);
  });
});

describe('sesión del portal', () => {
  const t0 = 1_800_000_000_000;
  it('firma y lee; rechaza cookies alteradas, de otra clave o vencidas', () => {
    let ahora = t0;
    const s = crearSesionesPortal('clave', () => ahora);
    const cookie = s.crear({ acceso: 'a1', folio: 'KV-2026-004' });
    expect(s.leer(cookie)).toEqual({ acceso: 'a1', folio: 'KV-2026-004' });
    expect(s.leer(cookie.replace(/.$/, (x) => (x === 'a' ? 'b' : 'a')))).toBeNull();
    const [carga, firma] = cookie.split('.');
    const otro = Buffer.from(JSON.stringify({ a: 'a1', f: 'KV-2026-999', e: Math.floor(t0 / 1000) + 9999 })).toString('base64url');
    expect(s.leer(`${otro}.${firma}`)).toBeNull(); // cambiar el folio invalida la firma
    expect(carga).toBeTruthy();
    expect(crearSesionesPortal('otra', () => ahora).leer(cookie)).toBeNull();
    ahora += (DURACION_PORTAL_S + 1) * 1000;
    expect(s.leer(cookie)).toBeNull();
    expect(s.leer(undefined)).toBeNull();
    expect(s.leer('basura')).toBeNull();
  });
});

describe('accesos en memoria', () => {
  it('verifica por código Y folio; revocado o vencido no pasa', async () => {
    let t = 1_800_000_000_000;
    const a = crearAccesosMemoria(() => t);
    const { acceso, codigo } = await a.crear('KV-2026-004', { permisos: { ver_progreso: true, ver_documentos_autorizados: true, subir_documentos: false }, dias: 1, creadoPor: null });
    expect(await a.verificar('KV-2026-004', codigo)).toMatchObject({ id: acceso.id });
    expect(await a.verificar('KV-2026-005', codigo)).toBeNull(); // el código de un folio no abre otro
    expect(await a.verificar('KV-2026-004', 'AAAA-BBBB-CCCC-DDDD')).toBeNull();
    expect(JSON.stringify(await a.listar('KV-2026-004'))).not.toContain(codigo);
    await a.revocar(acceso.id, null);
    expect(await a.verificar('KV-2026-004', codigo)).toBeNull();
    expect(await a.obtener(acceso.id)).toBeNull();
    const b = await a.crear('KV-2026-004', { permisos: acceso.permisos, dias: 1, creadoPor: null });
    t += 2 * 86_400_000;
    expect(await a.verificar('KV-2026-004', b.codigo)).toBeNull();
  });
});

describe('portal: acceso y permisos en el backend', () => {
  it('estado público: avisa que es demo y da el código de ejemplo solo en demo', async () => {
    const r = await crearApp(demo()).request('/api/portal/estado');
    expect(await r.json()).toMatchObject({ disponible: true, demo: true, codigoDemo: CODIGO_DEMO, persistencia: { archivos: 'no_se_guardan' } });
  });

  it('código correcto: cookie HttpOnly + SameSite=Strict, sin token en el cuerpo', async () => {
    const { r, cookie } = await entrar(crearApp(demo()));
    expect(r.status).toBe(200);
    const sc = r.headers.get('set-cookie') ?? '';
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
    expect(cookie.startsWith(`${COOKIE_PORTAL}=`)).toBe(true);
    expect(await r.text()).not.toContain(CODIGO_DEMO);
  });

  it('folio o código incorrectos responden lo mismo (no revela qué falló) y tras 5 intentos se bloquea', async () => {
    const app = crearApp(demo());
    const malos = [await entrar(app, FOLIO_DEMO, 'AAAA-BBBB-CCCC-DDDD'), await entrar(app, 'KV-2026-999', CODIGO_DEMO), await entrar(app, 'no-es-folio', 'x')];
    const cuerpos = await Promise.all(malos.map((m) => m.r.json()));
    expect(malos.map((m) => m.r.status)).toEqual([401, 401, 401]);
    expect(new Set(cuerpos.map((c) => JSON.stringify(c))).size).toBe(1);
    for (let i = 0; i < 4; i++) await entrar(app, FOLIO_DEMO, 'AAAA-BBBB-CCCC-DDDD');
    expect((await entrar(app, FOLIO_DEMO, CODIGO_DEMO)).r.status).toBe(429);
  });

  it('sin sesión no hay nada: vista y subida responden 401', async () => {
    const app = crearApp(demo());
    expect((await get(app, '/api/portal/vista')).status).toBe(401);
    expect((await subir(app, '', 'recibo_cfe', PDF)).status).toBe(401);
  });

  it('las credenciales del personal NO sirven en el portal, ni la cookie del portal en /api/admin', async () => {
    const app = crearApp(demo());
    const bearer = await app.request('/api/portal/vista', { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(bearer.status).toBe(401);
    const { cookie } = await entrar(app);
    expect((await get(app, '/api/admin/portal/accesos?folio=KV-2026-004', cookie)).status).toBe(401);
    expect((await get(app, '/api/admin/kv/proyectos', cookie)).status).toBe(401);
    expect((await (await get(app, '/api/sesion', cookie)).json()) as { autenticado: boolean }).toMatchObject({ autenticado: false });
  });

  it('el folio sale de la sesión: pedir otro por la URL no cambia nada', async () => {
    const app = crearApp(demo());
    const { cookie } = await entrar(app);
    const v = (await (await get(app, '/api/portal/vista?folio=KV-2026-999&proyecto=otro', cookie)).json()) as { folio: string };
    expect(v.folio).toBe('KV-2026-004');
  });

  it('la vista es solo la proyección pública: sin datos internos, valores discrepantes, responsables ni observaciones', async () => {
    const app = crearApp(demo());
    const { cookie } = await entrar(app);
    const r = await get(app, '/api/portal/vista', cookie);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const texto = await r.text();
    expect(texto).not.toMatch(/CS3\.2|CS6\.2|6921|697\.52|MT \/ BT|discrepan/i);
    expect(texto).not.toMatch(/Ingeniería IDC|Proyectista|Supervisor de campo|Coordinación administrativa|Gestión IDC/);
    expect(texto).not.toMatch(/observacion|paer|ppc|hallazgo|bloqueante|configuracionTecnica|costo|zoho|token|secret/i);
    expect(texto).not.toMatch(/Completar los campos vacíos del croquis|Solicitar al cliente un recibo|Validación cruzada|Ingeniería: unifilar/);
    const v = JSON.parse(texto) as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(['avance', 'demo', 'documentos', 'documentosTecnicos', 'etapaActual', 'etapas', 'folio', 'guiaDocumental', 'historial', 'nombre', 'notificaciones', 'permisos', 'persistencia', 'recepciones', 'siguientePaso', 'ubicacion']);
    expect(v.demo).toBe(true);
  });

  it('un acceso sin permiso de documentos no recibe la lista ni puede subir; sin ver_progreso no ve el avance', async () => {
    const app = crearApp(demo());
    const crear = async (permisos: object) => {
      const r = await app.request('/api/admin/portal/accesos', { method: 'POST', headers: { ...H, Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ folio: FOLIO_DEMO, permisos }) });
      expect(r.status).toBe(201);
      return ((await r.json()) as { codigo: string }).codigo;
    };
    const sinDocs = await entrar(app, FOLIO_DEMO, await crear({ ver_documentos_autorizados: false }));
    const v = (await (await get(app, '/api/portal/vista', sinDocs.cookie)).json()) as { documentos: unknown; guiaDocumental: unknown; recepciones: unknown[]; permisos: { subirDocumentos: boolean } };
    expect(v.documentos).toBeNull();
    expect(v.guiaDocumental).toBeNull();
    expect(v.recepciones).toEqual([]);
    expect((await subir(app, sinDocs.cookie, 'recibo_cfe', PDF)).status).toBe(403);
    const sinProgreso = await entrar(app, FOLIO_DEMO, await crear({ ver_progreso: false }));
    expect((await get(app, '/api/portal/vista', sinProgreso.cookie)).status).toBe(403);
    const soloLectura = await entrar(app, FOLIO_DEMO, await crear({ subir_documentos: false }));
    expect((await subir(app, soloLectura.cookie, 'recibo_cfe', PDF)).status).toBe(403);
  });

  it('revocar un acceso corta la sesión de inmediato, aunque la cookie siga firmada', async () => {
    const app = crearApp(demo());
    const creado = (await (await app.request('/api/admin/portal/accesos', { method: 'POST', headers: { ...H, Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ folio: FOLIO_DEMO, dias: 7 }) })).json()) as { codigo: string; acceso: { id: string }; enlace: string };
    expect(creado.enlace).toContain('#folio=KV-2026-004&codigo='); // el código va en el fragmento, no en la query
    expect(creado.enlace).not.toContain('?');
    const { cookie, r } = await entrar(app, FOLIO_DEMO, creado.codigo);
    expect(r.status).toBe(200);
    expect((await get(app, '/api/portal/vista', cookie)).status).toBe(200);
    const rev = await app.request(`/api/admin/portal/accesos/${creado.acceso.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(rev.status).toBe(200);
    expect((await get(app, '/api/portal/vista', cookie)).status).toBe(401);
    expect((await entrar(app, FOLIO_DEMO, creado.codigo)).r.status).toBe(401);
  });
});

describe('portal: administración de accesos (solo personal autorizado)', () => {
  it('exige sesión y el permiso gestionar_portal; no existe para el cliente', async () => {
    const app = crearApp(demo());
    expect((await app.request('/api/admin/portal/accesos', { method: 'POST', headers: H, body: JSON.stringify({ folio: FOLIO_DEMO }) })).status).toBe(401);
    const ok = await app.request('/api/admin/portal/accesos', { method: 'POST', headers: { ...H, Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ folio: FOLIO_DEMO }) });
    expect(ok.status).toBe(201);
  });

  it('un rol sin permiso (consulta o proyectista) recibe 403; coordinación sí puede', async () => {
    const sb = supabaseFalso();
    const cfg = demo({ supabase: supabaseCfg, portalDemo: true });
    const app = crearApp(cfg, sb.fetchFn);
    const entrarRol = async (rol: string, n: number) => {
      const id = `00000000-0000-4000-8000-${String(n + 500).padStart(12, '0')}`;
      sb.usuarios.push({ id, email: `${rol}@idc.mx`, created_at: '2026-11-22T00:00:00Z', last_sign_in_at: null, user_metadata: {}, password: 'Una-clave-larga-2026' });
      sb.perfiles.push({ id, nombre_completo: rol, correo: `${rol}@idc.mx`, rol, activo: true });
      const r = await app.request('/api/sesion', { method: 'POST', headers: H, body: JSON.stringify({ correo: `${rol}@idc.mx`, contrasena: 'Una-clave-larga-2026' }) });
      return (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    };
    const crear = (cookie: string) => app.request('/api/admin/portal/accesos', { method: 'POST', headers: { ...H, Cookie: cookie, 'x-requested-with': 'kairovolt' }, body: JSON.stringify({ folio: FOLIO_DEMO }) });
    expect((await crear(await entrarRol('consulta', 1))).status).toBe(403);
    expect((await crear(await entrarRol('proyectista', 2))).status).toBe(403);
    const r = await crear(await entrarRol('coordinacion_admin', 3));
    expect(r.status).toBe(201);
    expect(sb.auditoria.some((a) => a.accion === 'acceso_portal_creado')).toBe(true);
    expect(JSON.stringify(sb.auditoria)).not.toMatch(/codigo|[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/); // el código nunca se audita
  });

  it('valida folio y vigencia, y no crea accesos para proyectos que no existen', async () => {
    const app = crearApp(demo());
    const post = (cuerpo: object) => app.request('/api/admin/portal/accesos', { method: 'POST', headers: { ...H, Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cuerpo) });
    expect((await post({ folio: 'x' })).status).toBe(400);
    expect((await post({ folio: FOLIO_DEMO, dias: 0 })).status).toBe(400);
    expect((await post({ folio: FOLIO_DEMO, dias: 9999 })).status).toBe(400);
    expect((await post({ folio: 'KV-2026-999' })).status).toBe(404);
  });
});

describe('portal: subir archivos', () => {
  async function conSesion() {
    const app = crearApp(demo());
    const { cookie } = await entrar(app);
    return { app, cookie };
  }
  const vista = async (app: ReturnType<typeof crearApp>, cookie: string) => (await (await get(app, '/api/portal/vista', cookie)).json()) as {
    documentos: { id: string; estado: string; puedeSubir: boolean }[]; recepciones: { recibo: string; archivo: string }[]; notificaciones: { titulo: string }[]; historial: { titulo: string }[];
  };

  it('lista los documentos que se piden al cliente (solo los suyos y obligatorios)', async () => {
    const { app, cookie } = await conSesion();
    const v = await vista(app, cookie);
    const ids = v.documentos.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['recibo_cfe', 'identificacion_oficial', 'constancia_situacion_fiscal', 'carta_poder']));
    expect(ids).not.toContain('diagrama_unifilar');
    expect(ids).not.toContain('acta_constitutiva'); // condicional
    expect(v.documentos.find((d) => d.id === 'recibo_cfe')).toMatchObject({ estado: 'vencido', puedeSubir: true });
  });

  it('sube un PDF válido: confirma la recepción con acuse, y aparece en recepciones, avisos e historial', async () => {
    const { app, cookie } = await conSesion();
    const r = await subir(app, cookie, 'identificacion_oficial', PDF, 'Mi INE.pdf');
    expect(r.status).toBe(201);
    const b = (await r.json()) as { recepcion: { recibo: string; archivo: string; estado: string }; archivosGuardados: boolean };
    expect(b.recepcion).toMatchObject({ archivo: 'Mi INE.pdf', estado: 'recibido' });
    expect(b.recepcion.recibo).toMatch(/^REC-[0-9A-F]{6}$/);
    expect(b.archivosGuardados).toBe(false); // demo: honesto sobre que no se conserva
    const v = await vista(app, cookie);
    expect(v.recepciones[0]?.recibo).toBe(b.recepcion.recibo);
    expect(v.documentos.find((d) => d.id === 'identificacion_oficial')).toMatchObject({ estado: 'en_revision', puedeSubir: false });
    expect(v.notificaciones.some((n) => n.titulo.includes('Recibimos'))).toBe(true);
    expect(v.historial.some((e) => e.titulo.includes('Documento recibido'))).toBe(true);
  });

  it('no deja volver a subir un documento que ya está en revisión', async () => {
    const { app, cookie } = await conSesion();
    expect((await subir(app, cookie, 'carta_poder', PDF)).status).toBe(201);
    expect((await subir(app, cookie, 'carta_poder', PDF)).status).toBe(409);
  });

  it('rechaza documentos que no se le pidieron al cliente o que no existen', async () => {
    const { app, cookie } = await conSesion();
    expect((await subir(app, cookie, 'diagrama_unifilar', PDF)).status).toBe(404); // lo aporta IDC
    expect((await subir(app, cookie, '../../etc/passwd', PDF)).status).toBe(404);
    expect((await subir(app, cookie, 'no-existe', PDF)).status).toBe(404);
  });

  it('valida el archivo por contenido: ejecutable disfrazado, tipo que no coincide, vacío y demasiado grande', async () => {
    const { app, cookie } = await conSesion();
    expect((await subir(app, cookie, 'carta_poder', EXE, 'x.pdf')).status).toBe(422);
    expect((await subir(app, cookie, 'carta_poder', PDF, 'x.png', 'image/png')).status).toBe(422);
    expect((await subir(app, cookie, 'carta_poder', new Uint8Array([]))).status).toBe(422);
    const grande = new Uint8Array(MAX_BYTES + 10);
    grande.set(PDF);
    expect((await subir(app, cookie, 'carta_poder', grande)).status).toBe(413);
    expect((await vista(app, cookie)).recepciones).toHaveLength(0); // nada de lo rechazado queda registrado
  });

  it('exige la cabecera anti-CSRF y el campo archivo', async () => {
    const { app, cookie } = await conSesion();
    expect((await subir(app, cookie, 'carta_poder', PDF, 'x.pdf', 'application/pdf', {})).status).toBe(403);
    const sinCampo = await app.request('/api/portal/documentos/carta_poder', { method: 'POST', headers: { Cookie: cookie, ...CSRF }, body: new FormData() });
    expect(sinCampo.status).toBe(400);
  });

  it('acepta imágenes PNG', async () => {
    const { app, cookie } = await conSesion();
    expect((await subir(app, cookie, 'constancia_situacion_fiscal', PNG, 'csf.png', 'image/png')).status).toBe(201);
  });
});

describe('adaptadores de Supabase del portal (sin red: fetch simulado)', () => {
  function simulado() {
    const llamadas: { metodo: string; url: string; cuerpo: unknown; apikey: string | null; tipo: string | null }[] = [];
    const filas: Record<string, unknown>[] = [];
    const fetchFn = (async (input: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      llamadas.push({ metodo: init?.method ?? 'GET', url: String(input), cuerpo, apikey: h.get('apikey'), tipo: h.get('content-type') });
      const json = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'Content-Type': 'application/json' } });
      const u = new URL(String(input));
      if (u.pathname.startsWith('/storage/')) return json({ Key: 'ok' });
      if (u.pathname === '/rest/v1/proyectos') return json([{ id: 'p1' }]);
      if (u.pathname === '/rest/v1/portal_accesos' && init?.method === 'POST') { const fila = { id: 'acc1', permisos: cuerpo.permisos, activo: true, expira_at: cuerpo.expira_at, revocado_at: null, ultimo_uso_at: null, created_at: '2026-11-23T00:00:00Z', proyectos: { folio: 'KV-2026-004' } }; filas.push(fila); return json([fila], 201); }
      if (u.pathname === '/rest/v1/portal_accesos' && (init?.method ?? 'GET') === 'GET') return json(filas);
      return json({});
    }) as unknown as typeof fetch;
    return { fetchFn, llamadas, filas };
  }
  const permisos = { ver_progreso: true, ver_documentos_autorizados: true, subir_documentos: true };
  const t0 = Date.parse('2026-11-23T00:00:00Z');

  it('crear: guarda solo el HASH del código (nunca el código), registra el proyecto y usa la clave secreta solo en apikey', async () => {
    const s = simulado();
    const a = crearAccesosSupabase(crearClienteSupabase(supabaseCfg, s.fetchFn), () => t0);
    const { codigo, acceso } = await a.crear('KV-2026-004', { permisos, dias: 30, creadoPor: null });
    const post = s.llamadas.find((l) => l.url.includes('/portal_accesos') && l.metodo === 'POST')!;
    expect(JSON.stringify(post.cuerpo)).toContain(huellaCodigo(codigo));
    expect(JSON.stringify(post.cuerpo)).not.toContain(normalizarCodigo(codigo));
    expect(post.apikey).toBe(supabaseCfg.secretKey);
    expect(acceso).toMatchObject({ folio: 'KV-2026-004', id: 'acc1' });
    expect(Date.parse(acceso.expiraEn)).toBe(t0 + 30 * 86_400_000);
    expect(JSON.stringify(acceso)).not.toContain(codigo);
  });

  it('verificar: consulta por huella (el código no viaja), exige que el folio coincida y que siga vigente', async () => {
    const consultas: string[] = [];
    const fila = (extra: object = {}) => ({ id: 'acc1', permisos, activo: true, expira_at: new Date(t0 + 86_400_000).toISOString(), revocado_at: null, ultimo_uso_at: null, created_at: '2026-11-23T00:00:00Z', proyectos: { folio: 'KV-2026-004' }, ...extra });
    const montar = (f: object) => crearAccesosSupabase(crearClienteSupabase(supabaseCfg, (async (u: string) => { consultas.push(String(u)); return new Response(JSON.stringify([f]), { headers: { 'Content-Type': 'application/json' } }); }) as unknown as typeof fetch), () => t0);
    const codigo = 'ABCD-EFGH-JKMN-PQRS';
    expect(await montar(fila()).verificar('KV-2026-004', codigo)).toMatchObject({ id: 'acc1' });
    expect(consultas[0]).toContain(`token_hash=eq.${huellaCodigo(codigo)}`);
    expect(consultas[0]).not.toContain('ABCDEFGH');
    expect(await montar(fila()).verificar('KV-2026-005', codigo)).toBeNull();
    expect(await montar(fila({ activo: false })).verificar('KV-2026-004', codigo)).toBeNull();
    expect(await montar(fila({ revocado_at: '2026-11-22T00:00:00Z' })).verificar('KV-2026-004', codigo)).toBeNull();
    expect(await montar(fila({ expira_at: new Date(t0 - 1000).toISOString() })).verificar('KV-2026-004', codigo)).toBeNull();
  });

  it('almacén: sube al bucket privado «expedientes» con la clave secreta y sin enlaces públicos', async () => {
    const s = simulado();
    await crearAlmacenSupabase(supabaseCfg, s.fetchFn).guardar('KV-2026-004/portal/u-1/Mi INE.pdf', PDF, 'application/pdf');
    const l = s.llamadas[0]!;
    expect(l.url).toBe(`${supabaseCfg.url}/storage/v1/object/expedientes/KV-2026-004/portal/u-1/Mi%20INE.pdf`);
    expect(l.apikey).toBe(supabaseCfg.secretKey);
    expect(l.tipo).toBe('application/pdf');
    expect(l.url).not.toContain('/public/');
    const falla = crearAlmacenSupabase(supabaseCfg, (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch);
    await expect(falla.guardar('x/y.pdf', PDF, 'application/pdf')).rejects.toThrow(/500/);
  });
});
