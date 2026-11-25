import { describe, expect, it } from 'vitest';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { evaluarChecklist } from './checklist/checklist';
import { evaluarBloqueoCompuerta, validacionesPendientes } from './compuertas/bloqueo';
import type { Compuerta } from './compuertas/compuerta';
import { calcularPaerPeriodo } from './indicadores/paer';
import { calcularPpc } from './indicadores/ppc';
import {
  debeReabrirse, evaluarResolucion, excepcionesVigentes, observacionDesdeValidacion, puedeTransicionar, reabrirObservaciones, resolverObservacion,
} from './observaciones/resolucion';
import type { Observacion, ResolucionObservacion } from './observaciones/observacion';
import { ejecutarReglas } from './reglas/motor';
import { congelar, contexto40kw, doc, HOY } from './reglas/expediente-40kw.fixture';
import type { ResultadoValidacion } from './reglas/tipos';
import { calcularTiemposProceso, diasHabiles } from './tiempos/tiempos';
import type { HitoProyecto } from './entidades/hito';
import { crearEventoAuditoria } from './entidades/evento-auditoria';
import { documentoActual, validarVersiones, versionVigente, type DocumentoConVersiones } from './entidades/version-documento';

const resultado = (id: string, extra: Partial<ResultadoValidacion> = {}): ResultadoValidacion => ({
  reglaId: id, reglaNombre: id, categoria: 'cruzada', campo: 'nivel_tension', documentosOrigen: [], valorEncontrado: 'MT / BT', valorEsperado: null,
  resultado: 'no_cumple', severidad: 'bloqueante', explicacion: 'x'.repeat(10), accionRecomendada: 'a', requiereAprobacionHumana: true, compuerta: null,
  huella: `${id}:nivel_tension:*`, parametrosSupuestos: false, ...extra,
});
const obsDe = (r: ResultadoValidacion, extra: Partial<Observacion> = {}): Observacion =>
  ({ ...observacionDesdeValidacion(r, { id: 'o1', hoy: HOY })!, ...extra });
const res = (tipo: ResolucionObservacion['tipo'], extra: Partial<ResolucionObservacion> = {}): ResolucionObservacion =>
  ({ tipo, justificacion: 'Se confirmó con el cliente por correo', responsable: 'Proyectista', fecha: HOY, ...extra });
const gates = (estados: Compuerta['estado'][]): Compuerta[] => (['G0', 'G1', 'G2', 'G3'] as const).map((id, i) => ({ id, estado: estados[i] ?? 'pendiente' }));
const ev = { id: 'ev1', creadoEn: '2026-11-22T20:00:00Z', actorUserId: 'u1', folio: 'KV-2026-004' };

