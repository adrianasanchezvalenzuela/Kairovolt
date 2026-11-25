import { describe, expect, it } from 'vitest';
import { configuracionVacia } from '../entidades/configuracion-tecnica';
import { bloqueantes, ejecutarReglas, fallos, resumirValidacion } from './motor';
import { CATALOGO_REGLAS } from './configuracion';
import { congelar, configuracion40kw, contexto40kw, doc, HOY } from './expediente-40kw.fixture';
import type { ResultadoValidacion } from './tipos';

const por = (rs: readonly ResultadoValidacion[], id: string, campo?: string) => rs.filter((r) => r.reglaId === id && (!campo || r.campo === campo));
const uno = (rs: readonly ResultadoValidacion[], id: string) => {
  const r = por(rs, id);
  expect(r, `regla ${id}`).toHaveLength(1);
  return r[0]!;
};

describe('forma del resultado', () => {
  const rs = ejecutarReglas(contexto40kw());

  it('cada validación devuelve los 10 datos pedidos', () => {
    expect(rs.length).toBeGreaterThan(20);
    for (const r of rs) {
      expect(Object.keys(r).sort()).toEqual(
        ['accionRecomendada', 'campo', 'categoria', 'compuerta', 'documentosOrigen', 'explicacion', 'huella', 'parametrosSupuestos', 'reglaId', 'reglaNombre',
          'requiereAprobacionHumana', 'resultado', 'severidad', 'valorEncontrado', 'valorEsperado'].sort(),
      );
      expect(r.explicacion.length).toBeGreaterThan(5);
      expect(r.accionRecomendada.length).toBeGreaterThan(0);
      expect(['cumple', 'no_cumple', 'no_evaluable']).toContain(r.resultado);
      expect(['bloqueante', 'mayor', 'menor', 'informativa']).toContain(r.severidad);
    }
  });

  it('solo los fallos llevan severidad y exigen aprobación humana; el resto es informativo', () => {
    for (const r of rs.filter((x) => x.resultado !== 'no_cumple')) {
      expect(r.severidad).toBe('informativa');
      expect(r.requiereAprobacionHumana).toBe(false);
    }
  });

  it('las huellas son únicas y estables entre ejecuciones', () => {
    const huellas = rs.map((r) => r.huella);
    expect(new Set(huellas).size).toBe(huellas.length);
    expect(ejecutarReglas(contexto40kw()).map((r) => r.huella)).toEqual(huellas);
  });

  it('los fallos más graves van primero', () => {
    expect(rs[0]?.resultado).toBe('no_cumple');
    expect(rs[0]?.severidad).toBe('bloqueante');
    const iFallo = rs.findIndex((r) => r.resultado !== 'no_cumple');
    expect(rs.slice(0, iFallo).every((r) => r.resultado === 'no_cumple')).toBe(true);
  });

  it('el catálogo tiene los 11 cruzados, 9 técnicos, 3 obligatorios y 4 de vigencia, con ids únicos', () => {
    expect(CATALOGO_REGLAS.filter((r) => r.categoria === 'cruzada')).toHaveLength(11);
    expect(CATALOGO_REGLAS.filter((r) => r.categoria === 'tecnica')).toHaveLength(9);
    expect(CATALOGO_REGLAS.filter((r) => r.categoria === 'obligatorio')).toHaveLength(3);
    expect(CATALOGO_REGLAS.filter((r) => r.categoria === 'vigencia')).toHaveLength(4);
    expect(new Set(CATALOGO_REGLAS.map((r) => r.id)).size).toBe(CATALOGO_REGLAS.length);
  });
});

