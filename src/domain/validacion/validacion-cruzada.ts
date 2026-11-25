import type { DocumentoExpediente } from '../documentos/documento';
import { aHallazgos } from '../reglas/compat';
import { ejecutarReglas } from '../reglas/motor';
import type { Hallazgo } from './hallazgo';

// La fecha no interviene en estas reglas (solo comparan valores entre documentos).
const SIN_FECHA = '1970-01-01';

/**
 * Campos cruzados con valores distintos entre documentos. Solo reporta; no elige una versión.
 * Envoltorio de las reglas CRU-xxx del motor (`reglas/`), que es donde vive la lógica.
 */
export function detectarDiscrepancias(documentos: readonly DocumentoExpediente[]): Hallazgo[] {
  return aHallazgos(ejecutarReglas({ hoy: SIN_FECHA, documentos }, undefined, { categorias: ['cruzada'] }));
}

/** Documentos con campos declarados pero vacíos (p. ej. croquis incompleto). Envoltorio de la regla OBL-001. */
export function detectarCamposIncompletos(documentos: readonly DocumentoExpediente[]): Hallazgo[] {
  return aHallazgos(ejecutarReglas({ hoy: SIN_FECHA, documentos }, undefined, { reglaIds: ['OBL-001'] }));
}
