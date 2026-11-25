import { describe, expect, it } from 'vitest';
import { crearApp } from '../app';
import type { ConfigServidor } from '../config';
import { crearZohoAuth } from './auth';
import { crearClienteZoho } from './cliente';
import { json, zoho, zohoFalso } from './falso';
import { MAPEO_ZOHO, type MapeoZoho } from './mapeo';

/** Mapeo sin IDs de estado configurados: los tests no dependen de la configuración real de la cuenta. */
const SIN_IDS: MapeoZoho = {
  ...MAPEO_ZOHO,
  projects: { ...MAPEO_ZOHO.projects, estadosCompuerta: Object.fromEntries(Object.entries(MAPEO_ZOHO.projects.estadosCompuerta).map(([k, v]) => [k, { ...v, id: null }])) as MapeoZoho['projects']['estadosCompuerta'] },
};
import { SyncError, sincronizarCompuerta, sincronizarObservacion } from './escritura';
import { estadoCompuertaDesdeZoho, leerProyectos, listarPortales, normalizarFecha } from './lectura';

describe('lectura', () => {
  it('une trato y proyecto por folio, con cuenta, contacto y compuertas', async () => {
    const { cli } = zohoFalso();
    const { proyectos, advertencias } = await leerProyectos(cli);
    expect(proyectos).toHaveLength(1); // el trato sin folio KV se ignora
    const p = proyectos[0]!;
    expect(p).toMatchObject({
      folio: 'KV-2026-004',
      deal: { id: 'D1', etapa: 'Qualification', fechaCierre: '2026-12-31' },
      cliente: { nombre: 'Acme', ciudad: 'Hermosillo', estado: 'Sonora' },
      contacto: { nombre: 'Ana Pérez', correo: 'ana@x.mx' },
      proyecto: { id: 'P1' },
    });
    expect(p.compuertas.map((c) => [c.compuerta, c.estado])).toEqual([['G0', 'liberada'], ['G1', 'en_revision'], ['G2', 'pendiente'], ['G3', 'pendiente']]);
    expect(p.compuertas[0]).toMatchObject({ finPlan: '2026-11-06', finReal: '2026-11-05' });
    expect(p.compuertas[1]).toMatchObject({ inicioPlan: '2026-11-09', finPlan: '2026-11-18', finReal: null }); // formato MM-DD-YYYY
    expect(advertencias.join(' ')).toMatch(/Estado Raro.*sin equivalencia/); // no se oculta lo que no se entiende
  });

  it('sin portal de Projects lo advierte en vez de inventar compuertas', async () => {
    const { fetchFn } = zohoFalso();
    const sinPortal = { ...zoho, portalId: null };
    const cli = crearClienteZoho(sinPortal, crearZohoAuth(sinPortal, fetchFn), fetchFn);
    const r = await leerProyectos(cli);
    expect(r.proyectos[0]?.compuertas).toEqual([]);
    expect(r.advertencias.join(' ')).toMatch(/PORTAL_ID/);
  });

  it('filtra por folio sin distinguir mayúsculas', async () => {
    const { cli } = zohoFalso();
    expect((await leerProyectos(cli, { folio: 'kv-2026-004' })).proyectos).toHaveLength(1);
    expect((await leerProyectos(cli, { folio: 'KV-2026-999' })).proyectos).toHaveLength(0);
  });

  it('utilidades', () => {
    expect(normalizarFecha('2026-11-05T10:00:00-07:00')).toBe('2026-11-05');
    expect(normalizarFecha('11-09-2026')).toBe('2026-11-09');
    expect(normalizarFecha('basura')).toBeNull();
    expect(normalizarFecha('2026-11-23T02:49:46.403Z')).toBe('2026-11-22'); // UTC → Hermosillo
    expect(normalizarFecha('2026-10-20T19:00:00.000Z')).toBe('2026-10-20');
    expect(estadoCompuertaDesdeZoho('in progress')).toBe('en_revision');
    expect(estadoCompuertaDesdeZoho('???')).toBeNull();
  });
});

