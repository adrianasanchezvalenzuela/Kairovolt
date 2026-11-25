import { describe, expect, it } from 'vitest';
import { hash53, huellaEstable, jsonEstable } from '../../src/application/integracion/huella';
import type { ProyectoSincronizable, PuertoGestionProyectos } from '../../src/application/integracion/puertos';
import { sincronizarProyecto, type DependenciasSincronizacion } from '../../src/application/integracion/sincronizar-proyecto';
import { ZohoError } from '../zoho/auth';
import { crearAdaptadoresDemo } from './demo';
import { crearIntegracion } from './fabrica';
import { crearReferenciasMemoria, crearRegistroMemoria } from './memoria';

const proyecto = (extra: Partial<ProyectoSincronizable> = {}): ProyectoSincronizable => ({
  folio: 'KV-2026-004', nombre: 'Interconexión FV 40 kW', descripcion: null, subcarpetas: ['G0', 'G1', 'G2', 'G3'],
  tareas: (['G0', 'G1', 'G2', 'G3'] as const).map((clave, i, a) => ({
    clave, nombre: `${clave} — tarea`, inicioPlan: `2026-11-0${i + 2}`, finPlan: `2026-11-0${i + 3}`, responsableCorreo: null, predecesora: i === 0 ? null : a[i - 1]!,
  })),
  ...extra,
});

function montar(sobrescribir: Partial<DependenciasSincronizacion> = {}) {
  const demo = crearAdaptadoresDemo();
  const registro = crearRegistroMemoria();
  const referencias = crearReferenciasMemoria();
  let n = 0;
  const deps: DependenciasSincronizacion = { ...demo, proyectos: demo.proyectos, referencias, registro, ahora: () => '2026-11-22T20:00:00.000Z', nuevoId: () => `id-${++n}`, ...sobrescribir };
  return { deps, registro, referencias, demo };
}

