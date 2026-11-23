import { describe, expect, it } from 'vitest';
import { crearApp, CABECERA_CSRF, VALOR_CSRF } from './app';
import type { ConfigServidor } from './config';
import { crearLimitadores, crearSesiones } from './sesiones';
import { aProyectoKv } from './zoho/adaptar';
import { zoho, zohoFalso } from './zoho/falso';
import { leerProyectos } from './zoho/lectura';
import { leerObservaciones } from './zoho/observaciones';

const cfg: ConfigServidor = { port: 0, zoho, adminToken: 'token-de-prueba-largo' };
const nota = (id: string, estado: string, creada: string, desc = 'Confirmar MT/BT', extra = 'Responsable: Proyectista · Compromiso: 2026-11-25') => ({
  Created_Time: creada,
  Note_Content: `${desc}\n\nCompuerta: G2 · Origen: interna · Estado: ${estado}\n${extra}\n[KV-OBS:${id}:${estado}]`,
});

/** Inicia sesión y devuelve la cookie. */
async function entrar(app: ReturnType<typeof crearApp>, token = cfg.adminToken!) {
  const r = await app.request('/api/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  return { r, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '' };
}

describe('sesiones sin estado y límite', () => {
  it('la cookie es válida, expira y no se puede falsificar', () => {
    let t = 0;
    const s = crearSesiones('secreto', () => t);
    const c = s.crear('uid-1');
    expect(s.leer(c)).toEqual({ uid: 'uid-1' });
    expect(s.leer(s.crear(null))).toEqual({ uid: null }); // sesión del token de emergencia
    const [carga, firma] = c.split('.') as [string, string];
    const otraCarga = Buffer.from(JSON.stringify({ u: 'admin-falso', e: 9_999_999_999 })).toString('base64url');
    expect(s.leer(`${otraCarga}.${firma}`)).toBeNull(); // cambiar el usuario o la expiración rompe la firma
    expect(s.leer(`${carga}.${'0'.repeat(firma.length)}`)).toBeNull();
    expect(s.leer(carga)).toBeNull();
    expect(s.leer(undefined)).toBeNull();
    expect(crearSesiones('otro-secreto', () => t).leer(c)).toBeNull(); // otra clave
    t = 9 * 3600 * 1000;
    expect(s.leer(c)).toBeNull(); // expiró
  });
  it('funciona entre instancias distintas con el mismo secreto (serverless)', () => {
    const c = crearSesiones('mismo').crear('u');
    expect(crearSesiones('mismo').leer(c)).toEqual({ uid: 'u' });
  });
  it('el limitador bloquea por clave tras 5 fallos y se libera con el tiempo', () => {
    let t = 0;
    const l = crearLimitadores(5, 60_000, () => t);
    for (let i = 0; i < 5; i++) l.falla('ana@x.mx');
    expect(l.bloqueado('ana@x.mx')).toBe(true);
    expect(l.bloqueado('luis@x.mx')).toBe(false); // un atacante solo bloquea la cuenta que ataca
    t = 61_000;
    expect(l.bloqueado('ana@x.mx')).toBe(false);
    for (let i = 0; i < 5; i++) l.falla('b');
    l.exito('b');
    expect(l.bloqueado('b')).toBe(false);
  });
});

describe('login con ADMIN_TOKEN', () => {
  it('estado de sesión: sin ADMIN_TOKEN el login queda deshabilitado', async () => {
    const app = crearApp({ ...cfg, adminToken: null });
    expect(await (await app.request('/api/sesion')).json()).toMatchObject({ loginHabilitado: false, metodos: { token: false, correo: false }, autenticado: false });
    expect((await app.request('/api/sesion', { method: 'POST', body: '{"token":"x"}' })).status).toBe(404);
  });

  it('token correcto: cookie HttpOnly + SameSite=Strict, y el token nunca se devuelve', async () => {
    const app = crearApp(cfg, zohoFalso().fetchFn);
    const { r, cookie } = await entrar(app);
    expect(r.status).toBe(200);
    const setCookie = r.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(await r.text()).not.toContain(cfg.adminToken);
    const estado = await app.request('/api/sesion', { headers: { Cookie: cookie } });
    expect(await estado.json()).toMatchObject({ loginHabilitado: true, metodos: { token: true }, autenticado: true, usuario: { rol: 'admin', via: 'token' } });
  });

  it('token incorrecto: 401, y tras 5 intentos se bloquea (429) incluso con el correcto', async () => {
    const app = crearApp(cfg);
    for (let i = 0; i < 5; i++) expect((await entrar(app, 'mal')).r.status).toBe(401);
    expect((await entrar(app)).r.status).toBe(429);
  });

  it('cerrar sesión borra la cookie del navegador', async () => {
    const app = crearApp(cfg, zohoFalso().fetchFn);
    const { cookie } = await entrar(app);
    const r = await app.request('/api/sesion', { method: 'DELETE', headers: { Cookie: cookie } });
    expect(r.headers.get('set-cookie') ?? '').toMatch(/kv_sesion=;|Max-Age=0/i);
  });

  it('cambiar el ADMIN_TOKEN invalida las sesiones existentes', async () => {
    const { cookie } = await entrar(crearApp(cfg, zohoFalso().fetchFn));
    const rotado = crearApp({ ...cfg, adminToken: 'otro-token-distinto-largo' }, zohoFalso().fetchFn);
    expect((await rotado.request('/api/admin/kv/proyectos', { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it('una sesión creada por otra instancia con el mismo token sigue valiendo', async () => {
    const { cookie } = await entrar(crearApp(cfg, zohoFalso().fetchFn));
    const otra = crearApp(cfg, zohoFalso().fetchFn);
    expect((await otra.request('/api/admin/kv/proyectos', { headers: { Cookie: cookie } })).status).toBe(200);
  });

  it('la cookie da acceso a lectura; las escrituras exigen la cabecera anti-CSRF', async () => {
    const app = crearApp(cfg, zohoFalso().fetchFn);
    const { cookie } = await entrar(app);
    expect((await app.request('/api/admin/kv/proyectos', { headers: { Cookie: cookie } })).status).toBe(200);
    const cuerpo = JSON.stringify({ folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision', simular: true });
    const sin = await app.request('/api/admin/sync/compuerta', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: cuerpo });
    expect(sin.status).toBe(403);
    const con = await app.request('/api/admin/sync/compuerta', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', [CABECERA_CSRF]: VALOR_CSRF }, body: cuerpo });
    expect((await con.json())).toMatchObject({ resultado: 'simulado' });
  });
});

describe('observaciones leídas de Zoho', () => {
  it('reconstruye la observación; el estado más reciente manda y se conserva la fecha de registro original', async () => {
    const { cli } = zohoFalso({
      'GET /crm/v6/Deals/D1/Notes': { data: [
        nota('o1', 'cerrada', '2026-11-24T18:00:00-07:00'),
        nota('o1', 'abierta', '2026-11-20T09:00:00-07:00'),
        nota('o2', 'abierta', '2026-11-21T09:00:00-07:00', 'Pedir recibo', 'Responsable: sin asignar · Compromiso: sin fecha'),
        { Created_Time: '2026-11-22T09:00:00-07:00', Note_Content: 'Nota cualquiera de un humano' },
      ] },
    });
    const obs = await leerObservaciones(cli, 'D1');
    expect(obs.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(obs[0]).toMatchObject({ estado: 'cerrada', fechaRegistro: '2026-11-20', compuerta: 'G2', origen: 'interna', responsable: 'Proyectista', fechaCompromiso: '2026-11-25' });
    expect(obs[1]).toMatchObject({ estado: 'abierta', responsable: null, fechaCompromiso: null, descripcion: 'Pedir recibo' });
  });

  it('descripciones con saltos de línea se conservan', async () => {
    const { cli } = zohoFalso({ 'GET /crm/v6/Deals/D1/Notes': { data: [nota('o1', 'abierta', '2026-11-20T09:00:00-07:00', 'Línea 1\n\nLínea 2')] } });
    expect((await leerObservaciones(cli, 'D1'))[0]?.descripcion).toBe('Línea 1\n\nLínea 2');
  });
});

describe('adaptador a Proyecto del dominio', () => {
  it('no inventa lo que Zoho no tiene', async () => {
    const { cli } = zohoFalso();
    const [pz] = (await leerProyectos(cli)).proyectos;
    const p = aProyectoKv(pz!, []);
    expect(p).toMatchObject({
      id: 'KV-2026-004', folio: 'KV-2026-004', cliente: 'Acme', municipio: 'Hermosillo', estado: 'Sonora',
      sistema: null, documentos: [], documentosDisponibles: false, acciones: [], esMock: false,
    });
    expect(p.compuertas.map((c) => [c.id, c.estado])).toEqual([['G0', 'liberada'], ['G1', 'en_revision'], ['G2', 'pendiente'], ['G3', 'pendiente']]);
    // cronograma: solo tareas con inicio y fin; finReal solo si está liberada
    expect(p.cronograma.map((a) => a.compuerta)).toEqual(['G0', 'G1', 'G2']);
    expect(p.cronograma[0]).toMatchObject({ finPlan: '2026-11-06', finReal: '2026-11-05' });
  });

  it('GET /api/admin/kv/proyectos entrega proyectos con sus observaciones', async () => {
    const { fetchFn } = zohoFalso({ 'GET /crm/v6/Deals/D1/Notes': { data: [nota('o1', 'abierta', '2026-11-20T09:00:00-07:00')] } });
    const app = crearApp(cfg, fetchFn);
    const res = await app.request('/api/admin/kv/proyectos?folio=KV-2026-004', { headers: { Authorization: `Bearer ${cfg.adminToken}` } });
    const { proyectos } = (await res.json()) as { proyectos: { observaciones: { id: string }[] }[] };
    expect(proyectos).toHaveLength(1);
    expect(proyectos[0]?.observaciones.map((o) => o.id)).toEqual(['o1']);
  });
});

describe('validación de observaciones', () => {
  it('rechaza origen/estado fuera de catálogo y ids con caracteres raros', async () => {
    const app = crearApp(cfg, zohoFalso().fetchFn);
    const post = (c: Record<string, unknown>) => app.request('/api/admin/sync/observacion', {
      method: 'POST', headers: { Authorization: `Bearer ${cfg.adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio: 'KV-2026-004', observacionId: 'o9', compuerta: 'G2', origen: 'interna', estado: 'abierta', descripcion: 'x', simular: true, ...c }),
    });
    expect((await post({})).status).toBe(200);
    expect((await post({ origen: 'otro' })).status).toBe(400);
    expect((await post({ estado: 'hackeado' })).status).toBe(400);
    expect((await post({ observacionId: 'a:b]' })).status).toBe(400);
  });
});