describe('resolución de observaciones', () => {
  it('estados: abierta ⇄ en atención → cerrada; una cerrada solo se reabre', () => {
    expect(puedeTransicionar('abierta', 'en_atencion')).toBe(true);
    expect(puedeTransicionar('abierta', 'cerrada')).toBe(true);
    expect(puedeTransicionar('cerrada', 'en_atencion')).toBe(false);
    expect(puedeTransicionar('cerrada', 'abierta')).toBe(true);
  });

  it('una observación nace de un fallo (no de un «cumple»), con su huella y severidad', () => {
    expect(observacionDesdeValidacion(resultado('CRU-001', { resultado: 'cumple' }), { id: 'x', hoy: HOY })).toBeNull();
    const o = obsDe(resultado('CRU-001'));
    expect(o).toMatchObject({ estado: 'abierta', compuerta: 'G2', severidad: 'bloqueante', origenValidacion: { reglaId: 'CRU-001', huella: 'CRU-001:nivel_tension:*' } });
  });

  it('exige responsable, fecha válida y justificación suficiente', () => {
    const d = evaluarResolucion(obsDe(resultado('CRU-001')), { tipo: 'no_aplica', justificacion: 'corto', responsable: ' ', fecha: '22/11/2026' }, { actorPuedeAprobar: true });
    expect(d.ok).toBe(false);
    expect(d.ok ? [] : d.motivos).toHaveLength(3);
  });

  it('«corregido» solo se acepta si al revalidar YA cumple; no basta con decirlo', () => {
    const o = obsDe(resultado('CRU-001'));
    const sigueFallando = evaluarResolucion(o, res('corregido'), { validacionActual: resultado('CRU-001'), actorPuedeAprobar: true });
    expect(sigueFallando).toMatchObject({ ok: false });
    expect(JSON.stringify(sigueFallando)).toMatch(/sigue sin cumplirse/);
    expect(evaluarResolucion(o, res('corregido'), { actorPuedeAprobar: true })).toMatchObject({ ok: false }); // sin revalidar
    expect(evaluarResolucion(o, res('corregido'), { validacionActual: resultado('CRU-001', { resultado: 'no_evaluable' }), actorPuedeAprobar: true })).toMatchObject({ ok: false });
    expect(evaluarResolucion(o, res('corregido'), { validacionActual: resultado('CRU-001', { resultado: 'cumple' }), actorPuedeAprobar: false })).toEqual({ ok: true });
  });

  it('una excepción sobre una validación que exige aprobación solo la aprueba un rol autorizado', () => {
    const o = obsDe(resultado('CRU-001'));
    const ctx = (puede: boolean) => ({ validacionActual: resultado('CRU-001'), actorPuedeAprobar: puede });
    expect(evaluarResolucion(o, res('aceptado_con_justificacion'), ctx(false))).toMatchObject({ ok: false });
    expect(evaluarResolucion(o, res('aceptado_con_justificacion'), ctx(true))).toEqual({ ok: true });
    expect(evaluarResolucion(o, res('no_aplica'), ctx(false))).toMatchObject({ ok: false });
    // si la regla no exige aprobación humana, no hace falta el aprobador
    const sinAprob = resultado('OBL-001', { requiereAprobacionHumana: false, huella: 'OBL-001:x:d1' });
    expect(evaluarResolucion(obsDe(sinAprob), res('aceptado_con_justificacion'), { validacionActual: sinAprob, actorPuedeAprobar: false })).toEqual({ ok: true });
  });

  it('resolver devuelve una copia cerrada + el evento de auditoría, y NO muta la observación original', () => {
    const original = congelar(obsDe(resultado('CRU-001')));
    const r = resolverObservacion(original, res('aceptado_con_justificacion'), { validacionActual: resultado('CRU-001'), actorPuedeAprobar: true }, ev);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(original.estado).toBe('abierta');
    expect(r.observacion).toMatchObject({ estado: 'cerrada', resolucion: { tipo: 'aceptado_con_justificacion', valorAprobado: 'MT / BT' } });
    expect(r.evento).toMatchObject({ entidad: 'observacion', entidadId: 'o1', accion: 'excepcion_aprobada', actorUserId: 'u1', folio: 'KV-2026-004', origen: 'app' });
    expect(r.evento.detalles).toEqual({ tipo: 'aceptado_con_justificacion', compuerta: 'G2', reglaId: 'CRU-001', responsable: 'Proyectista' });
  });

  it('cerrar como «corregido» genera «observacion_resuelta» (no excepción) y no guarda valor aprobado', () => {
    const r = resolverObservacion(obsDe(resultado('CRU-001')), res('corregido'), { validacionActual: resultado('CRU-001', { resultado: 'cumple' }), actorPuedeAprobar: false }, ev);
    expect(r.ok && r.evento.accion).toBe('observacion_resuelta');
    expect(r.ok && r.observacion.resolucion?.valorAprobado).toBeNull();
  });

  it('una observación cerrada no se vuelve a cerrar', () => {
    expect(evaluarResolucion(obsDe(resultado('CRU-001'), { estado: 'cerrada' }), res('no_aplica'), { actorPuedeAprobar: true })).toMatchObject({ ok: false });
  });

  it('se reabre sola si lo «corregido» vuelve a fallar', () => {
    const cerrada = obsDe(resultado('CRU-001'), { estado: 'cerrada', resolucion: res('corregido') });
    expect(debeReabrirse(cerrada, [resultado('CRU-001')])).toBe(true);
    expect(debeReabrirse(cerrada, [resultado('CRU-001', { resultado: 'cumple' })])).toBe(false);
    const { observaciones, eventos } = reabrirObservaciones([cerrada], [resultado('CRU-001')], () => ev);
    expect(observaciones[0]).toMatchObject({ estado: 'abierta', resolucion: null });
    expect(eventos[0]).toMatchObject({ accion: 'observacion_reabierta', origen: 'system' });
    expect(cerrada.estado).toBe('cerrada'); // la original no se toca
  });

  it('una excepción aprobada vale SOLO para el valor aprobado: si el dato cambia, se reabre', () => {
    const aprobada = obsDe(resultado('CRU-001'), { estado: 'cerrada', resolucion: res('aceptado_con_justificacion', { valorAprobado: 'MT / BT' }) });
    expect(debeReabrirse(aprobada, [resultado('CRU-001', { valorEncontrado: 'MT / BT' })])).toBe(false);
    expect(debeReabrirse(aprobada, [resultado('CRU-001', { valorEncontrado: 'MT / BT / 13.2 kV' })])).toBe(true);
  });
});

