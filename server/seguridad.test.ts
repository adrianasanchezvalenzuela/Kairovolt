import { describe, expect, it } from 'vitest';
import { crearApp } from './app';
import { leerConfig, type ConfigServidor, type ZohoConfig } from './config';
import { CODIGO_DEMO, FOLIO_DEMO } from './portal/memoria';

const base: ConfigServidor = { port: 0, zoho: null, adminToken: 'token-largo-para-pruebas' };
const json = { 'Content-Type': 'application/json' };

describe('seguridad HTTP', () => {
  it('usa Secure en producción/HTTPS y mantiene cookies funcionales en desarrollo HTTP', async () => {
    expect(leerConfig({}).secureCookies).toBe(false);
    expect(leerConfig({ NODE_ENV: 'production' }).secureCookies).toBe(true);
    expect(leerConfig({ APP_URL: 'https://kairovolt.example' }).secureCookies).toBe(true);

    const local = crearApp(base);
    const prod = crearApp({ ...base, secureCookies: true });
    const [respuestaLocal, respuestaProd] = await Promise.all([
      local.request('/api/sesion', { method: 'POST', headers: json, body: JSON.stringify({ token: base.adminToken }) }),
      prod.request('/api/sesion', { method: 'POST', headers: json, body: JSON.stringify({ token: base.adminToken }) }),
    ]);
    const cookieLocal = respuestaLocal.headers.get('set-cookie') ?? '';
    const cookieProd = respuestaProd.headers.get('set-cookie') ?? '';
    expect(cookieLocal).toMatch(/HttpOnly/i);
    expect(cookieLocal).toMatch(/SameSite=Strict/i);
    expect(cookieLocal).not.toMatch(/; Secure/i);
    expect(cookieProd).toMatch(/HttpOnly/i);
    expect(cookieProd).toMatch(/SameSite=Strict/i);
    expect(cookieProd).toMatch(/; Secure/i);
  });

  it('protege cookies y cabeceras también en el portal, sin romper el acceso local', async () => {
    const acceder = (app: ReturnType<typeof crearApp>) => app.request('/api/portal/acceso', {
      method: 'POST', headers: { ...json, 'X-Requested-With': 'kairovolt' }, body: JSON.stringify({ folio: FOLIO_DEMO, codigo: CODIGO_DEMO }),
    });
    const local = await acceder(crearApp(base));
    expect(local.status).toBe(200);
    expect(local.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(local.headers.get('set-cookie')).toMatch(/SameSite=Strict/i);
    expect(local.headers.get('set-cookie')).not.toMatch(/; Secure/i);
    expect(local.headers.get('x-content-type-options')).toBe('nosniff');
    expect(local.headers.get('x-frame-options')).toBe('DENY');
    expect(local.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(local.headers.get('content-security-policy')).toContain('https://fonts.googleapis.com');
    expect(local.headers.get('strict-transport-security')).toBeNull();

    const prod = await acceder(crearApp({ ...base, secureCookies: true }));
    expect(prod.headers.get('set-cookie')).toMatch(/; Secure/i);
    expect(prod.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });

  it('el endpoint público de estado de Zoho devuelve un error genérico sin filtrar OAuth', async () => {
    const zoho: ZohoConfig = {
      clientId: 'id-prueba', clientSecret: 'secreto-prueba-no-devolver', refreshToken: 'refresh-prueba-no-devolver',
      accountsUrl: 'https://accounts.zoho.com', projectsUrl: 'https://projectsapi.zoho.com', portalId: null,
    };
    const app = crearApp({ ...base, zoho, adminToken: null }, (async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 400 })) as typeof fetch);
    const r = await app.request('/api/integracion/estado');
    const body = await r.text();
    expect(r.status).toBe(200);
    expect(body).toContain('Zoho no está disponible en este momento.');
    expect(body).not.toMatch(/invalid_client|secreto-prueba|refresh-prueba/);
  });

  it('el backend sigue exigiendo CSRF en escrituras del panel con cookie/token de sesión', async () => {
    const app = crearApp(base);
    const login = await app.request('/api/sesion', { method: 'POST', headers: json, body: JSON.stringify({ token: base.adminToken }) });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const sinCsrf = await app.request('/api/admin/usuarios', { method: 'POST', headers: { ...json, Cookie: cookie }, body: '{}' });
    expect(sinCsrf.status).toBe(403);
    const conCsrf = await app.request('/api/admin/usuarios', { method: 'POST', headers: { ...json, Cookie: cookie, 'X-Requested-With': 'kairovolt' }, body: '{}' });
    expect(conCsrf.status).toBe(503); // llega a la ruta protegida, pero Supabase no está configurado
  });

  it('el catálogo de producción no recurre al mock cuando falta Supabase', async () => {
    const zoho: ZohoConfig = {
      clientId: 'id-prueba', clientSecret: 'secreto-prueba-no-devolver', refreshToken: 'refresh-prueba-no-devolver',
      accountsUrl: 'https://accounts.zoho.com', projectsUrl: 'https://projectsapi.zoho.com', portalId: null,
    };
    const app = crearApp({ ...base, zoho });
    const r = await app.request('/api/admin/catalogo', { headers: { Authorization: `Bearer ${base.adminToken}` } });
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ error: 'supabase_no_configurado' });
  });

  it('el mock del catálogo se ofrece solo en modo demostración explícito/aislado', async () => {
    const app = crearApp(base);
    const r = await app.request('/api/admin/catalogo', { headers: { Authorization: `Bearer ${base.adminToken}` } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ demo: true, requisitos: expect.any(Array) });
  });

  it('bloquea una liberación real si Supabase no permite validar el catálogo', async () => {
    const zoho: ZohoConfig = {
      clientId: 'id-prueba', clientSecret: 'secreto-prueba-no-devolver', refreshToken: 'refresh-prueba-no-devolver',
      accountsUrl: 'https://accounts.zoho.com', projectsUrl: 'https://projectsapi.zoho.com', portalId: null,
    };
    const app = crearApp({ ...base, zoho });
    const r = await app.request('/api/admin/sync/compuerta', {
      method: 'POST', headers: { ...json, Authorization: `Bearer ${base.adminToken}` },
      body: JSON.stringify({ folio: 'KV-2026-004', compuerta: 'G0', estado: 'liberada' }),
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ error: 'catalogo_no_disponible' });
  });
});
