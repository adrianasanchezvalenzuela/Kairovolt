import type { DocumentoExpediente, TipoDocumento } from '../documentos/documento';
import type { DatoDeclarado } from '../validacion/campos';

/**
 * Una versión de un documento. Las fechas y los datos declarados cuelgan de la VERSIÓN, no del documento:
 * una versión nueva puede corregir un dato sin borrar el rastro de la anterior.
 */
export interface VersionDocumento {
  id: string;
  documentoId: string;
  /** 1, 2, 3… */
  numero: number;
  nombreArchivo: string;
  subidoPor: string | null;
  /** Instante ISO de la carga. */
  subidoEn: string;
  sha256: string | null;
  sustituyeVersionId: string | null;
  fechaEmision: string | null;
  fechaVigencia: string | null;
  datos: readonly DatoDeclarado[];
}

export interface DocumentoConVersiones {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  versiones: readonly VersionDocumento[];
}

/** La versión vigente es la de mayor número. null si no hay versiones. */
export const versionVigente = (d: DocumentoConVersiones): VersionDocumento | null =>
  d.versiones.reduce<VersionDocumento | null>((mejor, v) => (mejor === null || v.numero > mejor.numero ? v : mejor), null);

/** Lo que consumen las reglas: el documento con los datos de su versión vigente (las versiones anteriores no se evalúan). */
export function documentoActual(d: DocumentoConVersiones): DocumentoExpediente | null {
  const v = versionVigente(d);
  return v ? { id: d.id, tipo: d.tipo, nombre: d.nombre, fechaEmision: v.fechaEmision, fechaVigencia: v.fechaVigencia, datos: v.datos } : null;
}

/** Problemas de la cadena de versiones (números repetidos, saltos, sustituciones que no apuntan a la anterior). Lista vacía = íntegra. */
export function validarVersiones(d: DocumentoConVersiones): string[] {
  const problemas: string[] = [];
  const ordenadas = [...d.versiones].sort((a, b) => a.numero - b.numero);
  ordenadas.forEach((v, i) => {
    if (v.documentoId !== d.id) problemas.push(`La versión ${v.numero} pertenece a otro documento.`);
    if (v.numero !== i + 1) problemas.push(`Se esperaba la versión ${i + 1} y se encontró la ${v.numero}.`);
    const anterior = ordenadas[i - 1];
    if (i === 0 && v.sustituyeVersionId !== null) problemas.push('La primera versión no puede sustituir a otra.');
    if (anterior && v.sustituyeVersionId !== anterior.id) problemas.push(`La versión ${v.numero} debe sustituir a la ${anterior.numero}.`);
  });
  return problemas;
}
