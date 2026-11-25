import { describe, expect, it } from 'vitest';
import { crearApp } from '../app';
import type { ConfigServidor } from '../config';
import { supabaseCfg, supabaseFalso } from '../supabase/falso';
import { zoho, zohoFalso } from '../zoho/falso';

const TOKEN = 'token-de-emergencia-largo';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const demo = (): ConfigServidor => ({ port: 0, zoho: null, supabase: null, adminToken: TOKEN });
const post = (cuerpo: unknown) => ({ method: 'POST', headers: H, body: JSON.stringify(cuerpo) });
const proyecto = {
  folio: 'kv-2026-010', nombre: 'Interconexión FV 40 kW', subcarpetas: ['G0', 'G1'],
  tareas: [
    { clave: 'G0', nombre: 'G0 — Alta', inicioPlan: '2026-11-02', finPlan: '2026-11-06' },
    { clave: 'G1', nombre: 'G1 — Acopio', inicioPlan: '2026-11-09', finPlan: '2026-11-18', predecesora: 'G0' },
  ],
};
const URL_SYNC = '/api/admin/integracion/sincronizar-proyecto';

describe('rutas de integración', () => {
  it('exigen sesión', async () => {
    const app = crearApp(demo());
    expect((await app.request('/api/admin/integracion/estado')).status).toBe(401);
  });

  it('sin credenciales de Zoho el estado es DEMO — NO CONECTADO y ningún servicio figura conectado', async () => {
    const r = await crearApp(demo()).request('/api/admin/integracion/estado', { headers: H });
    expect(await r.json()).toMatchObject({ modo: 'demo', etiqueta: expect.stringContaining('NO CONECTADO'), servicios: { crm: false, projects: false, workdrive: false } });
  });

  it('con credenciales de Zoho el estado es real, con los servicios que hay configurados', async () => {
    const cfg: ConfigServidor = { ...demo(), zoho: { ...zoho, workdriveRootId: null } };
    const r = await crearApp(cfg, zohoFalso().fetchFn).request('/api/admin/integracion/estado', { headers: H });
    expect(await r.json()).toMatchObject({ modo: 'real', servicios: { crm: true, projects: true, workdrive: false } });
  });

  it('DEMO: simula por defecto y NO afirma haber escrito en Zoho', async () => {
    const r = await crearApp(demo()).request(URL_SYNC, post(proyecto));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b).toMatchObject({ folio: 'KV-2026-010', modo: 'simulado', etiqueta: expect.stringContaining('NO CONECTADO') });
    expect(JSON.stringify(b)).not.toMatch(/"accion":"creado"/);
  });

  it('DEMO: escribir de verdad (simular:false) se rechaza: no se finge una sincronización', async () => {
    const r = await crearApp(demo()).request(URL_SYNC, post({ ...proyecto, simular: false }));
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ error: 'demo_no_conectado' });
  });

  it('valida el cuerpo: folio, tareas y claves de compuerta', async () => {
    const app = crearApp(demo());
    for (const malo of [
      { ...proyecto, folio: 'X-1' },
      { ...proyecto, nombre: '' },
      { ...proyecto, tareas: 'no' },
      { ...proyecto, tareas: [{ clave: 'G9', nombre: 'x' }] },
      { ...proyecto, tareas: Array.from({ length: 51 }, () => ({ clave: 'G0', nombre: 'x' })) },
    ]) {
      expect((await app.request(URL_SYNC, post(malo))).status).toBe(400);
    }
  });

  it('un rol sin permiso no puede sincronizar (consulta → 403)', async () => {
    const sb = supabaseFalso();
    const id = '00000000-0000-4000-8000-000000000101';
    sb.usuarios.push({ id, email: 'c@idc.mx', created_at: '2026-11-22T00:00:00Z', last_sign_in_at: null, user_metadata: {}, password: 'Una-clave-larga-2026' });
    sb.perfiles.push({ id, nombre_completo: 'Consulta', correo: 'c@idc.mx', rol: 'consulta', activo: true });
    const app = crearApp({ ...demo(), supabase: supabaseCfg }, sb.fetchFn);
    const login = await app.request('/api/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'c@idc.mx', contrasena: 'Una-clave-larga-2026' }) });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const r = await app.request(URL_SYNC, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'x-requested-with': 'kairovolt' }, body: JSON.stringify(proyecto) });
    expect(r.status).toBe(403);
  });

  it('el registro lista lo ejecutado y rechaza un folio inválido', async () => {
    const app = crearApp(demo());
    await app.request(URL_SYNC, post(proyecto));
    const r = await app.request('/api/admin/integracion/registro?folio=KV-2026-010', { headers: H });
    const b = (await r.json()) as { modo: string; registros: { folio: string; accion: string | null }[] };
    expect(b.modo).toBe('demo');
    expect(b.registros.length).toBeGreaterThan(5);
    expect(b.registros.every((x) => x.folio === 'KV-2026-010')).toBe(true);
    expect((await app.request('/api/admin/integracion/registro?folio=raro', { headers: H })).status).toBe(400);
  });
});