describe('expediente de 40 kW: discrepancias entre documentos', () => {
  const rs = ejecutarReglas(contexto40kw());

  it('CRU-001: MT vs BT → no cumple, bloqueante, exige decisión humana, y NO elige cuál es la correcta', () => {
    const r = uno(rs, 'CRU-001');
    expect(r).toMatchObject({ resultado: 'no_cumple', severidad: 'bloqueante', requiereAprobacionHumana: true, campo: 'nivel_tension' });
    expect(r.valorEncontrado).toBe('MT / BT');
    expect(r.valorEsperado).toBeNull(); // sin referencia: no se decide
    expect(r.explicacion).toMatch(/no determina cuál versión es la correcta/);
    expect(r.documentosOrigen.map((d) => d.valor)).toEqual(['MT', 'BT', 'MT']);
  });

  it('CRU-002: CS6.2-66TB-615 vs CS3.2-66TB-615 → no cumple', () => {
    const r = uno(rs, 'CRU-002');
    expect(r.resultado).toBe('no_cumple');
    expect(r.valorEncontrado).toBe('CS6.2-66TB-615 / CS3.2-66TB-615');
    expect(r.documentosOrigen).toHaveLength(3);
  });

  it('CRU-011: 6,921.31 vs 697.52 kWh/mes → no cumple y avisa que difieren casi ×10', () => {
    const r = uno(rs, 'CRU-011');
    expect(r.resultado).toBe('no_cumple');
    expect(r.explicacion).toMatch(/×10/);
    expect(r.explicacion).toMatch(/punto decimal/);
    expect(r.valorEncontrado).toBe('6921.31 / 697.52 kWh/mes');
  });

  it('los campos que nadie (o una sola fuente) declara quedan «no evaluables», sin inventar nada', () => {
    for (const id of ['CRU-003', 'CRU-004', 'CRU-005', 'CRU-006', 'CRU-007', 'CRU-008', 'CRU-009', 'CRU-010']) {
      expect(uno(rs, id).resultado, id).toBe('no_evaluable');
    }
  });
});

describe('expediente de 40 kW: coherencia técnica', () => {
  const rs = ejecutarReglas(contexto40kw());

  it('TEC-001: 74 × 615 W ÷ 1000 = 45.51 kWp → cumple', () => {
    const r = uno(rs, 'TEC-001');
    expect(r).toMatchObject({ resultado: 'cumple', valorEncontrado: 45.51, valorEsperado: 45.51 });
  });

  it('TEC-002: 4 × 10 kW = 40 kW → cumple', () => {
    expect(uno(rs, 'TEC-002')).toMatchObject({ resultado: 'cumple', valorEncontrado: 40, valorEsperado: 40 });
  });

  it('TEC-003: relación DC/AC 45.51/40 = 1.138 dentro del rango de referencia (supuesto)', () => {
    const r = uno(rs, 'TEC-003');
    expect(r).toMatchObject({ resultado: 'cumple', valorEncontrado: 1.138, parametrosSupuestos: true });
  });

  it('TEC-009: los 3 documentos que declaran tensión usan valores válidos (MT, BT), aunque se contradigan entre sí', () => {
    const r = por(rs, 'TEC-009');
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.resultado === 'cumple')).toBe(true);
  });

  it('sin strings, fichas, RPU, coordenadas ni generación: «no evaluable»; TEC-006 deja la referencia física sin decidir nada', () => {
    for (const id of ['TEC-004', 'TEC-005', 'TEC-007', 'TEC-008']) expect(uno(rs, id).resultado, id).toBe('no_evaluable');
    const t6 = uno(rs, 'TEC-006');
    expect(t6.resultado).toBe('no_evaluable');
    expect(t6.valorEsperado).toBe(6553.44); // 45.51 kWp × 6 HSP × 0.8 × 30 días (parámetros supuestos)
  });
});

