import { describe, expect, it } from 'vitest';
import { evaluarAplicabilidad } from './checklist';
import { mapearFilaCatalogo, comoRequisitoChecklist, hayRequisitosPendientesDeIDC, type FilaCatalogoSupabase } from './catalogo';

const fila: FilaCatalogoSupabase = {
  id: 'uuid-1', codigo: 'CARTA_PODER', tipo_documento: 'carta_poder', nombre: 'Carta poder', descripcion: 'Documento de representación',
  categoria: 'legal', compuerta: 'G1', canal: 'fisico', obligatorio: false, condicion: 'Si existe apoderado',
  condiciones_aplicacion: [{ campo: 'tipo_titular', operador: 'igual', valor: 'persona_fisica' }], requiere_vigencia: false,
  aporta_cliente: true, quien_aporta: 'cliente', instrucciones_cliente: 'Pendiente IDC', campos_esperados: [], ejemplos_autorizados: [],
  generacion_automatica: false, orden: 2, activo: true, validacion_idc: 'validado',
};

describe('contrato documental canónico', () => {
  it('mapea metadatos Supabase a checklist sin perder código ni estado IDC', () => {
    const r = mapearFilaCatalogo(fila);
    expect(r).toMatchObject({ codigo: 'CARTA_PODER', tipo: 'carta_poder', compuerta: 'G1', canal: 'fisico', quienAporta: 'cliente', validacionIdc: 'validado' });
    expect(comoRequisitoChecklist(r).tipo).toBe('carta_poder');
  });

  it('conserva requisitos inactivos y filas históricas sin mapeo para revisión; no los incorpora al motor', () => {
    const inactivo = mapearFilaCatalogo({ ...fila, activo: false });
    expect(inactivo.activo).toBe(false);
    const legado = mapearFilaCatalogo({ ...fila, codigo: 'LEGADO', tipo_documento: null, compuerta: null });
    expect(legado.tipo).toBeNull();
    expect(() => comoRequisitoChecklist(legado)).toThrow('no está mapeado');
  });

  it('mantiene condiciones desconocidas en revisión y resuelve solo datos conocidos y validados', () => {
    const r = comoRequisitoChecklist(mapearFilaCatalogo(fila));
    expect(evaluarAplicabilidad(r, {})).toBe('pendiente_revision');
    expect(evaluarAplicabilidad(r, { tipo_titular: 'persona_fisica' })).toBe('aplica');
    expect(evaluarAplicabilidad(r, { tipo_titular: 'persona_moral' })).toBe('no_aplica');
    expect(evaluarAplicabilidad({ ...r, validacionIdc: 'pendiente' }, { tipo_titular: 'persona_fisica' })).toBe('pendiente_revision');
  });

  it('no usa ejemplos ni generación automática sin autorización explícita', () => {
    const r = mapearFilaCatalogo({ ...fila, ejemplos_autorizados: null, generacion_automatica: false });
    expect(r.ejemplosAutorizados).toEqual([]);
    expect(r.generacionAutomatica).toBe(false);
  });

  it('no permite tomar el catálogo pendiente como autorización para liberar una compuerta', () => {
    expect(hayRequisitosPendientesDeIDC([mapearFilaCatalogo(fila)])).toBe(false);
    expect(hayRequisitosPendientesDeIDC([mapearFilaCatalogo({ ...fila, validacion_idc: 'pendiente' })])).toBe(true);
    expect(hayRequisitosPendientesDeIDC([mapearFilaCatalogo({ ...fila, activo: false })])).toBe(false);
  });
});
