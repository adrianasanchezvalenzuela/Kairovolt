import { describe, expect, it } from 'vitest';
import type { TareaSincronizable } from '../../src/application/integracion/puertos';
import { crearZohoAuth } from './auth';
import { crearClienteZoho } from './cliente';
import { crearCrmAdapter } from './crm-adapter';
import { json, zoho } from './falso';
import { MAPEO_ZOHO, type MapeoZoho } from './mapeo';
import { fechaParaProjects, marcaReferencia, ZohoMapper } from './mapper';
import { crearProjectsAdapter } from './projects-adapter';
import { crearWorkDriveAdapter } from './workdrive-adapter';

type Manejador = (req: { url: URL; cuerpo: unknown; metodo: string }) => Response;
interface Llamada { metodo: string; ruta: string; query: string; cuerpo: unknown }

/** Zoho simulado por rutas: cada manejador responde a «METODO /ruta» (expresión regular). Registra todas las llamadas. */
function montar(rutas: [string, RegExp, Manejador][], cfg = zoho) {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.includes('/oauth/')) return json({ access_token: 'AT', api_domain: 'https://www.zohoapis.com', expires_in: 3600 });
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ metodo, ruta: url.pathname, query: url.search, cuerpo });
    const h = rutas.find(([m, re]) => m === metodo && re.test(url.pathname));
    return h ? h[2]({ url, cuerpo, metodo }) : json({ code: 'NOT_FOUND', message: `sin ruta ${metodo} ${url.pathname}` }, 404);
  }) as unknown as typeof fetch;
  const cli = crearClienteZoho(cfg, crearZohoAuth(cfg, fetchFn), fetchFn, { esperar: async () => undefined, aleatorio: () => 1 });
  const escrituras = () => llamadas.filter((l) => l.metodo !== 'GET');
  return { cli, llamadas, escrituras };
}
const O = { simular: false };
const SIM = { simular: true };
const tarea = (extra: Partial<TareaSincronizable> = {}): TareaSincronizable => ({ clave: 'G1', nombre: 'G1 — Acopio', inicioPlan: '2026-11-09', finPlan: '2026-11-18', responsableCorreo: null, predecesora: null, ...extra });
const proyecto = { folio: 'KV-2026-005', nombre: 'Interconexión FV', descripcion: null, tareas: [], subcarpetas: [] as string[] };
/** Copia profunda que conserva las funciones del mapeo (structuredClone no puede clonarlas). */
const copiar = <T,>(v: T): T => {
  if (Array.isArray(v)) return v.map(copiar) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copiar(x)])) as T;
  return v;
};
const conMapeo = (parche: (m: MapeoZoho) => MapeoZoho): MapeoZoho => parche(copiar(MAPEO_ZOHO));

describe('ZohoMapper', () => {
  it('fechas: mediodía local en UTC para que Zoho muestre el día correcto (Hermosillo, -7)', () => {
    expect(fechaParaProjects('2026-10-20', -7)).toBe('2026-10-20T19:00:00.000Z'); // el valor que Zoho devuelve para esa fecha
    expect(() => fechaParaProjects('20/10/2026', -7)).toThrow();
  });
  it('ids creados en las tres formas de respuesta de Projects', () => {
    expect(ZohoMapper.idCreado({ id: '1' }, 'projects')).toBe('1');
    expect(ZohoMapper.idCreado({ projects: [{ id: '2' }] }, 'projects')).toBe('2');
    expect(ZohoMapper.idCreado([{ id: 3 }], 'projects')).toBe('3');
    expect(ZohoMapper.idCreado({}, 'projects')).toBeNull();
  });
  it('la marca de referencia es estable', () => {
    expect(marcaReferencia({ sistema: 'zoho_workdrive', tipo: 'carpeta', idExterno: 'abc' })).toBe('[KV-REF:zoho_workdrive:carpeta:abc]');
  });
  it('un cuerpo de tarea nunca envía fechas que KairóVolt no definió (no borra las de Zoho)', () => {
    expect(ZohoMapper.parcheFechas(tarea({ inicioPlan: null }))).toEqual({ end_date: '2026-11-18T19:00:00.000Z' });
    expect(ZohoMapper.parcheFechas(tarea({ inicioPlan: null, finPlan: null }))).toEqual({});
  });
});

