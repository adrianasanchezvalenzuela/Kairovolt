import { describe, expect, it } from 'vitest';
import { CABECERA_CSRF, VALOR_CSRF, crearApp } from './app';
import type { ConfigServidor } from './config';
import { supabaseCfg, supabaseFalso } from './supabase/falso';
import { zoho, zohoFalso } from './zoho/falso';

const TOKEN = 'token-de-emergencia-largo';
const json = { 'Content-Type': 'application/json' };

function mundo() {
  const sb = supabaseFalso();
  const zh = zohoFalso();
  const fetchFn = (async (input: string, init?: RequestInit) =>
    new URL(String(input)).host.endsWith('supabase.co') ? sb.fetchFn(input, init) : zh.fetchFn(input, init)) as unknown as typeof fetch;
  return { sb, fetchFn };
}
const cfg = (extra: Partial<ConfigServidor> = {}): ConfigServidor => ({ port: 0, zoho, supabase: supabaseCfg, adminToken: TOKEN, ...extra });

function sembrar(sb: ReturnType<typeof supabaseFalso>, correo: string, contrasena: string, rol: string) {
  const id = `00000000-0000-4000-8000-${String(sb.usuarios.length + 100).padStart(12, '0')}`;
  sb.usuarios.push({ id, email: correo, created_at: '2026-11-22T00:00:00Z', last_sign_in_at: null, user_metadata: {}, password: contrasena });
  sb.perfiles.push({ id, nombre_completo: 'Persona de Prueba', correo, rol, activo: true });
  return id;
}
async function entrar(app: ReturnType<typeof crearApp>, correo: string, contrasena: string) {
  const r = await app.request('/api/sesion', { method: 'POST', headers: json, body: JSON.stringify({ correo, contrasena }) });
  return { r, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '' };
}
const escribir = (cookie: string, cuerpo: unknown) => ({ method: 'POST', headers: { Cookie: cookie, ...json, [CABECERA_CSRF]: VALOR_CSRF }, body: JSON.stringify(cuerpo) });
const post = (app: ReturnType<typeof crearApp>, ruta: string, cuerpo: unknown) => app.request(ruta, { method: 'POST', headers: json, body: JSON.stringify(cuerpo) });

describe('recuperar contraseña', () => {
  it('pide el correo a Supabase con la clave publicable y un redirect a /restablecer; responde igual exista o no la cuenta', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg({ appUrl: 'https://kairovolt.example.com' }), m.fetchFn);
    const existe = await post(app, '/api/recuperar', { correo: ' Ana@IDC.mx ' });
    const noExiste = await post(app, '/api/recuperar', { correo: 'nadie@idc.mx' });
    expect(existe.status).toBe(202);
    expect(noExiste.status).toBe(202);
    expect(await existe.json()).toEqual(await noExiste.json());
    expect(m.sb.recuperaciones[0]).toEqual({ email: 'ana@idc.mx', redirectTo: 'https://kairovolt.example.com/restablecer' });
    expect(m.sb.llamadas.find((l) => l.ruta.startsWith('/auth/v1/recover'))!.apikey).toBe(supabaseCfg.publishableKey);
  });

  it('sin APP_URL toma el origen desde el que se navega', async () => {
    const m = mundo();
    const app = crearApp(cfg(), m.fetchFn);
    await app.request('http://localhost:5176/api/recuperar', { method: 'POST', headers: json, body: JSON.stringify({ correo: 'ana@idc.mx' }) });
    expect(m.sb.recuperaciones[0]?.redirectTo).toBe('http://localhost:5176/restablecer');
  });

  it('limita los envíos por correo (3 cada 10 min) y valida el formato', async () => {
    const m = mundo();
    const app = crearApp(cfg(), m.fetchFn);
    for (let i = 0; i < 3; i++) expect((await post(app, '/api/recuperar', { correo: 'ana@idc.mx' })).status).toBe(202);
    expect((await post(app, '/api/recuperar', { correo: 'ana@idc.mx' })).status).toBe(429);
    expect((await post(app, '/api/recuperar', { correo: 'otra@idc.mx' })).status).toBe(202);
    expect(m.sb.recuperaciones).toHaveLength(4);
    expect((await post(app, '/api/recuperar', { correo: 'no-es-correo' })).status).toBe(400);
  });

  it('deshabilitado si no hay login por correo; si Supabase falla, 503', async () => {
    const sinKey = crearApp(cfg({ supabase: { ...supabaseCfg, publishableKey: null } }), mundo().fetchFn);
    expect((await post(sinKey, '/api/recuperar', { correo: 'ana@idc.mx' })).status).toBe(404);
    const caido = crearApp(cfg(), (async () => { throw new Error('red'); }) as unknown as typeof fetch);
    expect((await post(caido, '/api/recuperar', { correo: 'ana@idc.mx' })).status).toBe(503);
  });
});