describe('expediente de 40 kW: campos obligatorios y vigencias', () => {
  const rs = ejecutarReglas(contexto40kw());

  it('OBL-001: el croquis con campos vacíos no cumple', () => {
    const r = por(rs, 'OBL-001').find((x) => x.resultado === 'no_cumple')!;
    expect(r.documentosOrigen[0]?.id).toBe('d3');
    expect(r.explicacion).toMatch(/Campos vacíos: Coordenadas del croquis; Referencia de ubicación del croquis/);
  });

  it('OBL-003: lista los datos técnicos que faltan (modelo de panel e inversor, tensión, RPU, coordenadas)', () => {
    const r = uno(rs, 'OBL-003');
    expect(r.resultado).toBe('no_cumple');
    expect(r.valorEncontrado).toBe('nivelTension, modeloPanel, modeloInversor, rpu, coordenadas');
  });

  it('OBL-002: faltan documentos obligatorios del catálogo, cada uno ligado a su compuerta', () => {
    const faltan = por(rs, 'OBL-002').filter((x) => x.resultado === 'no_cumple');
    expect(faltan.length).toBeGreaterThan(5);
    expect(faltan.map((x) => x.valorEsperado)).toContain('Consulta/registro de capacidad del circuito MT (Plataforma GD de CFE)');
    expect(faltan.every((x) => x.compuerta !== null && x.severidad === 'mayor')).toBe(true);
  });

  it('VIG-001: el recibo CFE venció el 2026-10-31 (hace 22 días) → bloqueante', () => {
    const r = por(rs, 'VIG-001').find((x) => x.resultado === 'no_cumple')!;
    expect(r).toMatchObject({ severidad: 'bloqueante', valorEncontrado: '2026-10-31' });
    expect(r.documentosOrigen[0]?.id).toBe('d4'); // d4 = recibo CFE en el expediente de referencia
    expect(r.explicacion).toBe('Venció el 2026-10-31 (hace 22 día(s)).');
  });

  it('VIG-002: los certificados vencen el 2026-12-10 (en 18 días) → por vencer, severidad menor', () => {
    const r = uno(rs, 'VIG-002');
    expect(r).toMatchObject({ resultado: 'no_cumple', severidad: 'menor', valorEncontrado: '2026-12-10' });
    expect(r.explicacion).toContain('Vence el 2026-12-10 (en 18 día(s)).');
    expect(r.parametrosSupuestos).toBe(true); // el umbral de 30 días es un supuesto, no una regla de CFE
  });

  it('la severidad de «por vencer» sube a «mayor» cuando quedan pocos días', () => {
    const rs2 = ejecutarReglas(contexto40kw({ hoy: '2026-12-05' }));
    expect(uno(rs2, 'VIG-002').severidad).toBe('mayor');
  });

  it('resumen del expediente de 40 kW', () => {
    const res = resumirValidacion(rs);
    expect(res.porSeveridad.bloqueante).toBe(bloqueantes(rs).length);
    expect(bloqueantes(rs).map((r) => r.reglaId).sort()).toEqual(['CRU-001', 'CRU-002', 'CRU-011', 'OBL-001', 'VIG-001']);
    expect(res.requierenAprobacionHumana).toBe(3); // los tres cruzados
    expect(res.total).toBe(res.cumplen + res.noCumplen + res.noEvaluables);
  });
});

describe('NUNCA se corrige información técnica', () => {
  it('las entradas congeladas no se tocan, y el resultado es idéntico al de entradas sin congelar', () => {
    const libre = ejecutarReglas(contexto40kw());
    const ctx = congelar(contexto40kw());
    const antes = JSON.stringify(ctx);
    const congelado = ejecutarReglas(ctx); // si una regla intentara escribir, lanzaría en modo estricto
    expect(JSON.stringify(ctx)).toBe(antes);
    expect(congelado).toEqual(libre);
  });

  it('con valores contradictorios nunca se propone uno como esperado (salvo el de la configuración técnica si existe)', () => {
    const rs = ejecutarReglas({ hoy: HOY, documentos: [doc('a', 'solicitud', [{ campo: 'nivel_tension', valor: 'MT' }]), doc('b', 'diagrama_unifilar', [{ campo: 'nivel_tension', valor: 'BT' }])] });
    expect(uno(rs, 'CRU-001').valorEsperado).toBeNull();
  });
});