describe('huella estable (clave de idempotencia)', () => {
  it('no depende del orden de las claves y distingue contenidos distintos', () => {
    expect(jsonEstable({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe('{"a":[2,{"c":3,"d":4}],"b":1}');
    expect(huellaEstable({ a: 1, b: 2 })).toBe(huellaEstable({ b: 2, a: 1 }));
    expect(huellaEstable({ a: 1 })).not.toBe(huellaEstable({ a: 2 }));
    expect(huellaEstable({ a: undefined, b: 1 })).toBe(huellaEstable({ b: 1 }));
    expect(hash53('x')).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe('sincronizarProyecto: primera sincronización', () => {
  it('crea proyecto, lista, 4 tareas, dependencias, carpetas y trato con sus referencias, y registra cada paso', async () => {
    const m = montar();
    const r = await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    expect(r).toMatchObject({ folio: 'KV-2026-004', modo: 'real', ok: true, advertencias: [] });
    const ops = r.pasos.map((p) => `${p.destino}:${p.operacion}`);
    expect(ops).toEqual([
      'projects:asegurar_proyecto', 'projects:asegurar_lista',
      'projects:asegurar_tarea:G0', 'projects:asegurar_tarea:G1', 'projects:asegurar_tarea:G2', 'projects:asegurar_tarea:G3',
      'projects:dependencias', 'workdrive:asegurar_carpeta',
      'crm:upsert_proyecto', 'crm:sincronizar_folio', 'crm:referencia:proyecto', 'crm:referencia:carpeta',
    ]);
    expect(r.pasos.every((p) => p.estado === 'ok')).toBe(true);
    expect(m.registro.todos).toHaveLength(r.pasos.length); // CADA paso queda registrado
    expect((await m.referencias.listar('KV-2026-004')).map((x) => `${x.sistema}:${x.tipo}`).sort()).toEqual([
      'zoho_crm:trato', 'zoho_projects:proyecto', 'zoho_projects:tarea:G0', 'zoho_projects:tarea:G1', 'zoho_projects:tarea:G2', 'zoho_projects:tarea:G3',
      'zoho_workdrive:carpeta', 'zoho_workdrive:carpeta:G0', 'zoho_workdrive:carpeta:G1', 'zoho_workdrive:carpeta:G2', 'zoho_workdrive:carpeta:G3',
    ]);
  });

  it('asigna responsables cuando se indican', async () => {
    const m = montar();
    const p = proyecto();
    p.tareas[1]!.responsableCorreo = 'ana@idc.mx';
    const r = await sincronizarProyecto(m.deps, p, { simular: false });
    expect(r.pasos.map((x) => x.operacion)).toContain('asignar:G1');
    expect(r.ok).toBe(true);
  });
});

describe('IDEMPOTENCIA: repetir la sincronización no duplica nada', () => {
  it('la segunda vez todo se OMITE (sin llamar de nuevo a los sistemas) y los ids son los mismos', async () => {
    const m = montar();
    const primera = await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    const llamadasAntes = m.registro.todos.length;
    const segunda = await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    expect(segunda.pasos.every((p) => p.estado === 'omitido' && p.accion === 'sin_cambios')).toBe(true);
    expect(segunda.pasos.map((p) => p.idExterno)).toEqual(primera.pasos.map((p) => p.idExterno)); // mismos ids: nada nuevo
    expect(m.registro.todos.length).toBe(llamadasAntes + segunda.pasos.length); // se registra incluso lo omitido
  });

  it('si cambia una fecha, solo se re-sincroniza esa tarea; lo demás se omite', async () => {
    const m = montar();
    await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    const cambiado = proyecto();
    cambiado.tareas[2]!.finPlan = '2026-12-15';
    const r = await sincronizarProyecto(m.deps, cambiado, { simular: false });
    const g2 = r.pasos.find((p) => p.operacion === 'asegurar_tarea:G2')!;
    expect(g2).toMatchObject({ estado: 'ok', accion: 'actualizado' });
    expect(r.pasos.filter((p) => p.estado === 'omitido').length).toBeGreaterThanOrEqual(8);
  });

  it('`forzar` ejecuta de nuevo, pero los adaptadores siguen sin duplicar (sin_cambios)', async () => {
    const m = montar();
    await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    const r = await sincronizarProyecto(m.deps, proyecto(), { simular: false, forzar: true });
    expect(r.pasos.every((p) => p.estado === 'ok' && p.accion === 'sin_cambios')).toBe(true);
  });

  it('un paso que falló NO cuenta como hecho: al reintentar se ejecuta', async () => {
    let falla = true;
    const m = montar();
    const proyectos: PuertoGestionProyectos = { ...m.demo.proyectos, asegurarTarea: async (...a) => { if (falla && a[3].clave === 'G1') throw new ZohoError('Zoho Projects respondió 503', 503, 'servidor', true, 4); return m.demo.proyectos.asegurarTarea(...a); } };
    const deps = { ...m.deps, proyectos };
    const r1 = await sincronizarProyecto(deps, proyecto(), { simular: false });
    expect(r1.ok).toBe(false);
    falla = false;
    const r2 = await sincronizarProyecto(deps, proyecto(), { simular: false });
    expect(r2.ok).toBe(true);
    expect(r2.pasos.find((p) => p.operacion === 'asegurar_tarea:G1')?.estado).toBe('ok');
    expect(r2.pasos.find((p) => p.operacion === 'asegurar_tarea:G0')?.estado).toBe('omitido');
  });
});

describe('errores y dependencias entre pasos', () => {
  it('un fallo se registra con su categoría e intentos, sin detener los pasos independientes', async () => {
    const m = montar();
    const archivos = { ...m.demo.archivos, asegurarCarpetaProyecto: async () => { throw new ZohoError('Zoho WorkDrive respondió 500 (F7007): Invalid OAuth scope.', 500, 'permiso', false, 1); } };
    const r = await sincronizarProyecto({ ...m.deps, archivos }, proyecto(), { simular: false });
    expect(r.ok).toBe(false);
    const paso = r.pasos.find((p) => p.operacion === 'asegurar_carpeta')!;
    expect(paso).toMatchObject({ estado: 'error', error: 'Zoho WorkDrive respondió 500 (F7007): Invalid OAuth scope.' });
    expect(m.registro.todos.find((x) => x.operacion === 'asegurar_carpeta')).toMatchObject({ estado: 'error', categoriaError: 'permiso', intentos: 1 });
    // el resto sí se hizo (proyecto, tareas, trato)
    expect(r.pasos.filter((p) => p.destino === 'projects' && p.estado === 'ok').length).toBeGreaterThan(4);
    expect(r.pasos.find((p) => p.operacion === 'upsert_proyecto')?.estado).toBe('ok');
    // y no se anotó una referencia a una carpeta que no existe
    expect(r.pasos.some((p) => p.operacion === 'referencia:carpeta')).toBe(false);
  });

  it('si falla el proyecto, las tareas se omiten con el motivo (no se intentan a ciegas)', async () => {
    const m = montar();
    const proyectos = { ...m.demo.proyectos, asegurarProyecto: async () => { throw new ZohoError('sin permiso', 403, 'permiso'); } };
    const r = await sincronizarProyecto({ ...m.deps, proyectos }, proyecto(), { simular: false });
    expect(r.ok).toBe(false);
    const tareas = r.pasos.filter((p) => p.operacion.startsWith('asegurar_tarea'));
    expect(tareas).toHaveLength(4);
    expect(tareas.every((p) => p.estado === 'omitido' && /Depende/.test(p.error ?? ''))).toBe(true);
  });

  it('si falla la lista de tareas (p. ej. falta un permiso), avisa y crea las tareas en la lista por defecto', async () => {
    const m = montar();
    const proyectos = { ...m.demo.proyectos, asegurarListaTareas: async () => { throw new ZohoError('Invalid OAuth scope', 401, 'permiso'); } };
    const r = await sincronizarProyecto({ ...m.deps, proyectos }, proyecto(), { simular: false });
    expect(r.advertencias[0]).toMatch(/lista «Compuertas»/);
    expect(r.pasos.filter((p) => p.operacion.startsWith('asegurar_tarea') && p.estado === 'ok')).toHaveLength(4);
  });

  it('sin trato en el CRM no se intenta sincronizar el folio', async () => {
    const m = montar();
    const crm = { ...m.demo.crm, upsertProyecto: async () => { throw new ZohoError('No existe el trato', undefined, 'validacion'); } };
    const r = await sincronizarProyecto({ ...m.deps, crm }, proyecto(), { simular: false });
    expect(r.pasos.find((p) => p.operacion === 'sincronizar_folio')).toMatchObject({ estado: 'omitido' });
  });

  it('las dependencias solo se administran si el servicio las ofrece; si no, se avisa', async () => {
    const m = montar();
    const proyectos = { ...m.demo.proyectos, soportaDependencias: false };
    const r = await sincronizarProyecto({ ...m.deps, proyectos }, proyecto(), { simular: false });
    expect(r.pasos.some((p) => p.operacion === 'dependencias')).toBe(false);
    expect(r.advertencias.join(' ')).toMatch(/no ofrece dependencias/);
  });

  it('un mensaje de error largo se recorta y no puede traer secretos de la capa de adaptadores', async () => {
    const m = montar();
    const proyectos = { ...m.demo.proyectos, asegurarProyecto: async () => { throw new Error('x'.repeat(1000)); } };
    const r = await sincronizarProyecto({ ...m.deps, proyectos }, proyecto(), { simular: false });
    expect(r.pasos[0]?.error).toHaveLength(300);
  });
});

describe('simulación', () => {
  it('no escribe nada, devuelve lo que se haría y queda registrada como «simulado» (sin contar como hecha)', async () => {
    const m = montar();
    const sim = await sincronizarProyecto(m.deps, proyecto(), { simular: true });
    expect(sim).toMatchObject({ modo: 'simulado', ok: true });
    expect(sim.pasos.every((p) => p.estado === 'simulado')).toBe(true);
    // en simulación nada se crea ni se actualiza: solo «se haría» (simulado) o «ya está» (sin cambios)
    expect(sim.pasos.every((p) => p.accion === 'simulado' || p.accion === 'sin_cambios')).toBe(true);
    expect(sim.pasos.filter((p) => p.accion === 'simulado').length).toBeGreaterThan(8);
    expect(await m.referencias.listar('KV-2026-004')).toEqual([]); // ninguna referencia real
    // una simulación no impide la sincronización real después
    const real = await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    expect(real.pasos.every((p) => p.estado === 'ok')).toBe(true);
  });

  it('después de sincronizar de verdad, simular ya no propone crear nada', async () => {
    const m = montar();
    await sincronizarProyecto(m.deps, proyecto(), { simular: false });
    const sim = await sincronizarProyecto(m.deps, proyecto(), { simular: true });
    expect(sim.pasos.every((p) => p.accion === 'sin_cambios')).toBe(true);
  });
});

describe('modo DEMO / NO CONECTADO', () => {
  it('sin cliente de Zoho se usan los adaptadores DEMO y la etiqueta lo dice claramente', async () => {
    const i = crearIntegracion({ cli: null, sb: null, workdriveRootId: null });
    expect(i).toMatchObject({ modo: 'demo', persistencia: 'memoria', servicios: { crm: false, projects: false, workdrive: false } });
    expect(i.etiqueta).toBe('DEMO — NO CONECTADO A ZOHO (no se escribe nada en Zoho)');
  });

  it('los ids de DEMO son reconocibles (nunca parecen ids reales de Zoho) y el flujo funciona de punta a punta', async () => {
    const i = crearIntegracion({ cli: null, sb: null, workdriveRootId: null });
    const r = await sincronizarProyecto(i.deps, proyecto(), { simular: false });
    expect(r.ok).toBe(true);
    const ids = r.pasos.map((p) => p.idExterno).filter(Boolean) as string[];
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.every((x) => x.startsWith('demo-'))).toBe(true);
    const otra = await sincronizarProyecto(i.deps, proyecto(), { simular: false });
    expect(otra.pasos.every((p) => p.estado === 'omitido')).toBe(true); // la idempotencia también en DEMO
  });

  it('las consultas del CRM en DEMO devuelven vacío: no se inventan clientes', async () => {
    const d = crearAdaptadoresDemo();
    expect(await d.crm.consultarClientes()).toEqual([]);
    expect(await d.crm.consultarContactos()).toEqual([]);
  });

  it('subir archivos en DEMO conserva versiones por nombre', async () => {
    const d = crearAdaptadoresDemo();
    const o = { simular: false };
    const c = await d.archivos.asegurarCarpetaProyecto('KV-2026-004', ['G1'], o);
    const a1 = await d.archivos.subirArchivo(c.subcarpetas.G1!, 'unifilar.pdf', new Uint8Array(10), 'application/pdf', o);
    const a2 = await d.archivos.subirArchivo(c.subcarpetas.G1!, 'unifilar.pdf', new Uint8Array(12), 'application/pdf', o);
    expect(a1).toMatchObject({ accion: 'creado' });
    expect(a2).toMatchObject({ accion: 'nueva_version', archivo: { version: 2, id: a1.archivo?.id } });
    expect(await d.archivos.listarArchivos(c.subcarpetas.G1!)).toHaveLength(1);
  });
});