describe('restablecer con el enlace del correo', () => {
  it('con el token del enlace fija la contraseña nueva y después se entra con ella', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'proyectista');
    const app = crearApp(cfg(), m.fetchFn);
    const token = m.sb.emitirTokenRecuperacion('ana@idc.mx');
    const r = await post(app, '/api/restablecer', { token, contrasena: 'Clave-nueva-2027-xyz' });
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain(token);
    expect((await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026')).r.status).toBe(401);
    expect((await entrar(app, 'ana@idc.mx', 'Clave-nueva-2027-xyz')).r.status).toBe(200);
    const l = m.sb.llamadas.find((x) => x.ruta === '/auth/v1/user')!;
    expect(l.authorization).toBe(`Bearer ${token}`);
    expect(l.apikey).toBe(supabaseCfg.publishableKey);
  });

  it('el token es de un solo uso; uno falso o con mala forma da "enlace inválido"', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const token = m.sb.emitirTokenRecuperacion('ana@idc.mx');
    expect((await post(app, '/api/restablecer', { token, contrasena: 'Clave-nueva-2027-xyz' })).status).toBe(200);
    const reuso = await post(app, '/api/restablecer', { token, contrasena: 'Otra-clave-nueva-2028' });
    expect(reuso.status).toBe(400);
    expect(await reuso.json()).toMatchObject({ error: 'enlace_invalido' });
    expect((await post(app, '/api/restablecer', { token: 'aaa.bbb.ccc', contrasena: 'Clave-nueva-2027-xyz' })).status).toBe(400);
    expect((await post(app, '/api/restablecer', { token: 'no es un token', contrasena: 'Clave-nueva-2027-xyz' })).status).toBe(400);
  });

  it('exige contraseña fuerte antes de llamar a Supabase y rechaza repetir la anterior', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const token = m.sb.emitirTokenRecuperacion('ana@idc.mx');
    const antes = m.sb.llamadas.length;
    expect((await post(app, '/api/restablecer', { token, contrasena: 'corta1' })).status).toBe(422);
    expect(m.sb.llamadas.length).toBe(antes);
    const igual = await post(app, '/api/restablecer', { token, contrasena: 'Una-clave-larga-2026' });
    expect(igual.status).toBe(422);
    expect(await igual.json()).toMatchObject({ error: 'misma_contrasena' });
  });

  it('muchos tokens falsos seguidos activan el límite', async () => {
    const app = crearApp(cfg(), mundo().fetchFn);
    for (let i = 0; i < 5; i++) expect((await post(app, '/api/restablecer', { token: 'aaa.bbb.ccc', contrasena: 'Clave-nueva-2027-xyz' })).status).toBe(400);
    expect((await post(app, '/api/restablecer', { token: 'aaa.bbb.ccc', contrasena: 'Clave-nueva-2027-xyz' })).status).toBe(429);
  });
});

describe('cambiar mi contraseña (con sesión)', () => {
  it('exige la actual, aplica la nueva y deja constancia sin guardar contraseñas', async () => {
    const m = mundo();
    const id = sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'proyectista');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    const r = await app.request('/api/cuenta/contrasena', escribir(cookie, { actual: 'Una-clave-larga-2026', nueva: 'Clave-nueva-2027-xyz' }));
    expect(r.status).toBe(200);
    expect((await entrar(app, 'ana@idc.mx', 'Clave-nueva-2027-xyz')).r.status).toBe(200);
    expect(m.sb.auditoria.find((e) => e.accion === 'contrasena_cambiada')).toMatchObject({ actor_user_id: id, entidad: 'usuario' });
    expect(JSON.stringify(m.sb.auditoria)).not.toMatch(/Clave-nueva|Una-clave/);
  });

  it('actual incorrecta, nueva débil o igual a la actual: 422 y no cambia nada', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    const cambiar = (b: unknown) => app.request('/api/cuenta/contrasena', escribir(cookie, b));
    const mala = await cambiar({ actual: 'no-es-la-actual-1', nueva: 'Clave-nueva-2027-xyz' });
    expect(mala.status).toBe(422);
    expect(await mala.json()).toMatchObject({ error: 'contrasena_actual_incorrecta' });
    expect((await cambiar({ actual: 'Una-clave-larga-2026', nueva: 'corta1' })).status).toBe(422);
    expect((await cambiar({ actual: 'Una-clave-larga-2026', nueva: 'Una-clave-larga-2026' })).status).toBe(422);
    expect((await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026')).r.status).toBe(200);
  });

  it('exige sesión y cabecera anti-CSRF; la sesión de emergencia no tiene contraseña que cambiar', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const cuerpo = JSON.stringify({ actual: 'Una-clave-larga-2026', nueva: 'Clave-nueva-2027-xyz' });
    expect((await app.request('/api/cuenta/contrasena', { method: 'POST', headers: json, body: cuerpo })).status).toBe(401);
    const { cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    expect((await app.request('/api/cuenta/contrasena', { method: 'POST', headers: { Cookie: cookie, ...json }, body: cuerpo })).status).toBe(403);
    const t = await app.request('/api/cuenta/contrasena', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, ...json }, body: cuerpo });
    expect(t.status).toBe(400);
    expect(await t.json()).toMatchObject({ error: 'sin_cuenta' });
  });

  it('con una cookie robada no se adivina la contraseña actual a fuerza bruta (límite por cuenta)', async () => {
    const m = mundo();
    sembrar(m.sb, 'ana@idc.mx', 'Una-clave-larga-2026', 'consulta');
    const app = crearApp(cfg(), m.fetchFn);
    const { cookie } = await entrar(app, 'ana@idc.mx', 'Una-clave-larga-2026');
    for (let i = 0; i < 5; i++) expect((await app.request('/api/cuenta/contrasena', escribir(cookie, { actual: `intento-${i}-abc`, nueva: 'Clave-nueva-2027-xyz' }))).status).toBe(422);
    expect((await app.request('/api/cuenta/contrasena', escribir(cookie, { actual: 'Una-clave-larga-2026', nueva: 'Clave-nueva-2027-xyz' }))).status).toBe(429);
  });
});
