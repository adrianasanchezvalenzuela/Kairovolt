import { describe, expect, it, vi } from 'vitest';
import { crearApp } from './app';
import { demosPortal } from '../src/data/demos-portal';
import { MARCA_CARTA_DEMO } from './portal/carta-demo';
import { contenidoCorreo, enviarCorreoPortal } from './correo-portal';
import { PDFDocument } from 'pdf-lib';

const inicial = () => crearApp({ port: 0, zoho: null, supabase: null, adminToken: 'test' }, fetch, Date.now, true);
const base = '/api/demo/portal';
const csrf = { 'x-requested-with': 'kairovolt' };
async function entrar(app: ReturnType<typeof inicial>, indice: 0 | 2) {
  const { folio, codigo } = demosPortal[indice];
  const r = await app.request(base + '/acceso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folio, codigo }) });
  expect(r.status).toBe(200);
  return { Cookie: r.headers.get('set-cookie')!.split(';')[0]! };
}

describe('asistente documental', () => {
  it('guarda preparación sin generar recepción, impide marcar sin comprobar y aísla por folio', async () => {
    const app = inicial();
    const a = await entrar(app, 0);
    const b = await entrar(app, 2);
    const editar = (marcadas: number[]) => app.request(base + '/preparacion/recibo_cfe', {
      method: 'POST', headers: { ...a, ...csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ preparado: true, marcadas }),
    });
    expect((await editar([0])).status).toBe(422);
    expect((await editar([0, 1, 2, 3])).status).toBe(200);
    expect(await (await app.request(base + '/preparacion', { headers: a })).json()).toMatchObject({ progreso: [{ preparado: true }] });
    expect(await (await app.request(base + '/preparacion', { headers: b })).json()).toEqual({ progreso: [] });
    expect(await (await app.request(base + '/vista', { headers: a })).json()).toMatchObject({ recepciones: [] });
  });

  it('genera y conserva un PDF marcado, exige participantes y bloquea su uso como evidencia', async () => {
    const app = inicial();
    const a = await entrar(app, 0);
    const b = await entrar(app, 2);
    const generar = (headers: HeadersInit) => app.request(base + '/carta-poder-demo', { method: 'POST', headers });
    expect((await generar({ ...a, ...csrf })).status).toBe(422);
    const r = await generar({ ...b, ...csrf });
    expect(r.status).toBe(200);
    const datos = await r.arrayBuffer();
    expect((await PDFDocument.load(datos)).getSubject()).toBe(MARCA_CARTA_DEMO);
    const id = r.headers.get('x-documento-id');
    expect((await app.request(base + '/carta-poder-demo/' + id, { headers: a })).status).toBe(404);
    expect((await app.request(base + '/carta-poder-demo/' + id, { headers: b })).status).toBe(200);
    const f = new FormData();
    f.set('archivo', new File([datos], 'carta.pdf', { type: 'application/pdf' }));
    expect((await app.request(base + '/documentos/carta_poder', {
      method: 'POST', headers: { ...a, ...csrf }, body: f,
    })).status).toBe(422);
  });
});

describe('correo transaccional', () => {
  it('retiene la clave de idempotencia ante fallos y compone el aviso sin documento ni código de acceso', async () => {
    const entrada = { id: 'prueba', intento: 1, correo: 'contacto@example.invalid', token: null, tipo: 'prevalidado' };
    const cfg = { apiKey: 'prueba-ficticia', desde: 'portal@example.invalid', appUrl: 'https://portal.example.invalid' };
    const send = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429 })).mockResolvedValueOnce(new Response(null, { status: 201 }));
    expect(await enviarCorreoPortal(entrada, cfg, send)).toBe('temporal');
    expect(await enviarCorreoPortal({ ...entrada, intento: 2 }, cfg, send)).toBe('aceptado');
    for (const [, opciones] of send.mock.calls) expect(opciones.headers['Idempotency-Key']).toBe('portal/prueba');
    expect(contenidoCorreo(entrada, cfg.appUrl).html).toContain('https://portal.example.invalid/portal');
    expect(contenidoCorreo(entrada, cfg.appUrl).html).not.toMatch(/Storage|token=|contacto@example/);
  });
});