describe('ZohoCRMAdapter', () => {
  const deals = { data: [
    { id: 'D1', Deal_Name: 'KV-2026-004 - Interconexión FV 40 kW', Stage: 'Qualification', Account_Name: { id: 'A1', name: 'Acme' }, Contact_Name: { id: 'C1' }, Closing_Date: '2026-12-31' },
    { id: 'D2', Deal_Name: 'Otro trato' },
  ] };

  it('consulta clientes, contactos y oportunidades en el vocabulario de KairóVolt (folio reconocido en el nombre)', async () => {
    const m = montar([
      ['GET', /\/crm\/v6\/Accounts$/, () => json({ data: [{ id: 'A1', Account_Name: 'Acme', Phone: '662', Billing_City: 'Hermosillo', Billing_State: 'Sonora' }] })],
      ['GET', /\/crm\/v6\/Contacts$/, () => json({ data: [{ id: 'C1', Full_Name: 'Ana', Email: 'ana@x.mx', Phone: null, Account_Name: { id: 'A1' } }] })],
      ['GET', /\/crm\/v6\/Deals$/, () => json(deals)],
    ]);
    const crm = crearCrmAdapter(m.cli);
    expect(await crm.consultarClientes()).toEqual([{ id: 'A1', nombre: 'Acme', telefono: '662', ciudad: 'Hermosillo', estado: 'Sonora' }]);
    expect(await crm.consultarContactos()).toEqual([{ id: 'C1', nombre: 'Ana', correo: 'ana@x.mx', telefono: null, clienteId: 'A1' }]);
    const op = await crm.consultarOportunidades();
    expect(op[0]).toMatchObject({ id: 'D1', folio: 'KV-2026-004', etapa: 'Qualification', clienteId: 'A1', contactoId: 'C1', fechaCierre: '2026-12-31' });
    expect(op[1]?.folio).toBeNull();
  });

  it('upsertProyecto: si el trato del folio ya existe lo reutiliza y NO escribe nada (no pisa datos comerciales)', async () => {
    const m = montar([['GET', /\/crm\/v6\/Deals$/, () => json(deals)]]);
    const r = await crearCrmAdapter(m.cli).upsertProyecto({ ...proyecto, folio: 'kv-2026-004' }, O);
    expect(r).toMatchObject({ id: 'D1', accion: 'sin_cambios' });
    expect(m.escrituras()).toHaveLength(0);
  });

  it('upsertProyecto: sin trato y con la creación deshabilitada → error claro, sin escribir', async () => {
    const m = montar([['GET', /\/crm\/v6\/Deals$/, () => json({ data: [] })]]);
    await expect(crearCrmAdapter(m.cli).upsertProyecto(proyecto, O)).rejects.toMatchObject({ categoria: 'validacion', message: expect.stringContaining('etapaInicial') });
    expect(m.escrituras()).toHaveLength(0);
  });

  it('upsertProyecto: crea por identificador externo (folio) con upsert, y es seguro repetirlo tras un corte', async () => {
    const mapeo = conMapeo((x) => { x.folio.campoCrm = 'Folio_KV'; x.crm.deals.crear.etapaInicial = 'Qualification'; return x; });
    let intentos = 0;
    const m = montar([
      ['GET', /\/crm\/v6\/Deals$/, () => json({ data: [] })],
      ['POST', /\/crm\/v6\/Deals\/upsert$/, () => (++intentos === 1 ? json({}, 503) : json({ data: [{ status: 'success', action: 'insert', details: { id: 'D9' } }] }))],
    ]);
    const crm = crearCrmAdapter(m.cli, mapeo);
    const sim = await crm.upsertProyecto(proyecto, SIM);
    expect(sim.accion).toBe('simulado');
    expect(m.escrituras()).toHaveLength(0);

    const r = await crm.upsertProyecto(proyecto, O);
    expect(r).toEqual({ id: 'D9', accion: 'creado' });
    const post = m.escrituras().find((c) => c.ruta.endsWith('/upsert'))!;
    expect(post.cuerpo).toMatchObject({ duplicate_check_fields: ['Folio_KV'], data: [{ Deal_Name: 'KV-2026-005 - Interconexión FV', Stage: 'Qualification', Folio_KV: 'KV-2026-005' }] });
    expect(intentos).toBe(2); // el 503 se reintentó porque el upsert es idempotente
  });

  it('upsertProyecto sin campo propio verifica duplicados por el nombre del trato (que lleva el folio)', async () => {
    const mapeo = conMapeo((x) => { x.crm.deals.crear.etapaInicial = 'Qualification'; return x; });
    const m = montar([
      ['GET', /\/crm\/v6\/Deals$/, () => json({ data: [] })],
      ['POST', /\/upsert$/, () => json({ data: [{ status: 'success', action: 'update', details: { id: 'D5' } }] })],
    ]);
    expect(await crearCrmAdapter(m.cli, mapeo).upsertProyecto(proyecto, O)).toEqual({ id: 'D5', accion: 'actualizado' });
    expect(m.escrituras()[0]?.cuerpo).toMatchObject({ duplicate_check_fields: ['Deal_Name'] });
  });

  it('upsert que Zoho no confirma → error (no se da por hecho)', async () => {
    const mapeo = conMapeo((x) => { x.crm.deals.crear.etapaInicial = 'Qualification'; return x; });
    const m = montar([['GET', /\/Deals$/, () => json({ data: [] })], ['POST', /\/upsert$/, () => json({ data: [{ status: 'error', code: 'INVALID_DATA' }] })]]);
    await expect(crearCrmAdapter(m.cli, mapeo).upsertProyecto(proyecto, O)).rejects.toThrow(/no confirmó/);
  });

  it('sincronizarFolio: sin campo propio no escribe; con campo, solo escribe si cambió', async () => {
    const sin = montar([]);
    expect(await crearCrmAdapter(sin.cli).sincronizarFolio('D1', 'KV-2026-004', O)).toMatchObject({ accion: 'sin_cambios', detalle: expect.stringContaining('campoCrm') });
    expect(sin.llamadas).toHaveLength(0);

    const mapeo = conMapeo((x) => { x.folio.campoCrm = 'Folio_KV'; return x; });
    let actual: string | null = 'KV-2026-004';
    const m = montar([
      ['GET', /\/Deals\/D1$/, () => json({ data: [{ id: 'D1', Folio_KV: actual }] })],
      ['PUT', /\/Deals\/D1$/, ({ cuerpo }) => { actual = (cuerpo as { data: { Folio_KV: string }[] }).data[0]!.Folio_KV; return json({ data: [{ status: 'success' }] }); }],
    ]);
    const crm = crearCrmAdapter(m.cli, mapeo);
    expect((await crm.sincronizarFolio('D1', 'KV-2026-004', O)).accion).toBe('sin_cambios');
    actual = null;
    expect((await crm.sincronizarFolio('D1', 'KV-2026-004', SIM)).accion).toBe('simulado');
    expect(m.escrituras()).toHaveLength(0);
    expect((await crm.sincronizarFolio('D1', 'KV-2026-004', O)).accion).toBe('actualizado');
    expect(m.escrituras()[0]?.cuerpo).toEqual({ data: [{ Folio_KV: 'KV-2026-004' }] });
  });

  it('registrarReferencia: anota una nota con marca y no la repite', async () => {
    const ref = { folio: 'KV-2026-004', sistema: 'zoho_workdrive' as const, tipo: 'carpeta', idExterno: 'F1' };
    let notas: { Note_Content: string }[] = [];
    const m = montar([
      ['GET', /\/Deals\/D1\/Notes$/, () => json({ data: notas })],
      ['POST', /\/Deals\/D1\/Notes$/, ({ cuerpo }) => { notas.push({ Note_Content: (cuerpo as { data: { Note_Content: string }[] }).data[0]!.Note_Content }); return json({ data: [{ status: 'success' }] }); }],
    ]);
    const crm = crearCrmAdapter(m.cli);
    expect((await crm.registrarReferencia('D1', ref, SIM)).accion).toBe('simulado');
    expect(notas).toHaveLength(0);
    expect((await crm.registrarReferencia('D1', ref, O)).accion).toBe('creado');
    expect(notas[0]?.Note_Content).toContain('[KV-REF:zoho_workdrive:carpeta:F1]');
    expect((await crm.registrarReferencia('D1', ref, O)).accion).toBe('sin_cambios');
    expect(notas).toHaveLength(1);
  });
});

