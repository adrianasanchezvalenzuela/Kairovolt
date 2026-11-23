import { describe, expect, it } from 'vitest';
import { CABECERA_CSRF, VALOR_CSRF, crearApp } from './app';
import type { ConfigServidor } from './config';
import { supabaseCfg, supabaseFalso } from './supabase/falso';
import { zoho, zohoFalso } from './zoho/falso';

const TOKEN = 'token-de-emergencia-largo';
const json = { 'Content-Type': 'application/json' };

/** Un solo `fetch` que responde como Supabase o como Zoho según el host. */
function mundo(opc: Parameters<typeof supabaseFalso>[0] = {}, zohoExtra: Record<string, unknown> = {}) {
  const sb = supabaseFalso(opc);
  const zh = zohoFalso(zohoExtra);
  const fetchFn = (async (input: string, init?: RequestInit) =>
    new URL(String(input)).host.endsWith('supabase.co') ? sb.fetchFn(input, init) : zh.fetchFn(input, init)) as unknown as typeof fetch;
  return { sb, zh, fetchFn };
}

const cfg = (extra: Partial<ConfigServidor> = {}): ConfigServidor => ({ port: 0, zoho, supabase: supabaseCfg, adminToken: TOKEN, ...extra });

/** Crea un usuario de Supabase (con perfil) directamente en el simulado. */
function sembrar(sb: ReturnType<typeof supabaseFalso>, correo: string, contrasena: string, rol: string, activo = true, nombre = 'Persona de Prueba') {
  const id = `00000000-0000-4000-8000-${String(sb.usuarios.length + 100).padStart(12, '0')}`;
  sb.usuarios.push({ id, email: correo, created_at: '2026-11-22T00:00:00Z', last_sign_in_at: null, user_metadata: {}, password: contrasena });
  sb.perfiles.push({ id, nombre_completo: nombre, correo, rol, activo });
  return id;
}

async function entrar(app: ReturnType<typeof crearApp>, correo: string, contrasena: string) {
  const r = await app.request('/api/sesion', { method: 'POST', headers: json, body: JSON.stringify({ correo, contrasena }) });
  return { r, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '' };
}
const conCookie = (cookie: string, extra: Record<string, string> = {}) => ({ headers: { Cookie: cookie, ...extra } });
const escribir = (cookie: string, cuerpo: unknown, metodo = 'POST') => ({
  method: metodo, headers: { Cookie: cookie, ...json, [CABECERA_CSRF]: VALOR_CSRF }, body: JSON.stringify(cuerpo),
});

