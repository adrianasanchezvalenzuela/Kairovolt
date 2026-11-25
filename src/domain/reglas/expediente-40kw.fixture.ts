import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { proyectoReferenciaMock } from '@/data/proyecto-referencia.mock';
import { configuracionVacia, type ConfiguracionTecnica } from '../entidades/configuracion-tecnica';
import type { DocumentoExpediente, TipoDocumento } from '../documentos/documento';
import type { DatoDeclarado } from '../validacion/campos';
import type { ContextoValidacion } from './tipos';

/** Fecha de las pruebas: fija para que los resultados sean reproducibles. */
export const HOY = '2026-11-22';

/**
 * Expediente de referencia de 40 kW (Hermosillo). Datos REALES del caso: 74 paneles de 615 W (45.51 kWp), 40 kW AC,
 * 4 inversores GoodWe de 10 kW, transformador de 75 kVA, y sus inconsistencias (MT/BT, CS6.2 vs CS3.2, croquis incompleto,
 * 6,921.31 vs 697.52 kWh/mes, vigencias). Los datos que NO se conocen (modelo del inversor, strings, RPU, coordenadas…)
 * quedan en null: las reglas los reportan como «no evaluables» en vez de inventarlos.
 * El modelo de panel queda null a propósito: hay dos versiones contradictorias y no se decide cuál es la correcta.
 */
export const documentos40kw = (): DocumentoExpediente[] => proyectoReferenciaMock.documentos.map((d) => ({ ...d, datos: [...d.datos] }));

export const configuracion40kw = (): ConfiguracionTecnica => ({
  ...configuracionVacia(),
  numeroPaneles: 74,
  potenciaPanelW: 615,
  potenciaDcKwpDeclarada: 45.51,
  numeroInversores: 4,
  marcaInversor: 'GoodWe',
  potenciaInversorKw: 10,
  potenciaAcKw: 40,
  transformadorKva: 75,
});

export const contexto40kw = (extra: Partial<ContextoValidacion> = {}): ContextoValidacion => ({
  hoy: HOY,
  documentos: documentos40kw(),
  configuracion: configuracion40kw(),
  requisitos: catalogoRequisitosBase,
  ...extra,
});

/** Documento sintético para casos ampliados (datos ILUSTRATIVOS, solo para ejercitar reglas). */
export const doc = (id: string, tipo: TipoDocumento, datos: DatoDeclarado[] = [], extra: Partial<DocumentoExpediente> = {}): DocumentoExpediente => ({
  id, tipo, nombre: id, fechaEmision: null, fechaVigencia: null, datos, ...extra,
});

/** Congela un objeto en profundidad: si una regla intentara modificar un dato, la prueba fallaría. */
export function congelar<T>(valor: T): T {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const v of Object.values(valor as Record<string, unknown>)) congelar(v);
  }
  return valor;
}
