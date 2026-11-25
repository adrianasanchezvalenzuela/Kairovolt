import { describe, expect, it } from 'vitest';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { clasificarDocumento, normalizarParaClasificar } from '../clasificacion/clasificacion';
import { esFolioValido, folioDisponible, formatearFolio, normalizarFolio, parsearFolio, siguienteFolio } from './folio';

describe('folio KV-AAAA-NNN', () => {
  it('formatea con 3 dígitos mínimo y valida los argumentos', () => {
    expect(formatearFolio(2026, 4)).toBe('KV-2026-004');
    expect(formatearFolio(2026, 1234)).toBe('KV-2026-1234');
    expect(() => formatearFolio(26, 1)).toThrow();
    expect(() => formatearFolio(2026, 0)).toThrow();
    expect(() => formatearFolio(2026, 1.5)).toThrow();
  });

  it('parsea sin distinguir mayúsculas ni espacios, y rechaza lo que no es un folio', () => {
    expect(parsearFolio(' kv-2026-004 ')).toEqual({ anio: 2026, secuencia: 4 });
    expect(parsearFolio('KV-2026-04')).toBeNull();
    expect(parsearFolio('KV-MOCK-0001')).toBeNull();
    expect(normalizarFolio(' kv-2026-004 ')).toBe('KV-2026-004');
  });

  it('el folio de demostración solo se acepta si se permite expresamente', () => {
    expect(esFolioValido('KV-MOCK-0001')).toBe(false);
    expect(esFolioValido('KV-MOCK-0001', { permitirDemo: true })).toBe(true);
    expect(esFolioValido('KV-2026-004')).toBe(true);
  });

  it('siguienteFolio: máxima secuencia del año + 1 (no rellena huecos)', () => {
    expect(siguienteFolio(['KV-2026-001', 'KV-2026-004', 'KV-2026-002'], 2026)).toBe('KV-2026-005');
  });

  it('siguienteFolio: la secuencia reinicia cada año e ignora demo, otros años y basura', () => {
    expect(siguienteFolio(['KV-2025-120', 'KV-MOCK-0009', 'basura', 'KV-2026-007'], 2026)).toBe('KV-2026-008');
    expect(siguienteFolio(['KV-2025-120'], 2026)).toBe('KV-2026-001');
    expect(siguienteFolio([], 2027)).toBe('KV-2027-001');
  });

  it('siguienteFolio: pasa de 999 a 4 dígitos sin romperse', () => {
    expect(siguienteFolio(['KV-2026-999'], 2026)).toBe('KV-2026-1000');
  });

  it('folioDisponible compara normalizado', () => {
    expect(folioDisponible('kv-2026-004', ['KV-2026-004'])).toBe(false);
    expect(folioDisponible('KV-2026-005', ['KV-2026-004'])).toBe(true);
  });
});

describe('clasificación de documentos', () => {
  it('reconoce documentos por el nombre del archivo y sugiere su compuerta del catálogo', () => {
    const c = clasificarDocumento({ nombreArchivo: 'Diagrama_Unifilar_SFV-01.pdf', mime: 'application/pdf' }, catalogoRequisitosBase);
    expect(c).toMatchObject({ tipo: 'diagrama_unifilar', compuertaSugerida: 'G1', confianza: 'alta', requiereConfirmacionHumana: true });
    expect(c.motivos.join(' ')).toMatch(/unifilar/);
  });

  it('distingue la solicitud de interconexión del contrato de interconexión', () => {
    expect(clasificarDocumento({ nombreArchivo: 'Solicitud de interconexión firmada.pdf' }).tipo).toBe('solicitud');
    expect(clasificarDocumento({ nombreArchivo: 'Contrato_de_Interconexion_CFE.pdf' }).tipo).toBe('contrato_interconexion');
  });

  it('las siglas cortas solo cuentan como palabra completa («ine» no coincide dentro de «linea»)', () => {
    expect(clasificarDocumento({ nombreArchivo: 'INE_titular.jpg' }).tipo).toBe('identificacion_oficial');
    expect(clasificarDocumento({ nombreArchivo: 'linea_base.pdf' }).tipo).toBeNull();
  });

  it('usa el texto extraído y el tipo MIME como indicios más débiles', () => {
    const c = clasificarDocumento({ nombreArchivo: 'scan_0042.pdf', texto: 'COMISIÓN FEDERAL DE ELECTRICIDAD — Recibo de energía eléctrica, tarifa GDMTO' });
    expect(c.tipo).toBe('recibo_cfe');
    expect(c.confianza).not.toBe('alta'); // solo por texto: la confianza no es máxima
    expect(clasificarDocumento({ nombreArchivo: 'IMG_2231.jpg', mime: 'image/jpeg' }).tipo).toBeNull(); // un MIME de imagen solo no basta
    expect(clasificarDocumento({ nombreArchivo: 'foto_tablero.jpg', mime: 'image/jpeg' }).tipo).toBe('evidencia_fotografica');
  });

  it('si es ambiguo NO asigna ningún tipo, y lo explica', () => {
    const c = clasificarDocumento({ nombreArchivo: 'dictamen_solicitud.pdf' }); // dictamen (UVIE) y solicitud: indicios casi iguales
    expect(c.tipo).toBeNull();
    expect(c.confianza).toBe('baja');
    expect(c.motivos[0]).toMatch(/varios tipos posibles/);
    expect(c.candidatos.map((x) => x.tipo).sort()).toEqual(['dictamen_uvie', 'solicitud']);
  });

  it('sin indicios devuelve «ninguna» y nunca un tipo por default', () => {
    expect(clasificarDocumento({ nombreArchivo: 'documento_final_v3.pdf' })).toMatchObject({ tipo: null, confianza: 'ninguna', compuertaSugerida: null });
  });

  it('SIEMPRE requiere confirmación humana, incluso con confianza alta', () => {
    for (const n of ['croquis_ubicacion.pdf', 'Memoria de cálculo SFV-02.pdf', 'dictamen UVIE NOM-001.pdf', 'xyz.pdf']) {
      expect(clasificarDocumento({ nombreArchivo: n }).requiereConfirmacionHumana).toBe(true);
    }
  });

  it('normaliza acentos, guiones bajos y mayúsculas', () => {
    expect(normalizarParaClasificar('Memoria_de_CÁLCULO.v2')).toBe('memoria de calculo v2');
  });
});