describe('bloqueo de compuertas', () => {
  const vacio = { resumenes: [], validacionesBloqueantes: [] };

  it('G2 se bloquea con validaciones bloqueantes pendientes, y las excepciones vigentes las liberan', () => {
    const fallo = resultado('CRU-001');
    const pendientes = validacionesPendientes([fallo]);
    expect(pendientes).toHaveLength(1);
    const d = evaluarBloqueoCompuerta({ compuerta: 'G2', compuertas: gates(['liberada', 'liberada']), ...vacio, validacionesBloqueantes: pendientes });
    expect(d).toMatchObject({ bloqueada: true, razones: [{ tipo: 'validacion_bloqueante', mensaje: '1 hallazgo(s) bloqueante(s) abierto(s)' }] });

    const aprobada = obsDe(fallo, { estado: 'cerrada', resolucion: res('aceptado_con_justificacion', { valorAprobado: 'MT / BT' }) });
    expect(validacionesPendientes([fallo], [aprobada])).toHaveLength(0);
    expect(excepcionesVigentes([aprobada], [fallo]).has(fallo.huella)).toBe(true);
    // si el dato cambia, el fallo vuelve a bloquear
    expect(validacionesPendientes([resultado('CRU-001', { valorEncontrado: 'otro' })], [aprobada])).toHaveLength(1);
  });

  it('las validaciones solo bloquean las compuertas configuradas (por defecto, G2)', () => {
    const v = [{ reglaId: 'CRU-001', huella: 'h', titulo: 't' }];
    expect(evaluarBloqueoCompuerta({ compuerta: 'G1', compuertas: gates(['liberada']), ...vacio, validacionesBloqueantes: v }).bloqueada).toBe(false);
    const cfg = { compuertasConValidaciones: ['G1', 'G2'] as const, origenesQueBloquean: [] as const };
    expect(evaluarBloqueoCompuerta({ compuerta: 'G1', compuertas: gates(['liberada']), ...vacio, validacionesBloqueantes: v, config: cfg }).bloqueada).toBe(true);
  });

  it('devuelve TODAS las razones: previas sin liberar, documentos faltantes y ya liberada', () => {
    const resumenes = evaluarChecklist(catalogoRequisitosBase, []);
    const d = evaluarBloqueoCompuerta({ compuerta: 'G2', compuertas: gates(['pendiente', 'pendiente']), resumenes, validacionesBloqueantes: [{ reglaId: 'r', huella: 'h', titulo: 't' }] });
    expect(d.razones.map((r) => r.tipo)).toEqual(['validacion_bloqueante', 'compuerta_previa', 'compuerta_previa', 'documentos_faltantes']);
    expect(evaluarBloqueoCompuerta({ compuerta: 'G0', compuertas: gates(['liberada']), ...vacio }).razones[0]?.mensaje).toBe('G0 ya está liberada');
  });

  it('las observaciones abiertas de CFE/UVIE o de severidad bloqueante bloquean su compuerta; las cerradas o internas sin severidad no', () => {
    const base = { id: 'o', compuerta: 'G1' as const, descripcion: 'd', fechaRegistro: HOY, fechaCompromiso: null, responsable: null };
    const obs: Observacion[] = [
      { ...base, id: 'cfe', origen: 'cfe', estado: 'abierta' },
      { ...base, id: 'uvie-cerrada', origen: 'uvie', estado: 'cerrada' },
      { ...base, id: 'interna', origen: 'interna', estado: 'abierta' },
      { ...base, id: 'interna-bloq', origen: 'interna', estado: 'en_atencion', severidad: 'bloqueante' },
      { ...base, id: 'otra-compuerta', origen: 'cfe', estado: 'abierta', compuerta: 'G2' },
    ];
    const d = evaluarBloqueoCompuerta({ compuerta: 'G1', compuertas: gates(['liberada']), ...vacio, observaciones: obs });
    expect(d.razones).toEqual([{ tipo: 'observaciones_abiertas', mensaje: '2 observación(es) abierta(s) que bloquean G1', referencias: ['cfe', 'interna-bloq'] }]);
  });
});

