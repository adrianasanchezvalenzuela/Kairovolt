import { describe, expect, it } from 'vitest';
import type { AccionAcordada } from '../acciones/accion';
import { calcularPaer, cumpleMetaPaer, paerPorSemana } from './paer';

const acc = (id: string, semana: string, estado: AccionAcordada['estado']): AccionAcordada => ({
  id, semana, descripcion: id, responsable: null, estado,
});

const acciones = [
  acc('a', '2026-11-09', 'completada'),
  acc('b', '2026-11-09', 'completada'),
  acc('c', '2026-11-16', 'completada'),
  acc('d', '2026-11-16', 'no_realizada'),
  acc('e', '2026-11-16', 'pendiente'),
  acc('f', '2026-11-16', 'completada'),
];

describe('calcularPaer', () => {
  it('completadas / total de la semana', () => {
    expect(calcularPaer(acciones, '2026-11-16')).toEqual({ total: 4, completadas: 2, porcentaje: 50 });
  });
  it('100 % cuando todas se completan', () => {
    expect(calcularPaer(acciones, '2026-11-09').porcentaje).toBe(100);
  });
  it('sin acciones devuelve null, no 0 %', () => {
    expect(calcularPaer(acciones, '2026-12-01')).toEqual({ total: 0, completadas: 0, porcentaje: null });
    expect(calcularPaer([]).porcentaje).toBeNull();
  });
  it('sin semana es acumulado', () => {
    expect(calcularPaer(acciones)).toEqual({ total: 6, completadas: 4, porcentaje: 66.7 });
  });
});

describe('paerPorSemana', () => {
  it('ordena cronológicamente', () => {
    expect(paerPorSemana([...acciones].reverse()).map((s) => s.semana)).toEqual(['2026-11-09', '2026-11-16']);
  });
});

describe('cumpleMetaPaer', () => {
  it('la meta es estrictamente mayor a 90 %', () => {
    expect(cumpleMetaPaer({ total: 10, completadas: 9, porcentaje: 90 })).toBe(false);
    expect(cumpleMetaPaer({ total: 20, completadas: 19, porcentaje: 95 })).toBe(true);
    expect(cumpleMetaPaer({ total: 0, completadas: 0, porcentaje: null })).toBeNull();
  });
});
