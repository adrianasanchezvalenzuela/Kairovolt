import type { DocumentoExpediente } from '../documentos/documento';
import { CAMPOS, type CampoDato } from './campos';
import type { Hallazgo } from './hallazgo';

const vacio = (v: string | number | null): v is null | '' => v === null || (typeof v === 'string' && v.trim() === '');
const normalizar = (v: string | number): string => String(v).trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Campos cruzados con valores distintos entre documentos. Solo reporta; no elige una versión.
 * Los valores vacíos no cuentan aquí (los cubre `detectarCamposIncompletos`).
 */
export function detectarDiscrepancias(documentos: readonly DocumentoExpediente[]): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const campo of Object.keys(CAMPOS) as CampoDato[]) {
    const def = CAMPOS[campo];
    if (!def.cruzado) continue;
    const declaraciones = documentos.flatMap((d) =>
      d.datos
        .filter((x) => x.campo === campo && !vacio(x.valor))
        .map((x) => ({ documento: d, valor: x.valor as string | number })),
    );
    const distintos = new Set(declaraciones.map((x) => normalizar(x.valor)));
    if (distintos.size < 2) continue;
    const unidad = def.unidad ? ` ${def.unidad}` : '';
    hallazgos.push({
      id: `discrepancia:${campo}`,
      categoria: 'discrepancia',
      severidad: 'bloqueante',
      titulo: `${def.etiqueta}: valores distintos entre documentos`,
      detalle: 'Requiere confirmación humana; el sistema no determina cuál versión es la correcta.',
      evidencias: declaraciones.map((x) => ({
        documentoId: x.documento.id,
        documentoNombre: x.documento.nombre,
        valor: `${x.valor}${unidad}`,
      })),
    });
  }
  return hallazgos;
}

/** Documentos con campos declarados pero vacíos (p. ej. croquis incompleto). */
export function detectarCamposIncompletos(documentos: readonly DocumentoExpediente[]): Hallazgo[] {
  return documentos.flatMap((d) => {
    const vacios = d.datos.filter((x) => vacio(x.valor));
    if (vacios.length === 0) return [];
    return [{
      id: `incompleto:${d.id}`,
      categoria: 'campo_incompleto' as const,
      severidad: 'bloqueante' as const,
      titulo: `${d.nombre}: campos incompletos`,
      detalle: `Campos vacíos: ${vacios.map((x) => CAMPOS[x.campo].etiqueta).join('; ')}.`,
      evidencias: vacios.map(() => ({ documentoId: d.id, documentoNombre: d.nombre, valor: null })),
    }];
  });
}