describe('flujo completo con el expediente de 40 kW (validar → observar → resolver → bloquear)', () => {
  const resultados = ejecutarReglas(contexto40kw());

  it('G2 está bloqueada por los 5 fallos bloqueantes, las compuertas previas y los documentos que faltan', () => {
    const pendientes = validacionesPendientes(resultados);
    expect(pendientes.map((p) => p.reglaId).sort()).toEqual(['CRU-001', 'CRU-002', 'CRU-011', 'OBL-001', 'VIG-001']);
    const resumenes = evaluarChecklist(catalogoRequisitosBase, contexto40kw().documentos);
    const d = evaluarBloqueoCompuerta({ compuerta: 'G2', compuertas: gates([]), resumenes, validacionesBloqueantes: pendientes });
    expect(d.bloqueada).toBe(true);
    expect(d.razones.map((r) => r.tipo)).toEqual(expect.arrayContaining(['validacion_bloqueante', 'compuerta_previa', 'documentos_faltantes']));
  });

  it('la discrepancia MT/BT se convierte en observación; un aprobador la acepta como excepción y deja de bloquear solo ese fallo', () => {
    const cru1 = resultados.find((r) => r.reglaId === 'CRU-001')!;
    const o = observacionDesdeValidacion(cru1, { id: 'obs-1', hoy: HOY })!;
    expect(o.descripcion).toMatch(/no determina cuál versión es la correcta/);

    expect(evaluarResolucion(o, res('aceptado_con_justificacion'), { validacionActual: cru1, actorPuedeAprobar: false })).toMatchObject({ ok: false });
    const r = resolverObservacion(o, res('aceptado_con_justificacion'), { validacionActual: cru1, actorPuedeAprobar: true }, ev);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const pendientes = validacionesPendientes(resultados, [r.observacion]);
    expect(pendientes.map((p) => p.reglaId).sort()).toEqual(['CRU-002', 'CRU-011', 'OBL-001', 'VIG-001']);

    // la excepción es solo para MT/BT: si luego aparece otro valor, vuelve a bloquear
    const ctxCambiado = contexto40kw({ documentos: [...contexto40kw().documentos, doc('nuevo', 'solicitud', [{ campo: 'nivel_tension', valor: '13.2 kV' }])] });
    const nuevos = ejecutarReglas(ctxCambiado);
    expect(validacionesPendientes(nuevos, [r.observacion]).map((p) => p.reglaId)).toContain('CRU-001');
  });

  it('corregir de verdad (alinear el dato en una versión nueva) hace que la regla cumpla y permite cerrar como «corregido»', () => {
    const cru2 = resultados.find((r) => r.reglaId === 'CRU-002')!;
    const o = observacionDesdeValidacion(cru2, { id: 'obs-2', hoy: HOY })!;
    const docs = contexto40kw().documentos.map((d) => (d.id === 'd8' ? { ...d, datos: [{ campo: 'modelo_modulo' as const, valor: 'CS6.2-66TB-615' }] } : d));
    const revalidado = ejecutarReglas(contexto40kw({ documentos: docs })).find((r) => r.reglaId === 'CRU-002')!;
    expect(revalidado.resultado).toBe('cumple');
    expect(evaluarResolucion(o, res('corregido'), { validacionActual: revalidado, actorPuedeAprobar: false })).toEqual({ ok: true });
  });

  it('PPC del cronograma y PAER por periodo del caso de referencia', () => {
    const acts = [
      { id: 'a', nombre: 'a', compuerta: 'G0' as const, inicioPlan: '2026-11-02', finPlan: '2026-11-06', finReal: '2026-11-05', responsable: null },
      { id: 'b', nombre: 'b', compuerta: 'G1' as const, inicioPlan: '2026-11-09', finPlan: '2026-11-13', finReal: '2026-11-16', responsable: null },
    ];
    expect(calcularPpc(acts, '2026-11-20')).toEqual({ planeadas: 2, cumplidas: 1, porcentaje: 50 });
    const acciones = [
      { id: '1', semana: '2026-11-09', descripcion: 'x', responsable: null, estado: 'completada' as const },
      { id: '2', semana: '2026-11-16', descripcion: 'y', responsable: null, estado: 'completada' as const },
      { id: '3', semana: '2026-11-16', descripcion: 'z', responsable: null, estado: 'no_realizada' as const },
      { id: '4', semana: '2026-11-23', descripcion: 'w', responsable: null, estado: 'pendiente' as const },
    ];
    expect(calcularPaerPeriodo(acciones, '2026-11-09', '2026-11-16')).toEqual({ total: 3, completadas: 2, porcentaje: 66.7 });
    expect(calcularPaerPeriodo(acciones, '2026-11-09', '2026-11-23').porcentaje).toBe(50);
    expect(calcularPaerPeriodo(acciones, '2027-01-01', '2027-01-31')).toEqual({ total: 0, completadas: 0, porcentaje: null });
  });
});

