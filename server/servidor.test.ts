import { describe, expect, it, vi } from 'vitest';
import { crearApp } from './app';
import { leerConfig, type ConfigServidor } from './config';
import { crearZohoAuth, ZohoError } from './zoho/auth';

const zoho = { clientId: 'ID-SECRETO', clientSecret: 'SECRETO-123', refreshToken: 'REFRESH-XYZ', accountsUrl: 'https://accounts.zoho.com', projectsUrl: 'https://projectsapi.zoho.com', portalId: '123' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tokenOk = { access_token: 'AT-1', api_domain: 'https://www.zohoapis.com', expires_in: 3600 };

describe('leerConfig', () => {
  it('sin credenciales completas, zoho es null', () => {
    expect(leerConfig({ ZOHO_CLIENT_ID: 'a' }).zoho).toBeNull();
    expect(leerConfig({}).adminToken).toBeNull();
  });
  it('con credenciales, normaliza la URL de cuentas', () => {
    const c = leerConfig({ ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c', ZOHO_ACCOUNTS_URL: 'https://accounts.zoho.eu/' });
    expect(c.zoho?.accountsUrl).toBe('https://accounts.zoho.eu');
  });
  it('proyectos: URL y portal por defecto / rechazo de dominios ajenos', () => {
    const env = { ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c' };
    expect(leerConfig(env).zoho).toMatchObject({ projectsUrl: 'https://projectsapi.zoho.com', portalId: null });
    expect(leerConfig({ ...env, ZOHO_PROJECTS_PORTAL_ID: '99' }).zoho?.portalId).toBe('99');
    expect(() => leerConfig({ ...env, ZOHO_PROJECTS_URL: 'https://evil.example.com' })).toThrow();
  });
  it('rechaza dominios de cuentas que no son de Zoho', () => {
    expect(() => leerConfig({ ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c', ZOHO_ACCOUNTS_URL: 'https://evil.example.com' })).toThrow();
  });
});

describe('crearZohoAuth', () => {
  it('renueva el token por POST con el cuerpo en formulario (no en la URL) y lo cachea', async () => {
    const fetchFn = vi.fn(async () => json(tokenOk));
    const obtener = crearZohoAuth(zoho, fetchFn as unknown as typeof fetch, () => 0);
    expect((await obtener()).token).toBe('AT-1');
    await obtener();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://accounts.zoho.com/oauth/v2/token');
    expect(url).not.toMatch(/SECRETO|REFRESH/);
    expect(String(init.body)).toContain('grant_type=refresh_token');
  });

  it('renueva cuando el token expira', async () => {
    let t = 0;
    const fetchFn = vi.fn(async () => json(tokenOk));
    const obtener = crearZohoAuth(zoho, fetchFn as unknown as typeof fetch, () => t);
    await obtener();
    t = 3600 * 1000;
    await obtener();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('un error de Zoho no filtra credenciales', async () => {
    const obtener = crearZohoAuth(zoho, (async () => json({ error: 'invalid_code' })) as unknown as typeof fetch);
    const err = await obtener().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ZohoError);
    expect((err as Error).message).toBe('Zoho rechazó la renovación del token: invalid_code');
    expect(JSON.stringify(err, Object.getOwnPropertyNames(err))).not.toMatch(/SECRETO|REFRESH|ID-SECRETO/);
  });

  it('rechaza un api_domain que no es de Zoho', async () => {
    const obtener = crearZohoAuth(zoho, (async () => json({ ...tokenOk, api_domain: 'https://evil.example.com' })) as unknown as typeof fetch);
    await expect(obtener()).rejects.toThrow(/dominio de API/);
  });

  it('falla de red se reporta sin detalles internos', async () => {
    const obtener = crearZohoAuth(zoho, (async () => { throw new Error('ECONNREFUSED con SECRETO-123'); }) as unknown as typeof fetch);
    await expect(obtener()).rejects.toThrow('No se pudo contactar a Zoho');
  });
});

describe('API', () => {
  const base: ConfigServidor = { port: 0, zoho: null, adminToken: null };

  it('estado: no_configurado sin credenciales (nunca finge conexión)', async () => {
    const res = await crearApp(base).request('/api/integracion/estado');
    expect(await res.json()).toMatchObject({ zoho: 'no_configurado', detalle: expect.stringContaining('No conectado') });
  });

  it('estado: conectado solo si Zoho entrega token', async () => {
    const ok = crearApp({ ...base, zoho }, (async () => json(tokenOk)) as unknown as typeof fetch);
    expect(await (await ok.request('/api/integracion/estado')).json()).toMatchObject({ zoho: 'conectado' });
    const mal = crearApp({ ...base, zoho }, (async () => json({ error: 'invalid_client' }, 400)) as unknown as typeof fetch);
    expect(await (await mal.request('/api/integracion/estado')).json()).toMatchObject({ zoho: 'error' });
  });

  it('admin: deshabilitado sin ADMIN_TOKEN, protegido con él', async () => {
    expect((await crearApp(base).request('/api/admin/zoho/modulos')).status).toBe(404);
    const fetchFn = (async (url: string) =>
      String(url).includes('/oauth/') ? json(tokenOk) : json({ modules: [{ api_name: 'Deals', plural_label: 'Negocios' }] })) as unknown as typeof fetch;
    const app = crearApp({ ...base, zoho, adminToken: 'admin-token-largo' }, fetchFn);
    expect((await app.request('/api/admin/zoho/modulos')).status).toBe(401);
    expect((await app.request('/api/admin/zoho/modulos', { headers: { Authorization: 'Bearer incorrecto' } })).status).toBe(401);
    const ok = await app.request('/api/admin/zoho/modulos', { headers: { Authorization: 'Bearer admin-token-largo' } });
    expect(await ok.json()).toEqual({ modulos: [{ apiName: 'Deals', etiqueta: 'Negocios' }] });
  });

  it('admin: 503 si hay admin token pero no hay Zoho configurado', async () => {
    const app = crearApp({ ...base, adminToken: 't' });
    expect((await app.request('/api/admin/zoho/modulos', { headers: { Authorization: 'Bearer t' } })).status).toBe(503);
  });

  it('el estado es público y no exige token; los datos sí', async () => {
    const app = crearApp({ ...base, zoho, adminToken: 't' }, (async () => json(tokenOk)) as unknown as typeof fetch);
    expect((await app.request('/api/integracion/estado')).status).toBe(200);
    expect((await app.request('/api/admin/zoho/proyectos')).status).toBe(401);
    expect((await app.request('/api/admin/sync/compuerta', { method: 'POST', body: '{}' })).status).toBe(401);
  });
});