describe('listarPortales', () => {
  it('acepta la respuesta real de v3 (arreglo directo) y la forma { portals: [...] }', async () => {
    const a = zohoFalso({ 'GET /api/v3/portals': [{ id: '948263859', portal_name: 'kairovolt' }] });
    expect(await listarPortales(a.cli)).toEqual([{ id: '948263859', nombre: 'kairovolt' }]);
    const b = zohoFalso({ 'GET /api/v3/portals': { portals: [{ id: 1, name: 'x' }] } });
    expect(await listarPortales(b.cli)).toEqual([{ id: '1', nombre: 'x' }]);
  });
});

describe('sincronizarCompuerta', () => {
  it('simular no escribe y muestra la petición', async () => {
    const { cli, llamadas } = zohoFalso();
    const r = await sincronizarCompuerta(cli, { folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision', simular: true }, SIN_IDS);
    expect(r).toMatchObject({ resultado: 'simulado', peticion: { metodo: 'PATCH', cuerpo: { status: { id: 's-prog' } } } }); // id aprendido de G1
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
  });

  it('escribe el cambio de estado en la tarea correcta', async () => {
    const { cli, llamadas } = zohoFalso();
    const r = await sincronizarCompuerta(cli, { folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision' }, SIN_IDS);
    expect(r.resultado).toBe('sincronizado');
    expect(llamadas.find((l) => l.metodo === 'PATCH')).toMatchObject({ cuerpo: { status: { id: 's-prog' } } });
  });

  it('sin cambios si Zoho ya tiene ese estado', async () => {
    const { cli, llamadas } = zohoFalso();
    expect((await sincronizarCompuerta(cli, { folio: 'KV-2026-004', compuerta: 'G0', estado: 'liberada' })).resultado).toBe('sin_cambios');
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
  });

  it('pide completar el ID cuando no puede conocerlo (no adivina)', async () => {
    const { cli } = zohoFalso();
    await expect(sincronizarCompuerta(cli, { folio: 'KV-2026-004', compuerta: 'G2', estado: 'bloqueada' }, SIN_IDS)).rejects.toMatchObject({ codigo: 'estado_sin_id' });
  });

  it('el ID configurado en el mapeo tiene prioridad sobre el aprendido', async () => {
    const { cli } = zohoFalso();
    const conId: MapeoZoho = { ...SIN_IDS, projects: { ...SIN_IDS.projects, estadosCompuerta: { ...SIN_IDS.projects.estadosCompuerta, en_revision: { nombres: ['In Progress'], id: 'ID-CONFIGURADO' } } } };
    const r = await sincronizarCompuerta(cli, { folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision', simular: true }, conId);
    expect(r).toMatchObject({ peticion: { cuerpo: { status: { id: 'ID-CONFIGURADO' } } } });
  });

  it('errores claros: proyecto o tarea inexistente', async () => {
    const { cli } = zohoFalso();
    await expect(sincronizarCompuerta(cli, { folio: 'KV-2026-999', compuerta: 'G0', estado: 'liberada' })).rejects.toBeInstanceOf(SyncError);
    const { cli: sinG3 } = zohoFalso({ 'GET /api/v3/portal/777/projects/P1/tasks': { tasks: [{ id: 'T0', name: 'G0 - x', status: { id: 's1', name: 'Open' } }] } });
    await expect(sincronizarCompuerta(sinG3, { folio: 'KV-2026-004', compuerta: 'G3', estado: 'liberada' })).rejects.toMatchObject({ codigo: 'tarea_no_encontrada' });
  });
});

describe('sincronizarObservacion', () => {
  const obs = { folio: 'KV-2026-004', observacionId: 'o1', compuerta: 'G2' as const, origen: 'interna', estado: 'abierta', descripcion: 'Confirmar MT/BT', responsable: 'Proyectista' };

  it('crea una nota en el trato con marca de idempotencia', async () => {
    const { cli, llamadas } = zohoFalso();
    expect((await sincronizarObservacion(cli, obs)).resultado).toBe('sincronizado');
    const post = llamadas.find((l) => l.metodo === 'POST')!;
    const nota = (post.cuerpo as { data: Record<string, string>[] }).data[0]!;
    expect(nota.Note_Title).toContain('G2');
    expect(nota.Note_Content).toContain('[KV-OBS:o1:abierta]');
  });

  it('no duplica si la marca ya existe', async () => {
    const { cli, llamadas } = zohoFalso({ 'GET /crm/v6/Deals/D1/Notes': { data: [{ Note_Content: 'x\n[KV-OBS:o1:abierta]' }] } });
    expect((await sincronizarObservacion(cli, obs)).resultado).toBe('sin_cambios');
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('un cambio de estado de la misma observación sí genera otra nota', async () => {
    const { cli } = zohoFalso({ 'GET /crm/v6/Deals/D1/Notes': { data: [{ Note_Content: '[KV-OBS:o1:abierta]' }] } });
    expect((await sincronizarObservacion(cli, { ...obs, estado: 'cerrada' })).resultado).toBe('sincronizado');
  });

  it('falla si Zoho no confirma', async () => {
    const { cli } = zohoFalso({ 'POST /crm/v6/Deals/D1/Notes': { data: [{ status: 'error' }] } });
    await expect(sincronizarObservacion(cli, obs)).rejects.toMatchObject({ codigo: 'respuesta_inesperada' });
  });
});

describe('rutas admin', () => {
  const cfg = (adminToken: string | null): ConfigServidor => ({ port: 0, zoho, adminToken });
  const auth = { Authorization: 'Bearer tok' };

  it('lee proyectos y valida el folio', async () => {
    const app = crearApp(cfg('tok'), zohoFalso().fetchFn);
    const ok = await (await app.request('/api/admin/zoho/proyectos', { headers: auth })).json() as { proyectos: unknown[] };
    expect(ok.proyectos).toHaveLength(1);
    expect((await app.request('/api/admin/zoho/proyectos?folio=../x', { headers: auth })).status).toBe(400);
  });

  it('sync compuerta: valida datos, simula y mapea errores a HTTP', async () => {
    const app = crearApp(cfg('tok'), zohoFalso().fetchFn);
    const post = (cuerpo: unknown) => app.request('/api/admin/sync/compuerta', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    expect((await post({ folio: 'KV-2026-004', compuerta: 'G9', estado: 'liberada' })).status).toBe(400);
    const sim = await post({ folio: 'KV-2026-004', compuerta: 'G2', estado: 'en_revision', simular: true });
    expect(await sim.json()).toMatchObject({ resultado: 'simulado' });
    expect((await post({ folio: 'KV-2026-999', compuerta: 'G0', estado: 'liberada' })).status).toBe(503); // no autoriza liberación sin catálogo canónico disponible
    expect((await post({ folio: 'KV-2026-004', compuerta: 'G2', estado: 'bloqueada' })).status).toBe(422);
  });

  it('sync observación: valida datos', async () => {
    const app = crearApp(cfg('tok'), zohoFalso().fetchFn);
    const r = await app.request('/api/admin/sync/observacion', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ folio: 'KV-2026-004' }) });
    expect(r.status).toBe(400);
  });

  it('no filtra el refresh token ni secretos en errores', async () => {
    const roto = (async (u: string) => (String(u).includes('/oauth/') ? json({ error: 'invalid_client' }, 400) : json({}))) as unknown as typeof fetch;
    const app = crearApp(cfg('tok'), roto);
    const texto = await (await app.request('/api/admin/zoho/proyectos', { headers: auth })).text();
    expect(texto).not.toMatch(/REF|SEC/);
  });
});