describe('login con correo y contraseña (Supabase Auth)', () => {
  it('credenciales correctas: cookie HttpOnly con el usuario y su rol; no se devuelve ni se guarda ningún token de Supabase', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'proyectista');
    const app = crearApp(cfg(), m.fetchFn);
    const { r, cookie } = await entrar(app, ' Ana@IDC.mx ', 'Una-clave-larga-2026');
    expect(r.status).toBe(200);
    const cuerpo = await r.text();
    expect(JSON.parse(cuerpo)).toMatchObject({ autenticado: true, usuario: { correo: 'ana@idc.mx', rol: 'proyectista', via: 'supabase' } });
    expect(cuerpo).not.toMatch(/JWT-DE-PRUEBA|REFRESH|Una-clave/); // sin tokens de Supabase ni contraseña
    const sc = r.headers.get('set-cookie') ?? '';
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
    expect(sc).not.toMatch(/JWT-DE-PRUEBA|REFRESH/);
    const sesion = await (await app.request('/api/sesion', conCookie(cookie))).json();
    expect(sesion).toMatchObject({ autenticado: true, usuario: { rol: 'proyectista' }, metodos: { correo: true, token: true } });
  });

  it('usa la clave PUBLICABLE para validar la contraseña (la secreta no sale para eso)', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    await entrar(crearApp(cfg(), m.fetchFn), 'ana@idc.mx', 'Una-clave-larga-2026');
    const login = m.sb.llamadas.find((l) => l.ruta.startsWith('/auth/v1/token'))!;
    expect(login.apikey).toBe(supabaseCfg.publishableKey);
  });

  it('contraseña o correo incorrectos: mismo error genérico (no revela si el correo existe)', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const mala = await entrar(app, 'ana@idc.mx', 'otra-clave-cualquiera-1');
    const noExiste = await entrar(app, 'nadie@idc.mx', 'otra-clave-cualquiera-1');
    expect(mala.r.status).toBe(401);
    expect(noExiste.r.status).toBe(401);
    expect(await mala.r.json()).toEqual(await noExiste.r.json());
    expect((await entrar(app, 'no-es-correo', 'x')).r.status).toBe(401);
  });

  it('cuenta inactiva o sin perfil: 403 aunque la contraseña sea correcta', async () => {
    const m = mundo();
    sembrar(m.sb, 'baja@idc.mx', 'Una-clave-larga-2026', 'admin', false);
    m.sb.usuarios.push({ id: '00000000-0000-4000-8000-0000000000aa', email: 'sinperfil@idc.mx', created_at: '', last_sign_in_at: null, user_metadata: {}, password: 'Una-clave-larga-2026' });
    const app = crearApp(cfg(), m.fetchFn);
    const a = await entrar(app, 'baja@idc.mx', 'Una-clave-larga-2026');
    expect(a.r.status).toBe(403);
    expect(await a.r.json()).toEqual({ error: 'cuenta_inactiva' });
    expect(a.cookie).toBe('');
    expect((await entrar(app, 'sinperfil@idc.mx', 'Una-clave-larga-2026')).r.status).toBe(403);
  });

  it('5 fallos bloquean ESE correo (429) sin afectar a los demás', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    sembrar(m.sb, 'luis@idc.mx', 'Otra-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    for (let i = 0; i < 5; i++) expect((await entrar(app, 'ana@idc.mx', 'mal-mal-mal-1')).r.status).toBe(401);
    expect((await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026')).r.status).toBe(429);
    expect((await entrar(app, 'luis@idc.mx', 'Otra-clave-larga-2026')).r.status).toBe(200);
  });

  it('sin SUPABASE_PUBLISHABLE_KEY el login por correo queda deshabilitado', async () => {
    const m = mundo();
    const app = crearApp(cfg({ supabase: { ...supabaseCfg, publishableKey: null } }), m.fetchFn);
    expect((await entrar(app, 'ana@idc.mx', 'x')).r.status).toBe(404);
    expect(await (await app.request('/api/sesion')).json()).toMatchObject({ metodos: { correo: false, token: true } });
  });

  it('una clave publicable inválida (401 de Supabase) NO se confunde con contraseña incorrecta: 503', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg({ supabase: { ...supabaseCfg, publishableKey: 'sb_publishable_MAL_PEGADA' } }), m.fetchFn);
    const { r } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'auth_no_disponible' });
  });

  it('si Supabase no responde: 503, nunca se concede acceso', async () => {
    const caido = (async () => { throw new Error('red'); }) as unknown as typeof fetch;
    const { r } = await entrar(crearApp(cfg(), caido), 'ana@idc.mx', 'Una-clave-larga-2026');
    expect(r.status).toBe(503);
  });

  it('funciona sin ADMIN_TOKEN (solo Supabase) firmando la cookie con otra clave del servidor', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'admin');
    const app = crearApp(cfg({ adminToken: null }), m.fetchFn);
    const { r, cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    expect(r.status).toBe(200);
    expect((await app.request('/api/admin/usuarios', conCookie(cookie))).status).toBe(200);
    expect(await (await app.request('/api/sesion')).json()).toMatchObject({ metodos: { token: false, correo: true } });
  });
});