describe('casos ampliados (datos ILUSTRATIVOS para ejercitar las reglas)', () => {
  const ampliado = (cfg: Partial<ReturnType<typeof configuracion40kw>>, docs = [] as ReturnType<typeof doc>[]) =>
    ejecutarReglas({ hoy: HOY, documentos: docs, configuracion: { ...configuracion40kw(), ...cfg } });

  it('CRU-009 y TEC-006: la generación 6,921.31 pasa la referencia física y 697.52 no (con pista de ×10)', () => {
    const rs = ampliado({}, [doc('a', 'solicitud', [{ campo: 'generacion_kwh_mes', valor: 6921.31 }]), doc('b', 'recibo_cfe', [{ campo: 'generacion_kwh_mes', valor: '697.52' }])]);
    expect(uno(rs, 'CRU-009').resultado).toBe('no_cumple');
    const t6 = por(rs, 'TEC-006');
    expect(t6.find((r) => r.documentosOrigen[0]?.id === 'a')?.resultado).toBe('cumple');
    const mala = t6.find((r) => r.documentosOrigen[0]?.id === 'b')!;
    expect(mala).toMatchObject({ resultado: 'no_cumple', severidad: 'mayor', requiereAprobacionHumana: true, valorEsperado: 6553.44 });
    expect(mala.explicacion).toMatch(/×10/);
  });

  it('TEC-001: una potencia DC declarada de 46.0 kWp no coincide con 45.51 calculados', () => {
    const rs = ampliado({ potenciaDcKwpDeclarada: null }, [doc('x', 'solicitud', [{ campo: 'potencia_dc_kwp', valor: 46 }])]);
    const r = por(rs, 'TEC-001')[0]!;
    expect(r).toMatchObject({ resultado: 'no_cumple', valorEncontrado: 46, valorEsperado: 45.51, severidad: 'bloqueante' });
  });

  it('TEC-004: 6 strings de 9 y 2 de 10 suman 74 (cumple); 8 de 9 suman 72 (no cumple)', () => {
    const bien = ampliado({ strings: [{ mppt: 1, strings: 6, panelesPorString: 9 }, { mppt: 2, strings: 2, panelesPorString: 10 }] });
    expect(uno(bien, 'TEC-004')).toMatchObject({ resultado: 'cumple', valorEncontrado: 74 });
    const mal = ampliado({ strings: [{ mppt: 1, strings: 8, panelesPorString: 9 }] });
    expect(uno(mal, 'TEC-004')).toMatchObject({ resultado: 'no_cumple', valorEncontrado: 72, valorEsperado: 74 });
  });

  it('TEC-005: con las fichas, 10 paneles × 50 V × 1.0625 (frío) = 531.3 V superan los 500 V del inversor; con 9 paneles (478.1 V) pasan', () => {
    const base = { fichaInversor: { vdcMaxV: 500 }, fichaPanel: { vocV: 50, coefTempVocPorCiento: -0.25 } };
    const largo = ampliado({ ...base, strings: [{ mppt: 1, strings: 1, panelesPorString: 10 }] });
    expect(uno(largo, 'TEC-005')).toMatchObject({ resultado: 'no_cumple', valorEncontrado: 531.3, severidad: 'bloqueante', requiereAprobacionHumana: true });
    const corto = ampliado({ ...base, strings: [{ mppt: 1, strings: 1, panelesPorString: 9 }] });
    expect(uno(corto, 'TEC-005').resultado).toBe('cumple');
  });

  it('TEC-007: el RPU con formato inválido no cumple; el de 12 caracteres sí', () => {
    expect(uno(ampliado({ rpu: 'ABC' }), 'TEC-007').resultado).toBe('no_cumple');
    expect(uno(ampliado({ rpu: '123456789012' }), 'TEC-007').resultado).toBe('cumple');
  });

  it('TEC-008 y CRU-008: coordenadas de Hermosillo dentro de Sonora; CDMX fuera; dos puntos a más de 100 m discrepan', () => {
    const hermosillo = { lat: 29.0729, lon: -110.9559 };
    expect(uno(ampliado({ coordenadas: hermosillo }), 'TEC-008').resultado).toBe('cumple');
    expect(uno(ampliado({ coordenadas: { lat: 19.4326, lon: -99.1332 } }), 'TEC-008').resultado).toBe('no_cumple');
    const cerca = ampliado({ coordenadas: hermosillo }, [doc('c', 'croquis', [{ campo: 'ubicacion', valor: '29.07295,-110.95595' }])]);
    expect(uno(cerca, 'CRU-008').resultado).toBe('cumple');
    const lejos = ampliado({ coordenadas: hermosillo }, [doc('c', 'croquis', [{ campo: 'ubicacion', valor: '29.0800,-110.9559' }])]);
    expect(uno(lejos, 'CRU-008').resultado).toBe('no_cumple');
  });

  it('con la configuración técnica como referencia, el valorEsperado es el de la configuración (sin decidir cuál documento está bien)', () => {
    const rs = ampliado({ nivelTension: 'MT' }, [doc('a', 'solicitud', [{ campo: 'nivel_tension', valor: 'BT' }])]);
    const r = uno(rs, 'CRU-001');
    expect(r).toMatchObject({ resultado: 'no_cumple', valorEsperado: 'MT' });
    expect(r.explicacion).toMatch(/no determina/);
  });

  it('sin configuración técnica, OBL-003 falla y las técnicas quedan «no evaluables»', () => {
    const rs = ejecutarReglas({ hoy: HOY, documentos: [], configuracion: null });
    expect(uno(rs, 'OBL-003').resultado).toBe('no_cumple');
    for (const id of ['TEC-001', 'TEC-002', 'TEC-003', 'TEC-004', 'TEC-005', 'TEC-006']) expect(uno(rs, id).resultado, id).toBe('no_evaluable');
  });

  it('los datos de una configuración vacía nunca se completan solos', () => {
    const c = configuracionVacia();
    expect(Object.values(c).every((v) => v === null)).toBe(true);
  });
});

