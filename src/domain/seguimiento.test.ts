import { describe, expect, it } from 'vitest';
import type { Actividad } from './cronograma/actividad';
import { evaluarActividad } from './cronograma/actividad';
import { calcularPpc } from './indicadores/ppc';
import { resumirObservaciones, seguimientoObservacion, type Observacion } from './observaciones/observacion';

const act = (id: string, inicioPlan: string, finPlan: string, finReal: string | null): Actividad => ({
  id, nombre: id, compuerta: 'G0', inicioPlan, finPlan, finReal, responsable: null,
});
const obs = (id: string, estado: Observacion['estado'], fechaCompromiso: string | null): Observacion => ({
  id, origen: 'interna', compuerta: 'G0', descripcion: id, estado, fechaRegistro: '2026-11-01', fechaCompromiso, responsable: null,
});
const hoy = '2026-11-22';

describe('observaciones', () => {
  it('clasifica el seguimiento', () => {
    expect(seguimientoObservacion(obs('a', 'cerrada', '2026-01-01'), hoy)).toBe('cerrada');
    expect(seguimientoObservacion(obs('b', 'abierta', null), hoy)).toBe('sin_compromiso');
    expect(seguimientoObservacion(obs('c', 'en_atencion', '2026-11-20'), hoy)).toBe('vencida');
    expect(seguimientoObservacion(obs('d', 'abierta', '2026-11-22'), hoy)).toBe('en_plazo');
  });
  it('resume abiertas, vencidas y sin compromiso', () => {
    const r = resumirObservaciones([obs('a', 'cerrada', null), obs('b', 'abierta', null), obs('c', 'abierta', '2026-11-01')], hoy);
    expect(r).toEqual({ abiertas: 2, vencidas: 1, sinCompromiso: 1 });
  });
});

describe('evaluarActividad', () => {
  it('completada a tiempo y con retraso', () => {
    expect(evaluarActividad(act('a', '2026-11-01', '2026-11-05', '2026-11-04'), hoy)).toMatchObject({ estado: 'completada', diasRetraso: 0 });
    expect(evaluarActividad(act('b', '2026-11-01', '2026-11-05', '2026-11-08'), hoy)).toMatchObject({ estado: 'completada', diasRetraso: 3 });
  });
  it('atrasada, en curso y pendiente', () => {
    expect(evaluarActividad(act('c', '2026-11-01', '2026-11-20', null), hoy)).toMatchObject({ estado: 'atrasada', diasRetraso: 2 });
    expect(evaluarActividad(act('d', '2026-11-20', '2026-11-25', null), hoy).estado).toBe('en_curso');
    expect(evaluarActividad(act('e', '2026-11-23', '2026-11-30', null), hoy).estado).toBe('pendiente');
  });
});

describe('calcularPpc', () => {
  const acts = [
    act('ok', '2026-11-01', '2026-11-05', '2026-11-05'),
    act('tarde', '2026-11-01', '2026-11-10', '2026-11-12'),
    act('abierta-vencida', '2026-11-01', '2026-11-15', null),
    act('futura', '2026-11-20', '2026-12-01', null),
  ];
  it('acumulado: cuenta solo lo planeado hasta hoy; terminar tarde no cumple', () => {
    expect(calcularPpc(acts, hoy)).toEqual({ planeadas: 3, cumplidas: 1, porcentaje: 33.3 });
  });
  it('acepta un periodo con desde', () => {
    expect(calcularPpc(acts, hoy, '2026-11-08')).toEqual({ planeadas: 2, cumplidas: 0, porcentaje: 0 });
  });
  it('sin actividades planeadas el porcentaje es null', () => {
    expect(calcularPpc([], hoy).porcentaje).toBeNull();
  });
});
