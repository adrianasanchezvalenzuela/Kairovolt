import { describe, expect, it } from 'vitest';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { kv2026004Demo } from '@/data/kv-2026-004.demo';
import { evaluarBloqueoCompuerta, type DecisionBloqueo } from '@/domain/compuertas/bloqueo';
import { estadosSiguientes, evaluarTransicionCompuerta, TRANSICIONES_COMPUERTA } from '@/domain/compuertas/transiciones';
import { ORDEN_COMPUERTAS, type EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { puede } from '@/domain/usuarios/permisos';
import { analizarProyecto, documentosVencidos } from './analizar-proyecto';
import { alertasOperativas, compuertaActual, resumirCartera } from './cartera';
import {
  aplicarDecisiones, aprobacionDe, asignarResponsable, decisionesVacias, ErrorDecision, reabrirSiReaparece, registrarCambioCompuerta, registrarObservacion, registrarResolucion,
  type ContextoDecision,
} from './decisiones';
import { historialProyecto } from './historial';
import { tareasDeCompuertas } from './integracion-admin';
import { aVistaProyecto } from './vista-proyectos';

const HOY = '2026-11-23';
let n = 0;
const ctx = (nombre = 'Ana (prueba)'): ContextoDecision => ({ folio: 'KV-2026-004', hoy: HOY, ahora: `${HOY}T10:00:00.000Z`, nuevoId: () => `id-${String(++n).padStart(8, '0')}`, actor: { uid: null, nombre } });
const analizar = (p = kv2026004Demo) => analizarProyecto(p, { hoy: HOY, requisitos: catalogoRequisitosBase });
const bloqueoVacio = (compuerta = 'G1' as const): DecisionBloqueo => ({ compuerta, bloqueada: false, razones: [] });

describe('transiciones de compuerta (dominio)', () => {
  it('solo existen los cambios previstos: liberada es definitiva y no se salta la revisión', () => {
    expect(TRANSICIONES_COMPUERTA.pendiente).not.toContain('liberada');
    expect(estadosSiguientes('liberada')).toEqual([]);
    expect(estadosSiguientes('en_revision')).toContain('liberada');
  });
  const base = { compuerta: 'G1' as const, bloqueo: bloqueoVacio(), actorPuedeLiberar: true };
  it('pendiente → liberada es inválido aunque no haya bloqueos', () => {
    const d = evaluarTransicionCompuerta({ ...base, de: 'pendiente', a: 'liberada' });
    expect(d).toMatchObject({ ok: false });
    expect(!d.ok && d.motivos[0]).toContain('en revisión');
  });
  it('desde liberada no se puede cambiar nada', () => {
    for (const a of ['pendiente', 'en_revision', 'bloqueada'] as EstadoCompuerta[]) expect(evaluarTransicionCompuerta({ ...base, de: 'liberada', a }).ok).toBe(false);
  });
  it('avanzar exige que no haya bloqueos y devuelve TODOS los motivos', () => {
    const bloqueo: DecisionBloqueo = { compuerta: 'G1', bloqueada: true, razones: [{ tipo: 'documentos_faltantes', mensaje: 'Faltan 3 documentos', referencias: [] }, { tipo: 'compuerta_previa', mensaje: 'G0 no está liberada', referencias: ['G0'] }] };
    const d = evaluarTransicionCompuerta({ ...base, bloqueo, de: 'en_revision', a: 'liberada' });
    expect(d).toEqual({ ok: false, motivos: ['Faltan 3 documentos', 'G0 no está liberada'] });
  });
  it('liberar exige permiso; sin bloqueos y con permiso procede', () => {
    expect(evaluarTransicionCompuerta({ ...base, de: 'en_revision', a: 'liberada', actorPuedeLiberar: false })).toEqual({ ok: false, motivos: ['Tu rol no puede liberar compuertas.'] });
    expect(evaluarTransicionCompuerta({ ...base, de: 'en_revision', a: 'liberada' })).toEqual({ ok: true });
  });
  it('bloquear exige motivo, pero no depende de los bloqueos existentes', () => {
    const conRazones: DecisionBloqueo = { compuerta: 'G1', bloqueada: true, razones: [{ tipo: 'documentos_faltantes', mensaje: 'x', referencias: [] }] };
    expect(evaluarTransicionCompuerta({ ...base, bloqueo: conRazones, de: 'en_revision', a: 'bloqueada', motivo: '' }).ok).toBe(false);
    expect(evaluarTransicionCompuerta({ ...base, bloqueo: conRazones, de: 'en_revision', a: 'bloqueada', motivo: 'Falta carta poder' }).ok).toBe(true);
  });
  it('el mismo estado no es un cambio', () => {
    expect(evaluarTransicionCompuerta({ ...base, de: 'pendiente', a: 'pendiente' }).ok).toBe(false);
  });
});

describe('caso demostrativo KV-2026-004', () => {
  const a = analizar();
  it('es un caso de prueba marcado como tal y sin archivos inventados', () => {
    expect(kv2026004Demo.esMock).toBe(true);
    expect(kv2026004Demo.documentos.every((d) => !d.archivo)).toBe(true);
    expect(kv2026004Demo.aprobaciones?.[0]?.aprobadoPor).toContain('demostrativo');
  });
  it('el motor encuentra las 5 validaciones bloqueantes del caso y ninguna tiene excepción', () => {
    expect(a.disponible).toBe(true);
    expect(a.pendientes.map((p) => p.reglaId).sort()).toEqual(['CRU-001', 'CRU-002', 'CRU-011', 'OBL-001', 'VIG-001']);
    expect(a.excepciones.size).toBe(0);
    expect([...documentosVencidos(a)]).toEqual(['d4']);
  });
  it('Stage-Gate: G0 liberada (con quién aprobó); G1 no puede liberarse (faltan documentos); G2 no puede ni solicitarse', () => {
    expect(compuertaActual(kv2026004Demo)).toBe('G1');
    expect(aprobacionDe(kv2026004Demo, 'G0')).toMatchObject({ compuerta: 'G0', fecha: '2026-11-06' });
    expect(aprobacionDe(kv2026004Demo, 'G1')).toBeNull();
    const liberarG1 = evaluarTransicionCompuerta({ compuerta: 'G1', de: 'en_revision', a: 'liberada', bloqueo: a.bloqueos.G1, actorPuedeLiberar: true });
    expect(liberarG1.ok).toBe(false);
    expect(!liberarG1.ok && liberarG1.motivos.join(' ')).toContain('documento(s) obligatorio(s) de G1');
    const solicitarG2 = evaluarTransicionCompuerta({ compuerta: 'G2', de: 'pendiente', a: 'en_revision', bloqueo: a.bloqueos.G2, actorPuedeLiberar: true });
    expect(solicitarG2.ok).toBe(false);
    const motivos = !solicitarG2.ok ? solicitarG2.motivos.join(' | ') : '';
    expect(motivos).toContain('G1 no está liberada');
    expect(motivos).toContain('bloqueante');
  });
  it('los tiempos muestran la espera entre obra terminada e ingreso a CFE como «en curso»', () => {
    const t = a.tiempos!.entreHitos.find((x) => x.id === 'obra_a_ingreso')!;
    expect(t).toMatchObject({ desde: '2026-11-12', hasta: null, dias: 11, enCurso: true, inconsistente: false });
  });
  it('alertas operativas: bloqueantes primero; incluyen vencidas, sin compromiso y atrasadas', () => {
    const al = alertasOperativas([{ proyecto: kv2026004Demo, analisis: a }]);
    expect(al.slice(0, 5).every((x) => x.severidad === 'bloqueante')).toBe(true);
    expect(al.map((x) => x.tipo)).toEqual(expect.arrayContaining(['validacion_bloqueante', 'observacion_vencida', 'observacion_sin_compromiso', 'actividad_atrasada']));
    expect(al[0]!.to).toContain('tab=validaciones&huella=');
  });
  it('el resumen de cartera y la vista de proyecto salen del análisis', () => {
    const item = { proyecto: kv2026004Demo, analisis: a };
    expect(resumirCartera([item], HOY)).toMatchObject({ proyectos: 1, conBloqueantes: 1, bloqueantesTotales: 5, sinExpediente: 0 });
    expect(aVistaProyecto(item)).toMatchObject({ folio: 'KV-2026-004', etapa: 'G1', bloqueantes: 5, demo: true });
  });
  it('un proyecto sin expediente no inventa validaciones: «no evaluable»', () => {
    const sin = { ...kv2026004Demo, documentosDisponibles: false, documentos: [] };
    const an = analizar(sin);
    expect(an.disponible).toBe(false);
    expect(an.resultados).toEqual([]);
    expect(aVistaProyecto({ proyecto: sin, analisis: an })).toMatchObject({ avance: null, bloqueantes: null });
  });
  it('tareasDeCompuertas arma una tarea por compuerta con sus fechas y dependencia', () => {
    const t = tareasDeCompuertas(kv2026004Demo);
    expect(t.map((x) => x.clave)).toEqual(ORDEN_COMPUERTAS);
    expect(t[1]).toMatchObject({ clave: 'G1', inicioPlan: '2026-11-04', finPlan: '2026-11-18', predecesora: 'G0' });
  });
});

describe('decisiones humanas', () => {
  const resultadoBloqueante = (an = analizar()) => an.resultados.find((r) => r.reglaId === 'CRU-001')!;

  it('registrar una observación desde una validación es idempotente (no duplica) y deja auditoría', () => {
    const an = analizar();
    const r = resultadoBloqueante(an);
    const uno = registrarObservacion(decisionesVacias(), kv2026004Demo.observaciones, r, ctx());
    expect(uno.creada).toBe(true);
    expect(uno.observacion).toMatchObject({ origen: 'interna', estado: 'abierta', origenValidacion: { reglaId: 'CRU-001', huella: r.huella }, severidad: 'bloqueante' });
    expect(uno.decisiones.eventos).toHaveLength(1);
    const dos = registrarObservacion(uno.decisiones, [...kv2026004Demo.observaciones, uno.observacion], r, ctx());
    expect(dos.creada).toBe(false);
    expect(dos.decisiones.observaciones).toHaveLength(1);
  });
  it('no se registra observación de algo que cumple', () => {
    const cumple = analizar().resultados.find((r) => r.resultado === 'cumple')!;
    expect(() => registrarObservacion(decisionesVacias(), [], cumple, ctx())).toThrow(ErrorDecision);
  });
  it('asignar responsable valida datos, pone la observación en atención y audita quién', () => {
    const o = kv2026004Demo.observaciones[1]!; // abierta, sin responsable
    expect(() => asignarResponsable(decisionesVacias(), o, '  ', null, ctx())).toThrow(/responsable/);
    expect(() => asignarResponsable(decisionesVacias(), o, 'Proyectista', '23/11/2026', ctx())).toThrow(/fecha/);
    const d = asignarResponsable(decisionesVacias(), o, ' Proyectista ', '2026-11-27', ctx('Luis (prueba)'));
    const efectivas = aplicarDecisiones(kv2026004Demo, d).observaciones;
    expect(efectivas.find((x) => x.id === o.id)).toMatchObject({ responsable: 'Proyectista', fechaCompromiso: '2026-11-27', estado: 'en_atencion' });
    expect(d.eventos[0]).toMatchObject({ accion: 'responsable_asignado', detalles: { actor: 'Luis (prueba)', responsable: 'Proyectista' } });
    expect(kv2026004Demo.observaciones[1]!.responsable).toBeNull(); // el original no se muta
  });
  it('resolver una discrepancia como excepción exige rol autorizado y justificación; con ambos, el bloqueante deja de bloquear SOLO para ese valor', () => {
    const an = analizar();
    const r = resultadoBloqueante(an);
    const { decisiones, observacion } = registrarObservacion(decisionesVacias(), [], r, ctx());
    const res = { tipo: 'aceptado_con_justificacion' as const, justificacion: 'Se confirma MT con el cliente por teléfono', responsable: 'Ana', fecha: HOY };
    expect(() => registrarResolucion(decisiones, observacion, res, { validacionActual: r, actorPuedeAprobar: false }, ctx())).toThrow(/rol autorizado/);
    expect(() => registrarResolucion(decisiones, observacion, { ...res, justificacion: 'ok' }, { validacionActual: r, actorPuedeAprobar: true }, ctx())).toThrow(/justificación/);
    const d2 = registrarResolucion(decisiones, observacion, res, { validacionActual: r, actorPuedeAprobar: true }, ctx());
    const efectivo = aplicarDecisiones(kv2026004Demo, d2);
    const an2 = analizar(efectivo);
    expect(an2.excepciones.has(r.huella)).toBe(true);
    expect(an2.pendientes).toHaveLength(4);
    expect(d2.eventos.at(-1)).toMatchObject({ accion: 'excepcion_aprobada' });
  });
  it('«corregido» no procede si la validación sigue fallando (no se puede cerrar sin corregir el dato)', () => {
    const an = analizar();
    const r = resultadoBloqueante(an);
    const { decisiones, observacion } = registrarObservacion(decisionesVacias(), [], r, ctx());
    expect(() => registrarResolucion(decisiones, observacion, { tipo: 'corregido', justificacion: 'Ya se corrigió el documento', responsable: 'Ana', fecha: HOY }, { validacionActual: r, actorPuedeAprobar: true }, ctx())).toThrow(/sigue sin cumplirse/);
  });
  it('si el valor aprobado como excepción cambia, la observación se reabre sola y queda registrado', () => {
    const an = analizar();
    const r = resultadoBloqueante(an);
    const { decisiones, observacion } = registrarObservacion(decisionesVacias(), [], r, ctx());
    const d2 = registrarResolucion(decisiones, observacion, { tipo: 'aceptado_con_justificacion', justificacion: 'Excepción aprobada para este valor', responsable: 'Ana', fecha: HOY }, { validacionActual: r, actorPuedeAprobar: true }, ctx());
    const cambiado = { ...r, valorEncontrado: 'MT / BT / XX' };
    const efectivas = aplicarDecisiones(kv2026004Demo, d2).observaciones;
    const d3 = reabrirSiReaparece(d2, efectivas, [cambiado], ctx());
    expect(d3).not.toBe(d2);
    expect(aplicarDecisiones(kv2026004Demo, d3).observaciones.find((o) => o.id === observacion.id)).toMatchObject({ estado: 'abierta', resolucion: null });
    expect(d3.eventos.at(-1)?.accion).toBe('observacion_reabierta');
    expect(reabrirSiReaparece(d2, efectivas, [r], ctx())).toBe(d2); // mismo valor: sin cambios
  });
  it('cambio de compuerta: registra quién la liberó y cuándo, y el historial lo muestra', () => {
    const d = registrarCambioCompuerta(decisionesVacias(), { compuerta: 'G1', de: 'en_revision', a: 'liberada', comentario: 'Documentos completos' }, ctx('Marta (prueba)'));
    const p = aplicarDecisiones(kv2026004Demo, d);
    expect(p.compuertas.find((c) => c.id === 'G1')?.estado).toBe('liberada');
    expect(aprobacionDe(p, 'G1')).toMatchObject({ aprobadoPor: 'Marta (prueba)', fecha: HOY, comentario: 'Documentos completos' });
    const h = historialProyecto(p, d);
    expect(h[0]).toMatchObject({ titulo: 'Compuerta liberada', actor: 'Marta (prueba)' });
    expect(h.some((e) => e.titulo === 'G0 liberada')).toBe(true); // la aprobación que trae la fuente
  });
  it('el historial no repite lo registrado en KairóVolt y ordena de lo más reciente a lo más antiguo', () => {
    const r = resultadoBloqueante();
    const { decisiones } = registrarObservacion(decisionesVacias(), [], r, ctx());
    const p = aplicarDecisiones(kv2026004Demo, decisiones);
    const h = historialProyecto(p, decisiones);
    expect(h.filter((e) => e.titulo === 'Observación registrada')).toHaveLength(1); // la de KairóVolt, una sola vez
    expect(h.filter((e) => e.titulo.startsWith('Observación registrada ('))).toHaveLength(kv2026004Demo.observaciones.length); // solo las de la fuente
    const fechas = h.map((e) => e.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });
});

describe('permisos nuevos', () => {
  it('liberar compuertas: solo administración; decisiones sobre validaciones: también proyectista; consulta nada', () => {
    expect(puede('admin', 'liberar_compuertas')).toBe(true);
    expect(puede('coordinacion_admin', 'liberar_compuertas')).toBe(true);
    expect(puede('proyectista', 'liberar_compuertas')).toBe(false);
    expect(puede('proyectista', 'gestionar_validaciones')).toBe(true);
    expect(puede('proyectista', 'aprobar_excepciones')).toBe(false);
    expect(puede('consulta', 'gestionar_validaciones')).toBe(false);
    expect(puede(null, 'gestionar_validaciones')).toBe(false);
  });
});

describe('bloqueo de compuerta con el expediente demo', () => {
  it('coincide con evaluarBloqueoCompuerta del dominio (el análisis solo lo compone)', () => {
    const a = analizar();
    const directo = evaluarBloqueoCompuerta({ compuerta: 'G2', compuertas: kv2026004Demo.compuertas, resumenes: a.checklist, validacionesBloqueantes: a.pendientes, observaciones: kv2026004Demo.observaciones });
    expect(a.bloqueos.G2).toEqual(directo);
  });
});