describe('ZohoProjectsAdapter', () => {
  const P = '/api/v3/portal/777';
  const listaProyectos = [{ id: 'P1', name: 'KV-2026-004 - Interconexión FV 40 kW' }];

  it('asegurarProyecto: reutiliza el del folio (sin distinguir mayúsculas); si no existe lo crea con el folio en el nombre', async () => {
    let creado = false;
    const m = montar([
      ['GET', new RegExp(`${P}/projects$`), () => json({ projects: listaProyectos })],
      ['POST', new RegExp(`${P}/projects$`), () => { creado = true; return json({ id: 'P2' }); }],
    ]);
    const pr = crearProjectsAdapter(m.cli);
    expect(await pr.asegurarProyecto({ ...proyecto, folio: 'kv-2026-004' }, O)).toMatchObject({ id: 'P1', accion: 'sin_cambios' });
    expect(creado).toBe(false);
    expect((await pr.asegurarProyecto(proyecto, SIM)).accion).toBe('simulado');
    expect(creado).toBe(false);
    expect(await pr.asegurarProyecto(proyecto, O)).toEqual({ id: 'P2', accion: 'creado' });
    expect(m.escrituras()[0]?.cuerpo).toEqual({ name: 'KV-2026-005 - Interconexión FV' });
  });

  it('un proyecto creado sin id en la respuesta es un error, no un éxito', async () => {
    const m = montar([['GET', new RegExp(`${P}/projects$`), () => json({ projects: [] })], ['POST', new RegExp(`${P}/projects$`), () => json({})]]);
    await expect(crearProjectsAdapter(m.cli).asegurarProyecto(proyecto, O)).rejects.toThrow(/no devolvió el id/);
  });

  it('exige el portal configurado', async () => {
    const m = montar([], { ...zoho, portalId: null });
    await expect(crearProjectsAdapter(m.cli).asegurarProyecto(proyecto, O)).rejects.toMatchObject({ categoria: 'validacion' });
  });

  it('asegurarListaTareas: la reutiliza o la crea', async () => {
    const m = montar([
      ['GET', new RegExp(`${P}/projects/P1/tasklists$`), () => json({ tasklists: [{ id: 'L1', name: 'General' }] })],
      ['POST', new RegExp(`${P}/projects/P1/tasklists$`), () => json({ id: 'L2' })],
    ]);
    const pr = crearProjectsAdapter(m.cli);
    expect(await pr.asegurarListaTareas('P1', 'general', O)).toEqual({ id: 'L1', accion: 'sin_cambios' });
    expect(await pr.asegurarListaTareas('P1', 'Compuertas', O)).toEqual({ id: 'L2', accion: 'creado' });
    expect(m.escrituras()[0]?.cuerpo).toEqual({ name: 'Compuertas' });
  });

  describe('tareas', () => {
    const tareasZoho = { tasks: [
      { id: 'T1', name: 'G1 — Acopio legal', status: { id: 's1', name: 'Open' }, start_date: '2026-11-09T19:00:00.000Z', end_date: '2026-11-18T19:00:00.000Z', owners_and_work: { owners: [{ zpuid: 'U1' }] } },
    ] };
    const rutas = (extra: [string, RegExp, Manejador][] = []): [string, RegExp, Manejador][] => [
      ['GET', new RegExp(`${P}/projects/P1/tasks$`), () => json(tareasZoho)],
      ['PATCH', new RegExp(`${P}/projects/P1/tasks/T1$`), () => json({})],
      ['POST', new RegExp(`${P}/projects/P1/tasks$`), () => json({ tasks: [{ id: 'T9' }] })],
      ...extra,
    ];

    it('si la tarea existe con las mismas fechas no hace nada', async () => {
      const m = montar(rutas());
      expect(await crearProjectsAdapter(m.cli).asegurarTarea('P1', 'L1', 'KV-2026-004', tarea(), O)).toEqual({ id: 'T1', accion: 'sin_cambios' });
      expect(m.escrituras()).toHaveLength(0);
    });

    it('si cambió una fecha, la actualiza SOLO con las fechas definidas y sin tocar el estado', async () => {
      const m = montar(rutas());
      const pr = crearProjectsAdapter(m.cli);
      expect((await pr.asegurarTarea('P1', null, 'KV-2026-004', tarea({ finPlan: '2026-12-01' }), SIM)).accion).toBe('simulado');
      expect(m.escrituras()).toHaveLength(0);
      expect(await pr.asegurarTarea('P1', null, 'KV-2026-004', tarea({ finPlan: '2026-12-01' }), O)).toEqual({ id: 'T1', accion: 'actualizado' });
      expect(m.escrituras()[0]?.cuerpo).toEqual({ start_date: '2026-11-09T19:00:00.000Z', end_date: '2026-12-01T19:00:00.000Z' });
      expect(JSON.stringify(m.escrituras()[0]?.cuerpo)).not.toMatch(/status/);
    });

    it('una fecha que KairóVolt no define no cuenta como cambio (no se borra la de Zoho)', async () => {
      const m = montar(rutas());
      expect((await crearProjectsAdapter(m.cli).asegurarTarea('P1', null, 'KV-2026-004', tarea({ inicioPlan: null, finPlan: null }), O)).accion).toBe('sin_cambios');
    });

    it('crea la tarea de una compuerta que no existe, en su lista y con fechas', async () => {
      const m = montar(rutas());
      const r = await crearProjectsAdapter(m.cli).asegurarTarea('P1', 'L1', 'KV-2026-004', tarea({ clave: 'G2', nombre: 'G2 — Validación' }), O);
      expect(r).toEqual({ id: 'T9', accion: 'creado' });
      expect(m.escrituras()[0]?.cuerpo).toEqual({ name: 'G2 — Validación', tasklist: { id: 'L1' }, start_date: '2026-11-09T19:00:00.000Z', end_date: '2026-11-18T19:00:00.000Z' });
    });

    it('asignarResponsable: busca al usuario por correo, no repite si ya es el responsable y falla claro si no existe', async () => {
      const m = montar(rutas([['GET', new RegExp(`${P}/users$`), () => json({ users: [{ zpuid: 'U1', email: 'Ana@IDC.mx' }, { zpuid: 'U2', email: 'luis@idc.mx' }] })]]));
      const pr = crearProjectsAdapter(m.cli);
      expect((await pr.asignarResponsable('P1', 'T1', 'ana@idc.mx', O)).accion).toBe('sin_cambios');
      expect(await pr.asignarResponsable('P1', 'T1', 'luis@idc.mx', O)).toEqual({ id: 'T1', accion: 'actualizado' });
      expect(m.escrituras()[0]?.cuerpo).toEqual({ owners_and_work: { owners: [{ zpuid: 'U2' }] } });
      await expect(pr.asignarResponsable('P1', 'T1', 'nadie@idc.mx', O)).rejects.toMatchObject({ categoria: 'validacion' });
    });

    it('consultarEstados traduce los estados de Zoho a los de las compuertas', async () => {
      const m = montar(rutas());
      expect(await crearProjectsAdapter(m.cli).consultarEstados('P1')).toEqual([
        { id: 'T1', nombre: 'G1 — Acopio legal', clave: 'G1', estadoExterno: 'Open', estado: 'pendiente', inicioPlan: '2026-11-09', finPlan: '2026-11-18', finReal: null },
      ]);
    });

    it('dependencias: deshabilitadas por defecto (no se escribe); habilitadas, enlaza cada una', async () => {
      const m = montar(rutas());
      const apagado = crearProjectsAdapter(m.cli);
      expect(apagado.soportaDependencias).toBe(false);
      expect((await apagado.administrarDependencias('P1', [{ tareaId: 'T1', predecesoraId: 'T0' }], O)).accion).toBe('sin_cambios');
      expect(m.escrituras()).toHaveLength(0);

      const mapeo = conMapeo((x) => { x.projects.escritura.dependenciasHabilitadas = true; return x; });
      const prendido = crearProjectsAdapter(m.cli, mapeo);
      expect(prendido.soportaDependencias).toBe(true);
      await prendido.administrarDependencias('P1', [{ tareaId: 'T1', predecesoraId: 'T0' }], O);
      expect(m.escrituras()[0]?.cuerpo).toEqual({ dependency: { predecessors: [{ id: 'T0' }] } });
    });
  });
});