describe('tiempos de proceso', () => {
  const h = (id: string, tipo: HitoProyecto['tipo'], compuerta: HitoProyecto['compuerta'], inicioPlan: string, finPlan: string, finReal: string | null): HitoProyecto =>
    ({ id, nombre: id, tipo, compuerta, inicioPlan, finPlan, finReal, responsable: null });

  it('días hábiles: lunes a viernes, sin festivos, con signo', () => {
    expect(diasHabiles('2026-11-20', '2026-11-23')).toBe(1); // viernes → lunes
    expect(diasHabiles('2026-11-16', '2026-11-23')).toBe(5);
    expect(diasHabiles('2026-11-16', '2026-11-23', ['2026-11-16', '2026-11-17'])).toBe(4); // el festivo del inicio no cuenta (rango abierto), el del 17 sí resta
    expect(diasHabiles('2026-11-23', '2026-11-16')).toBe(-5);
    expect(diasHabiles('2026-11-21', '2026-11-22')).toBe(0); // fin de semana
  });

  it('mide obra terminada → ingreso a CFE y obra → interconexión (el retraso que preocupa a IDC)', () => {
    const t = calcularTiemposProceso([
      h('obra', 'obra_terminada', 'G2', '2026-10-01', '2026-10-20', '2026-10-19'),
      h('ingreso', 'ingreso_cfe', 'G3', '2026-11-02', '2026-11-06', '2026-11-12'),
    ], HOY);
    const obraIngreso = t.entreHitos.find((x) => x.id === 'obra_a_ingreso')!;
    expect(obraIngreso).toMatchObject({ desde: '2026-10-19', hasta: '2026-11-12', dias: 24, enCurso: false, inconsistente: false });
    expect(obraIngreso.diasHabiles).toBe(18); // 24 días naturales: 3 fines de semana completos + 1 día → 18 hábiles
    const obraInterconexion = t.entreHitos.find((x) => x.id === 'obra_a_interconexion')!;
    expect(obraInterconexion).toMatchObject({ hasta: null, enCurso: true, dias: 34 }); // corre hasta hoy mientras no haya interconexión
  });

  it('sin el hito de origen no hay medición; fechas contradictorias se marcan, no se corrigen', () => {
    const t = calcularTiemposProceso([h('ing', 'ingreso_cfe', 'G3', '2026-11-01', '2026-11-05', '2026-11-10'), h('dic', 'dictamen_uvie', 'G3', '2026-11-01', '2026-11-05', '2026-11-03')], HOY);
    expect(t.entreHitos.find((x) => x.id === 'obra_a_ingreso')).toMatchObject({ dias: null, enCurso: false });
    expect(t.entreHitos.find((x) => x.id === 'ingreso_a_dictamen')).toMatchObject({ dias: -7, inconsistente: true });
  });

  it('por compuerta: duración, si sigue en curso y el mayor atraso contra el plan', () => {
    const t = calcularTiemposProceso([
      h('a', null, 'G0', '2026-11-02', '2026-11-06', '2026-11-05'),
      h('b', null, 'G1', '2026-11-09', '2026-11-13', '2026-11-16'), // terminó 3 días tarde
      h('c', null, 'G1', '2026-11-09', '2026-11-18', null),          // vencida sin terminar: atraso a hoy
      h('d', null, 'G2', '2026-11-30', '2026-12-04', null),          // aún no empieza
    ], HOY);
    const g = (c: string) => t.porCompuerta.find((x) => x.compuerta === c)!;
    expect(g('G0')).toMatchObject({ inicio: '2026-11-02', fin: '2026-11-05', dias: 3, enCurso: false, retrasoDias: 0 });
    expect(g('G1')).toMatchObject({ inicio: '2026-11-09', fin: null, dias: 13, enCurso: true, retrasoDias: 4 });
    expect(g('G2')).toMatchObject({ enCurso: false, retrasoDias: 0 });
    expect(g('G3')).toMatchObject({ inicio: null, dias: null, enCurso: false });
  });

  it('días sin movimiento y desde el inicio', () => {
    const t = calcularTiemposProceso([h('a', 'inicio_proyecto', 'G0', '2026-11-01', '2026-11-03', '2026-11-02'), h('b', null, 'G1', '2026-11-09', '2026-11-13', '2026-11-16')], HOY);
    expect(t.diasSinMovimiento).toBe(6);
    expect(t.diasDesdeInicio).toBe(20);
    expect(calcularTiemposProceso([], HOY)).toMatchObject({ diasSinMovimiento: null, diasDesdeInicio: null });
  });

  it('se pueden definir otros pares de hitos', () => {
    const t = calcularTiemposProceso([h('a', 'consulta_capacidad', 'G0', '2026-11-02', '2026-11-06', '2026-11-04'), h('b', 'acopio_completo', 'G1', '2026-11-09', '2026-11-13', '2026-11-12')], HOY, {
      pares: [{ id: 'g0_a_g1', etiqueta: 'Consulta → acopio', desde: 'consulta_capacidad', hasta: 'acopio_completo' }],
    });
    expect(t.entreHitos).toEqual([expect.objectContaining({ id: 'g0_a_g1', dias: 8 })]);
  });
});