describe('el rol se consulta en vivo', () => {
  it('desactivar al usuario le quita el acceso (cuando vence la caché corta); cambiarle el rol también', async () => {
    let t = 1_000_000;
    const m = mundo();
    const id = sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'admin');
    const app = crearApp(cfg(), m.fetchFn, () => t);
    const { cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    expect((await app.request('/api/admin/usuarios', conCookie(cookie))).status).toBe(200);

    m.sb.perfiles.find((p) => p.id === id)!.rol = 'consulta';
    t += 20_000; // vence la caché de 15 s
    expect((await app.request('/api/admin/usuarios', conCookie(cookie))).status).toBe(403); // ya no es admin

    m.sb.perfiles.find((p) => p.id === id)!.activo = false;
    t += 20_000;
    expect((await app.request('/api/admin/usuarios', conCookie(cookie))).status).toBe(401); // desactivado
    expect(await (await app.request('/api/sesion', conCookie(cookie))).json()).toMatchObject({ autenticado: false });
  });

  it('una cookie de un usuario que ya no existe no sirve', async () => {
    const m = mundo();
    const id = sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'admin');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    m.sb.perfiles.splice(m.sb.perfiles.findIndex((p) => p.id === id), 1);
    const otra = crearApp(cfg(), m.fetchFn); // instancia nueva: sin caché
    expect((await otra.request('/api/admin/kv/proyectos', conCookie(cookie))).status).toBe(401);
  });
});