describe('las reglas son configurables (sin tocar código)', () => {
  it('se puede cambiar la severidad de una regla', () => {
    const rs = ejecutarReglas(contexto40kw(), { overrides: { 'CRU-001': { severidad: 'mayor' } } });
    expect(uno(rs, 'CRU-001').severidad).toBe('mayor');
  });

  it('se puede desactivar una regla', () => {
    const rs = ejecutarReglas(contexto40kw(), { overrides: { 'TEC-003': { activa: false } } });
    expect(por(rs, 'TEC-003')).toHaveLength(0);
  });

  it('se pueden cambiar umbrales: el rango DC/AC y el umbral de «por vencer»', () => {
    const rs = ejecutarReglas(contexto40kw(), { overrides: { 'TEC-003': { parametros: { relacionMax: 1.1 } }, 'VIG-002': { parametros: { umbralDias: 10 } } } });
    expect(uno(rs, 'TEC-003').resultado).toBe('no_cumple'); // 1.138 > 1.1
    expect(por(rs, 'VIG-002').filter((r) => r.resultado === 'no_cumple')).toHaveLength(0); // 18 días > 10
  });

  it('se puede exigir o no la aprobación humana', () => {
    const rs = ejecutarReglas(contexto40kw(), { overrides: { 'CRU-002': { requiereAprobacionHumana: false } } });
    expect(uno(rs, 'CRU-002').requiereAprobacionHumana).toBe(false);
  });

  it('se pueden pedir solo ciertas categorías o reglas', () => {
    expect(new Set(ejecutarReglas(contexto40kw(), undefined, { categorias: ['vigencia'] }).map((r) => r.categoria))).toEqual(new Set(['vigencia']));
    expect(ejecutarReglas(contexto40kw(), undefined, { reglaIds: ['CRU-001'] })).toHaveLength(1);
  });

  it('los resultados cuyos parámetros son supuestos lo dicen, para no confundirlos con reglas de CFE', () => {
    const rs = ejecutarReglas(contexto40kw());
    expect(uno(rs, 'TEC-006').parametrosSupuestos).toBe(true);
    expect(uno(rs, 'TEC-001').parametrosSupuestos).toBe(false);
    expect(fallos(rs).filter((r) => r.parametrosSupuestos).every((r) => /supuestos/.test(r.explicacion))).toBe(true);
  });
});