describe('ZohoWorkDriveAdapter', () => {
  const carpeta = (id: string, name: string) => ({ id, type: 'files', attributes: { name, type: 'folder' } });
  const archivo = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, type: 'files', attributes: { name, type: 'file', ...extra } });

  it('sin carpeta raíz configurada, WorkDrive queda deshabilitado con un error claro', async () => {
    const m = montar([]);
    await expect(crearWorkDriveAdapter(m.cli, null).asegurarCarpetaProyecto('KV-2026-004', [], O)).rejects.toMatchObject({ categoria: 'validacion', message: expect.stringContaining('ZOHO_WORKDRIVE_ROOT_FOLDER_ID') });
  });

  it('organiza por folio: crea la carpeta del folio y una subcarpeta por compuerta, en JSON:API, bajo la raíz', async () => {
    let n = 0;
    const m = montar([
      ['GET', /\/files\/ROOT\/files$/, () => json({ data: [carpeta('X', 'KV-2026-003')] })],
      ['GET', /\/files\/NEW1\/files$/, () => json({ data: [] })],
      ['POST', /\/files$/, () => json({ data: { id: `NEW${++n}`, type: 'files' } })],
    ]);
    const wd = crearWorkDriveAdapter(m.cli, 'ROOT');
    const sim = await wd.asegurarCarpetaProyecto('KV-2026-004', ['G0', 'G1'], SIM);
    expect(sim.accion).toBe('simulado');
    expect(m.escrituras()).toHaveLength(0);

    const r = await wd.asegurarCarpetaProyecto('KV-2026-004', ['G0', 'G1'], O);
    expect(r).toEqual({ carpetaId: 'NEW1', subcarpetas: { G0: 'NEW2', G1: 'NEW3' }, accion: 'creado' });
    expect(m.escrituras().map((c) => c.cuerpo)).toEqual([
      { data: { type: 'files', attributes: { name: 'KV-2026-004', parent_id: 'ROOT' } } },
      { data: { type: 'files', attributes: { name: 'G0', parent_id: 'NEW1' } } },
      { data: { type: 'files', attributes: { name: 'G1', parent_id: 'NEW1' } } },
    ]);
  });

  it('idempotente: si las carpetas ya existen las reutiliza y no crea nada', async () => {
    const m = montar([
      ['GET', /\/files\/ROOT\/files$/, () => json({ data: [carpeta('F1', 'KV-2026-004')] })],
      ['GET', /\/files\/F1\/files$/, () => json({ data: [carpeta('S0', 'G0'), carpeta('S1', 'G1'), archivo('A1', 'G0')] })], // un ARCHIVO llamado G0 no cuenta como carpeta
    ]);
    const r = await crearWorkDriveAdapter(m.cli, 'ROOT').asegurarCarpetaProyecto('KV-2026-004', ['G0', 'G1'], O);
    expect(r).toEqual({ carpetaId: 'F1', subcarpetas: { G0: 'S0', G1: 'S1' }, accion: 'sin_cambios' });
    expect(m.escrituras()).toHaveLength(0);
  });

  it('recorre todas las páginas de una carpeta', async () => {
    const pagina1 = Array.from({ length: 50 }, (_, i) => archivo(`A${i}`, `f${i}.pdf`));
    const m = montar([['GET', /\/files\/F1\/files$/, ({ url }) => json({ data: url.searchParams.get('page[offset]') === '0' ? pagina1 : [archivo('A50', 'f50.pdf')] })]]);
    const lista = await crearWorkDriveAdapter(m.cli, 'ROOT').listarArchivos('F1');
    expect(lista).toHaveLength(51);
    expect(m.llamadas).toHaveLength(2);
  });

  it('listarArchivos devuelve ids, versión y tamaño; omite carpetas', async () => {
    const m = montar([['GET', /\/files\/F1\/files$/, () => json({ data: [carpeta('S', 'G0'), archivo('A1', 'unifilar.pdf', { version: 3, storage_info: { size_in_bytes: 2048 }, permalink: 'https://wd/x' })] })]]);
    expect(await crearWorkDriveAdapter(m.cli, 'ROOT').listarArchivos('F1')).toEqual([{ id: 'A1', nombre: 'unifilar.pdf', carpetaId: 'F1', version: 3, tamano: 2048, url: 'https://wd/x' }]);
  });

  it('subirArchivo: multipart con override-name-exist; si ya existía el nombre, es una versión nueva', async () => {
    const m = montar([
      ['GET', /\/files\/F1\/files$/, () => json({ data: [archivo('A1', 'unifilar.pdf')] })],
      ['POST', /\/upload$/, () => json({ data: [{ type: 'files', attributes: { resource_id: 'A1', FileName: 'unifilar.pdf' } }] })],
    ]);
    const wd = crearWorkDriveAdapter(m.cli, 'ROOT');
    expect((await wd.subirArchivo('F1', 'unifilar.pdf', new Uint8Array([1, 2, 3]), 'application/pdf', SIM)).accion).toBe('simulado');
    expect(m.escrituras()).toHaveLength(0);

    const r = await wd.subirArchivo('F1', 'unifilar.pdf', new Uint8Array([1, 2, 3]), 'application/pdf', O);
    expect(r.accion).toBe('nueva_version');
    expect(r.archivo).toMatchObject({ id: 'A1', nombre: 'unifilar.pdf', carpetaId: 'F1' });
    const subida = m.escrituras()[0]!;
    expect(subida.query).toContain('parent_id=F1');
    expect(subida.query).toContain('filename=unifilar.pdf');
    expect(subida.query).toContain('override-name-exist=true');
    expect(subida.cuerpo).toBeInstanceOf(FormData);
    expect(((subida.cuerpo as FormData).get('content') as File).name).toBe('unifilar.pdf');
  });

  it('subirArchivo: un archivo nuevo es «creado»; si WorkDrive no confirma, es un error', async () => {
    const m = montar([['GET', /\/files\/F1\/files$/, () => json({ data: [] })], ['POST', /\/upload$/, () => json({ data: [] })]]);
    await expect(crearWorkDriveAdapter(m.cli, 'ROOT').subirArchivo('F1', 'a.pdf', new Uint8Array([1]), 'application/pdf', O)).rejects.toThrow(/no confirmó la subida/);
  });
});
