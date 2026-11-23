import { describe, expect, it } from 'vitest';
import type { Requisito } from '../checklist/checklist';
import type { DocumentoExpediente } from '../documentos/documento';
import { detectarCamposIncompletos, detectarDiscrepancias } from './validacion-cruzada';
import { diasEntre } from '../fechas/fechas';
import { evaluarVigencias } from '../vigencias/vigencias';
import type { DatoDeclarado } from './campos';

const doc = (id: string, tipo: DocumentoExpediente['tipo'], datos: DatoDeclarado[] = [], f: Partial<DocumentoExpediente> = {}): DocumentoExpediente => ({
  id, tipo, nombre: id, fechaEmision: null, fechaVigencia: null, datos, ...f,
});

describe('detectarDiscrepancias', () => {
  it('detecta valores distintos sin elegir uno', () => {
    const h = detectarDiscrepancias([
      doc('a', 'ficha_tecnica', [{ campo: 'modelo_modulo', valor: 'CS6.2-66TB-615' }]),
      doc('b', 'memoria_calculo', [{ campo: 'modelo_modulo', valor: 'CS3.2-66TB-615' }]),
    ]);
    expect(h).toHaveLength(1);
    expect(h[0]?.severidad).toBe('bloqueante');
    expect(h[0]?.evidencias.map((e) => e.valor)).toEqual(['CS6.2-66TB-615', 'CS3.2-66TB-615']);
    expect(h[0]?.detalle).toMatch(/no determina/);
  });
  it('ignora diferencias de mayúsculas y espacios', () => {
    expect(detectarDiscrepancias([
      doc('a', 'solicitud', [{ campo: 'nivel_tension', valor: 'mt' }]),
      doc('b', 'diagrama_unifilar', [{ campo: 'nivel_tension', valor: ' MT ' }]),
    ])).toEqual([]);
  });
  it('compara numéricos con unidad en la evidencia', () => {
    const h = detectarDiscrepancias([
      doc('a', 'solicitud', [{ campo: 'consumo_kwh_mes', valor: 6921.31 }]),
      doc('b', 'recibo_cfe', [{ campo: 'consumo_kwh_mes', valor: 697.52 }]),
    ]);
    expect(h[0]?.evidencias.map((e) => e.valor)).toEqual(['6921.31 kWh/mes', '697.52 kWh/mes']);
  });
  it('un valor vacío no es discrepancia', () => {
    expect(detectarDiscrepancias([
      doc('a', 'solicitud', [{ campo: 'nivel_tension', valor: 'MT' }]),
      doc('b', 'solicitud', [{ campo: 'nivel_tension', valor: null }]),
    ])).toEqual([]);
  });
});

describe('detectarCamposIncompletos', () => {
  it('reporta campos vacíos por documento', () => {
    const h = detectarCamposIncompletos([
      doc('c', 'croquis', [{ campo: 'coordenadas_croquis', valor: null }, { campo: 'referencia_croquis', valor: '  ' }]),
      doc('ok', 'solicitud', [{ campo: 'nivel_tension', valor: 'MT' }]),
    ]);
    expect(h).toHaveLength(1);
    expect(h[0]?.id).toBe('incompleto:c');
  });
});

describe('evaluarVigencias', () => {
  const reqs: Requisito[] = [{ id: 'r', tipo: 'recibo_cfe', nombre: 'r', compuerta: 'G0', obligatorio: true, canal: 'digital', requiereVigencia: true }];
  const hoy = '2026-11-22';
  const ids = (d: DocumentoExpediente[]) => evaluarVigencias(reqs, d, hoy).map((h) => h.id);

  it('vencido es bloqueante', () => {
    const h = evaluarVigencias(reqs, [doc('r1', 'recibo_cfe', [], { fechaVigencia: '2026-11-01' })], hoy);
    expect(h[0]).toMatchObject({ id: 'vigencia:vencido:r1', severidad: 'bloqueante' });
  });
  it('por vencer dentro del umbral es advertencia', () => {
    expect(ids([doc('r1', 'recibo_cfe', [], { fechaVigencia: '2026-12-10' })])).toEqual(['vigencia:por-vencer:r1']);
  });
  it('vigente fuera del umbral no genera hallazgo', () => {
    expect(ids([doc('r1', 'recibo_cfe', [], { fechaVigencia: '2027-06-01' })])).toEqual([]);
  });
  it('sin fecha capturada advierte, no asume', () => {
    expect(ids([doc('r1', 'recibo_cfe')])).toEqual(['vigencia:sin-fecha:r1']);
  });
  it('detecta fechas incoherentes', () => {
    expect(ids([doc('r1', 'recibo_cfe', [], { fechaEmision: '2026-06-01', fechaVigencia: '2026-05-01' })])).toContain('vigencia:incoherente:r1');
  });
  it('no audita tipos que no requieren vigencia', () => {
    expect(ids([doc('x', 'croquis')])).toEqual([]);
  });
  it('diasEntre', () => {
    expect(diasEntre('2026-11-22', '2026-12-10')).toBe(18);
  });
});