describe('permisos por rol en el backend', () => {
  const roles = ['admin', 'coordinacion_admin', 'proyectista', 'supervisor_campo', 'consulta'] as const;
  async function como(rol: (typeof roles)[number]) {
    const m = mundo();
    sembrar(m.sb, `${rol}@idc.mx`, 'Una-clave-larga-2026', rol);
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, `${rol}@idc.mx`, 'Una-clave-larga-2026');
    return { app, cookie, m };
  }
  const sync = { folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision', simular: true };

  it('todos leen datos de proyectos', async () => {
    for (const rol of roles) {
      const { app, cookie } = await como(rol);
      expect((await app.request('/api/admin/kv/proyectos', conCookie(cookie))).status, rol).toBe(200);
    }
  });

  it('escribir en Zoho: admin, coordinación y proyectista; supervisor y consulta reciben 403', async () => {
    const esperado = { admin: 200, coordinacion_admin: 200, proyectista: 200, supervisor_campo: 403, consulta: 403 } as const;
    for (const rol of roles) {
      const { app, cookie } = await como(rol);
      expect((await app.request('/api/admin/sync/compuerta', escribir(cookie, sync))).status, rol).toBe(esperado[rol]);
    }
  });

  it('solo admin gestiona usuarios y descubre Zoho', async () => {
    for (const rol of roles) {
      const { app, cookie } = await como(rol);
      const usuarios = (await app.request('/api/admin/usuarios', conCookie(cookie))).status;
      const modulos = (await app.request('/api/admin/zoho/modulos', conCookie(cookie))).status; // el simulado de Zoho no implementa esta ruta: basta distinguir 403
      if (rol === 'admin') {
        expect(usuarios, 'usuarios admin').toBe(200);
        expect(modulos, 'zoho admin').not.toBe(403);
      } else {
        expect(usuarios, `usuarios ${rol}`).toBe(403);
        expect(modulos, `zoho ${rol}`).toBe(403);
      }
    }
  });

  it('un 403 no revela datos y la comprobación va antes que "no configurado"', async () => {
    const m = mundo();
    sembrar(m.sb, 'c@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg({ zoho: null }), m.fetchFn); // Zoho sin configurar
    const { cookie } = await entrar(app, 'c@idc.mx', 'Una-clave-larga-2026');
    const r = await app.request('/api/admin/sync/compuerta', escribir(cookie, sync));
    expect(r.status).toBe(403); // no 503: primero el permiso
    expect(await r.json()).toMatchObject({ error: 'sin_permiso' });
  });

  it('el token de emergencia sigue siendo admin (Bearer y sesión)', async () => {
    const app = crearApp(cfg(), mundo().fetchFn);
    expect((await app.request('/api/admin/usuarios', { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
  });

  it('las escrituras por cookie siguen exigiendo la cabecera anti-CSRF', async () => {
    const { app, cookie } = await como('admin');
    const sinCsrf = await app.request('/api/admin/sync/compuerta', { method: 'POST', headers: { Cookie: cookie, ...json }, body: JSON.stringify(sync) });
    expect(sinCsrf.status).toBe(403);
    expect(await sinCsrf.json()).toEqual({ error: 'csrf' });
  });
});

describe('auditoría con el actor real', () => {
  it('alta de usuario y envío real a Zoho quedan a nombre de quien los hizo', async () => {
    const m = mundo({}, { 'PATCH /api/v3/portal/777/projects/P1/tasks/T2': {} });
    const id = sembrar(m.sb, 'admin@idc.mx', 'Una-clave-larga-2026', 'admin');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'admin@idc.mx', 'Una-clave-larga-2026');

    const alta = await app.request('/api/admin/usuarios', escribir(cookie, { correo: 'nueva@idc.mx', nombre: 'Nueva Persona', rol: 'consulta', contrasena: 'Una-clave-larga-2026' }));
    expect(alta.status).toBe(201);
    expect(m.sb.auditoria.find((e) => e.accion === 'usuario_creado')).toMatchObject({ actor_user_id: id, origen: 'app', entidad: 'usuario' });

    const real = await app.request('/api/admin/sync/compuerta', escribir(cookie, { folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision' }));
    expect(real.status).toBe(200);
    expect(await real.json()).toMatchObject({ resultado: 'sincronizado', auditado: true });
    expect(m.sb.auditoria.find((e) => e.accion === 'compuerta_sincronizada')).toMatchObject({ actor_user_id: id, folio: 'KV-2026-004', entidad: 'zoho_sync' });
    expect(JSON.stringify(m.sb.auditoria)).not.toMatch(/Una-clave-larga/); // ninguna contraseña en la bitácora
  });

  it('las simulaciones no se auditan (no escriben en Zoho)', async () => {
    const m = mundo();
    sembrar(m.sb, 'admin@idc.mx', 'Una-clave-larga-2026', 'admin');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'admin@idc.mx', 'Una-clave-larga-2026');
    await app.request('/api/admin/sync/compuerta', escribir(cookie, { folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision', simular: true }));
    expect(m.sb.auditoria).toHaveLength(0);
  });

  it('con el token de emergencia el actor queda como tal (sin usuario)', async () => {
    const m = mundo();
    const app = crearApp(cfg(), m.fetchFn);
    await app.request('/api/admin/usuarios', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, ...json }, body: JSON.stringify({ correo: 'x@idc.mx', nombre: 'Xavier', rol: 'consulta', contrasena: 'Una-clave-larga-2026' }) });
    expect(m.sb.auditoria[0]).toMatchObject({ actor_user_id: null, detalles: { actor: 'token_emergencia' } });
  });
});

describe('un administrador no puede quitarse el acceso a sí mismo', () => {
  it('desactivarse o bajarse el rol → 409; cambiar a otro sí', async () => {
    const m = mundo();
    const yo = sembrar(m.sb, 'admin@idc.mx', 'Una-clave-larga-2026', 'admin');
    const otro = sembrar(m.sb, 'otro@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'admin@idc.mx', 'Una-clave-larga-2026');
    const patch = (id: string, c: unknown) => app.request(`/api/admin/usuarios/${id}`, escribir(cookie, c, 'PATCH'));
    expect((await patch(yo, { activo: false })).status).toBe(409);
    expect((await patch(yo, { rol: 'consulta' })).status).toBe(409);
    expect((await patch(yo, { rol: 'admin' })).status).toBe(200);
    expect((await patch(otro, { activo: false })).status).toBe(200);
  });
});
