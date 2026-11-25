import type { Requisito } from '../checklist/checklist';
import type { DocumentoExpediente } from '../documentos/documento';
import { aHallazgos } from '../reglas/compat';
import { ejecutarReglas } from '../reglas/motor';
import type { Hallazgo } from '../validacion/hallazgo';

/** Umbral por defecto (días) para avisar de vencimiento próximo. Parámetro configurable (regla VIG-002), no regla de CFE. */
export const UMBRAL_POR_VENCER_DIAS = 30;

/**
 * Audita vigencias contra la fecha `hoy` (ISO). Solo usa fechas capturadas: no infiere vencimientos.
 * Envoltorio de las reglas VIG-001 a VIG-004 del motor (`reglas/`), que es donde vive la lógica.
 */
export function evaluarVigencias(
  requisitos: readonly Requisito[],
  documentos: readonly DocumentoExpediente[],
  hoy: string,
  umbralDias: number = UMBRAL_POR_VENCER_DIAS,
): Hallazgo[] {
  return aHallazgos(
    ejecutarReglas(
      { hoy, documentos, requisitos },
      { overrides: { 'VIG-002': { parametros: { umbralDias } } } },
      { categorias: ['vigencia'] },
    ),
  );
}
