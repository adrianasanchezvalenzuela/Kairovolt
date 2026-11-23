import { describe, expect, it } from 'vitest';
import type { Compuerta } from '../compuertas/compuerta';
import type { DocumentoExpediente } from '../documentos/documento';
import { catalogoParaZona, evaluarCarpetaFisica, evaluarChecklist, progresoGlobal, puedeSolicitarCompuerta, type Requisito } from './checklist';

const req = (id: string, tipo: Requisito['tipo'], compuerta: Requisito['compuerta'], obligatorio = true, canal: Requisito['canal'] = 'digital'): Requisito => ({
  id, tipo, nombre: id, compuerta, obligatorio, canal,
});
const doc = (tipo: DocumentoExpediente['tipo']): DocumentoExpediente => ({
  id: `doc-${tipo}`, tipo, nombre: tipo, fechaEmision: null, fechaVigencia: null, datos: [],
});
const gates = (estados: Compuerta['estado'][]): Compuerta[] =>
  (['G0', 'G1', 'G2', 'G3'] as const).map((id, i) => ({ id, estado: estados[i] ?? 'pendiente' }));

const catalogo = [
  req('a', 'solicitud', 'G0'),
  req('b', 'croquis', 'G0'),
  req('c', 'recibo_cfe', 'G0', false),
  req('d', 'diagrama_unifilar', 'G1'),
];

describe('evaluarChecklist', () => {
  it('detecta faltantes obligatorios y los opcionales no bloquean', () => {
    const [g0, g1] = evaluarChecklist(catalogo, [doc('solicitud')]);
    expect(g0?.faltantes.map((i) => i.requisito.id)).toEqual(['b']);
    expect(g0?.completa).toBe(false);
    expect(g0?.totalObligatorios).toBe(2);
    expect(g0?.recibidosObligatorios).toBe(1);
    expect(g1?.faltantes).toHaveLength(1);
  });

  it('compuerta completa cuando todos los obligatorios están', () => {
    const [g0] = evaluarChecklist(catalogo, [doc('solicitud'), doc('croquis')]);
    expect(g0?.completa).toBe(true);
  });

  it('devuelve siempre las cuatro compuertas en orden', () => {
    expect(evaluarChecklist([], []).map((r) => r.compuerta)).toEqual(['G0', 'G1', 'G2', 'G3']);
  });
});

describe('progresoGlobal', () => {
  it('suma obligatorios recibidos y totales', () => {
    const r = evaluarChecklist(catalogo, [doc('solicitud'), doc('diagrama_unifilar')]);
    expect(progresoGlobal(r)).toEqual({ recibidos: 2, total: 3 });
  });
});

describe('puedeSolicitarCompuerta', () => {
  const completo = evaluarChecklist(catalogo, [doc('solicitud'), doc('croquis'), doc('diagrama_unifilar')]);
  const incompleto = evaluarChecklist(catalogo, [doc('solicitud')]);

  it('G0 permitida con checklist completo', () => {
    expect(puedeSolicitarCompuerta('G0', gates([]), completo).permitido).toBe(true);
  });
  it('G0 bloqueada con faltantes', () => {
    const d = puedeSolicitarCompuerta('G0', gates([]), incompleto);
    expect(d.permitido).toBe(false);
    expect(d.motivos[0]).toMatch(/Faltan 1/);
  });
  it('G1 requiere G0 liberada', () => {
    expect(puedeSolicitarCompuerta('G1', gates([]), completo).motivos).toContain('G0 no está liberada');
    expect(puedeSolicitarCompuerta('G1', gates(['liberada']), completo).permitido).toBe(true);
  });
  it('G2 se bloquea con hallazgos bloqueantes abiertos', () => {
    const d = puedeSolicitarCompuerta('G2', gates(['liberada', 'liberada']), completo, 2);
    expect(d.permitido).toBe(false);
    expect(d.motivos).toContain('2 hallazgo(s) bloqueante(s) abierto(s)');
  });
  it('no se vuelve a solicitar una compuerta liberada', () => {
    expect(puedeSolicitarCompuerta('G0', gates(['liberada']), completo).permitido).toBe(false);
  });
});

describe('catalogoParaZona', () => {
  const base: Requisito[] = [
    { ...req('u', 'dictamen_uvie', 'G3'), reubicablePorZona: true },
    req('s', 'solicitud', 'G2'),
  ];
  it('mantiene UVIE en G3 por defecto', () => {
    expect(catalogoParaZona(base, { uvieAntesDeIngreso: false }).find((r) => r.id === 'u')?.compuerta).toBe('G3');
  });
  it('mueve UVIE a G2 si la zona lo exige antes del ingreso, sin tocar lo demás', () => {
    const c = catalogoParaZona(base, { uvieAntesDeIngreso: true });
    expect(c.find((r) => r.id === 'u')?.compuerta).toBe('G2');
    expect(c.find((r) => r.id === 's')?.compuerta).toBe('G2');
    expect(base[0]?.compuerta).toBe('G3');
  });
});

describe('evaluarCarpetaFisica', () => {
  it('cuenta solo requisitos de canal físico', () => {
    const cat = [req('a', 'solicitud', 'G2', true, 'fisico'), req('b', 'carta_poder', 'G1', true, 'fisico'), req('c', 'croquis', 'G1')];
    const f = evaluarCarpetaFisica(evaluarChecklist(cat, [doc('solicitud')]));
    expect(f).toMatchObject({ total: 2, listos: 1 });
    expect(f.pendientes.map((i) => i.requisito.id)).toEqual(['b']);
  });
});