describe('versiones de documento y eventos', () => {
  const v = (n: number, sust: string | null, datos: DocumentoConVersiones['versiones'][number]['datos'], extra = {}) => ({
    id: `v${n}`, documentoId: 'd1', numero: n, nombreArchivo: `f${n}.pdf`, subidoPor: null, subidoEn: '2026-11-22T00:00:00Z', sha256: null,
    sustituyeVersionId: sust, fechaEmision: null, fechaVigencia: null, datos, ...extra,
  });
  const documento = (versiones: DocumentoConVersiones['versiones']): DocumentoConVersiones => ({ id: 'd1', tipo: 'diagrama_unifilar', nombre: 'Unifilar', versiones });

  it('las reglas evalúan solo la versión vigente: una versión nueva corrige el dato sin borrar el rastro', () => {
    const d = documento([v(1, null, [{ campo: 'nivel_tension', valor: 'BT' }]), v(2, 'v1', [{ campo: 'nivel_tension', valor: 'MT' }])]);
    expect(versionVigente(d)?.numero).toBe(2);
    expect(documentoActual(d)?.datos).toEqual([{ campo: 'nivel_tension', valor: 'MT' }]);
    expect(d.versiones).toHaveLength(2);
    expect(documentoActual(documento([]))).toBeNull();
    const rs = ejecutarReglas({ hoy: HOY, documentos: [documentoActual(d)!, doc('otro', 'solicitud', [{ campo: 'nivel_tension', valor: 'MT' }])] });
    expect(rs.find((r) => r.reglaId === 'CRU-001')?.resultado).toBe('cumple');
  });

  it('valida la cadena de versiones', () => {
    expect(validarVersiones(documento([v(1, null, []), v(2, 'v1', [])]))).toEqual([]);
    expect(validarVersiones(documento([v(1, null, []), v(3, 'v1', [])]))).toEqual(['Se esperaba la versión 2 y se encontró la 3.']);
    expect(validarVersiones(documento([v(1, 'vX', [])]))).toEqual(['La primera versión no puede sustituir a otra.']);
    expect(validarVersiones(documento([v(1, null, []), v(2, null, [])]))).toEqual(['La versión 2 debe sustituir a la 1.']);
  });

  it('los eventos de auditoría se construyen puros (id y hora los pone quien llama)', () => {
    expect(crearEventoAuditoria({ entidad: 'observacion', accion: 'x' }, 'e1', '2026-11-22T00:00:00Z')).toEqual({
      id: 'e1', actorUserId: null, origen: 'app', entidad: 'observacion', entidadId: null, folio: null, accion: 'x', detalles: {}, creadoEn: '2026-11-22T00:00:00Z',
    });
  });
});
