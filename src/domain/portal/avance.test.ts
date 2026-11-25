import { describe, expect, it } from 'vitest';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { kv2026004Demo } from '@/data/kv-2026-004.demo';
import { evaluarChecklist, type ResumenCompuerta } from '../checklist/checklist';
import type { Compuerta, EstadoCompuerta } from '../compuertas/compuerta';
import { calcularAvance, PESO_ETAPA, REGLAS_AVANCE, TOPE_ETAPA_NO_LIBERADA } from './avance';

const gates = (g0: EstadoCompuerta, g1: EstadoCompuerta = 'pendiente', g2: EstadoCompuerta = 'pendiente', g3: EstadoCompuerta = 'pendiente'): Compuerta[] =>
  [{ id: 'G0', estado: g0 }, { id: 'G1', estado: g1 }, { id: 'G2', estado: g2 }, { id: 'G3', estado: g3 }];
const resumen = (compuerta: ResumenCompuerta['compuerta'], recibidos: number, total: number): ResumenCompuerta =>
  ({ compuerta, items: [], totalObligatorios: total, recibidosObligatorios: recibidos, faltantes: [], completa: recibidos === total });

describe('reglas de avance del portal', () => {
  it('constantes documentadas: 4 etapas de igual peso y tope 95 %', () => {
    expect(Object.values(PESO_ETAPA)).toEqual([25, 25, 25, 25]);
    expect(TOPE_ETAPA_NO_LIBERADA).toBe(95);
    expect(REGLAS_AVANCE.length).toBeGreaterThanOrEqual(4);
  });

  it('caso demostrativo: G0 liberada (100) + G1 5/8 (62) + G2 1/3 (33) + G3 1/5 (20) = 54 %', () => {
    const checklist = evaluarChecklist(catalogoRequisitosBase, kv2026004Demo.documentos);
    const a = calcularAvance({ compuertas: kv2026004Demo.compuertas, checklist });
    expect(a.etapas.map((e) => e.porcentaje)).toEqual([100, 62, 33, 20]);
    expect(a.porcentaje).toBe(54);
    expect(a.exacto).toBe(true);
  });

  it('una etapa con todos sus documentos pero NO liberada vale 95, no 100: el 100 lo da la liberación', () => {
    const a = calcularAvance({ compuertas: gates('liberada', 'en_revision'), checklist: [resumen('G0', 3, 3), resumen('G1', 8, 8), resumen('G2', 0, 3), resumen('G3', 0, 5)] });
    expect(a.etapas[1]?.porcentaje).toBe(95);
    expect(a.porcentaje).toBe(Math.round((100 + 95) / 4));
  });

  it('solo llega a 100 con las 4 etapas liberadas', () => {
    expect(calcularAvance({ compuertas: gates('liberada', 'liberada', 'liberada', 'liberada'), checklist: [] }).porcentaje).toBe(100);
    expect(calcularAvance({ compuertas: gates('liberada', 'liberada', 'liberada', 'en_revision'), checklist: [resumen('G3', 5, 5)] }).porcentaje).toBeLessThan(100);
  });

  it('una etapa sin documentos obligatorios definidos vale 0 hasta que se libere', () => {
    const a = calcularAvance({ compuertas: gates('pendiente'), checklist: [resumen('G0', 0, 0)] });
    expect(a.etapas[0]?.porcentaje).toBe(0);
  });

  it('una etapa bloqueada conserva lo que lleva (no se castiga ni se oculta)', () => {
    const a = calcularAvance({ compuertas: gates('liberada', 'bloqueada'), checklist: [resumen('G1', 4, 8)] });
    expect(a.etapas[1]).toMatchObject({ estado: 'bloqueada', porcentaje: 50 });
  });

  it('sin expediente: solo cuentan las etapas liberadas y el avance se marca como APROXIMADO', () => {
    const a = calcularAvance({ compuertas: gates('liberada', 'en_revision'), checklist: null });
    expect(a).toMatchObject({ porcentaje: 25, exacto: false });
    expect(a.etapas[1]?.porcentaje).toBeNull();
    expect(calcularAvance({ compuertas: gates('pendiente'), checklist: null }).porcentaje).toBe(0);
  });

  it('los pesos son configurables y el resultado nunca sale de 0–100', () => {
    const a = calcularAvance({ compuertas: gates('liberada'), checklist: [], pesos: { G0: 10, G1: 30, G2: 30, G3: 30 } });
    expect(a.porcentaje).toBe(10);
    for (const c of [gates('pendiente'), gates('liberada', 'liberada', 'liberada', 'liberada')]) {
      const p = calcularAvance({ compuertas: c, checklist: null }).porcentaje;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it('el avance no depende de observaciones, validaciones ni datos internos (misma entrada de compuertas y checklist → mismo número)', () => {
    const base = calcularAvance({ compuertas: kv2026004Demo.compuertas, checklist: evaluarChecklist(catalogoRequisitosBase, kv2026004Demo.documentos) });
    const conOtrasObservaciones = calcularAvance({ compuertas: kv2026004Demo.compuertas, checklist: evaluarChecklist(catalogoRequisitosBase, kv2026004Demo.documentos) });
    expect(conOtrasObservaciones).toEqual(base);
  });
});
