import type { Requisito } from '../checklist/checklist';
import type { CompuertaId } from '../compuertas/compuerta';
import type { TipoDocumento } from '../documentos/documento';

/**
 * Clasificación de documentos por nombre de archivo, tipo MIME y texto extraído. SOLO SUGIERE: el resultado siempre
 * requiere confirmación humana y, si es ambiguo, no propone ningún tipo (nunca se asigna uno «por default»).
 */

export interface ReglaClasificacion {
  tipo: TipoDocumento;
  /** Frases (sin acentos, en minúsculas) que, contenidas en el texto, suman puntos. */
  frases: readonly string[];
  /** Palabras exactas (para siglas cortas como «ine» o «ul», que no deben coincidir dentro de otra palabra). */
  palabras?: readonly string[];
  /** Prefijos de tipo MIME que suman puntos (p. ej. «image/»). */
  mime?: readonly string[];
}

export const TABLA_CLASIFICACION: readonly ReglaClasificacion[] = [
  { tipo: 'consulta_capacidad_mt', frases: ['consulta de capacidad', 'capacidad del circuito', 'capacidad mt'] },
  { tipo: 'recibo_cfe', frases: ['recibo cfe', 'recibo de luz', 'recibo de energia', 'recibo'], palabras: ['tarifa'] },
  { tipo: 'datos_preliminares', frases: ['datos preliminares', 'datos tecnicos preliminares'] },
  { tipo: 'identificacion_oficial', frases: ['identificacion oficial', 'credencial'], palabras: ['ine', 'pasaporte', 'cedula'] },
  { tipo: 'constancia_situacion_fiscal', frases: ['situacion fiscal', 'constancia de situacion'], palabras: ['csf', 'sat'] },
  { tipo: 'carta_poder', frases: ['carta poder'] },
  { tipo: 'acta_constitutiva', frases: ['acta constitutiva'] },
  { tipo: 'croquis', frases: ['croquis', 'localizacion'] },
  { tipo: 'diagrama_unifilar', frases: ['unifilar', 'sfv-01'] },
  { tipo: 'memoria_calculo', frases: ['memoria de calculo', 'memoria calculo', 'sfv-02'] },
  { tipo: 'ficha_tecnica', frases: ['ficha tecnica', 'hoja de datos', 'datasheet'] },
  { tipo: 'certificado', frases: [], palabras: ['certificado', 'ul', 'csa'] },
  { tipo: 'solicitud', frases: ['solicitud de interconexion', 'solicitud interconexion', 'formato de solicitud'], palabras: ['solicitud'] },
  { tipo: 'evidencia_fotografica', frases: ['evidencia fotografica', 'fotografia', 'fotografias'], palabras: ['foto', 'fotos'], mime: ['image/'] },
  { tipo: 'checklist_consistencia', frases: ['checklist', 'consistencia'] },
  { tipo: 'dictamen_uvie', frases: ['dictamen', 'uvie', 'nom-001'] },
  { tipo: 'certificado_uiie', frases: ['uiie'] },
  { tipo: 'oficio_resolutivo', frases: ['oficio resolutivo', 'acuse de ingreso', 'resolutivo'] },
  { tipo: 'contrato_interconexion', frases: ['contrato de interconexion', 'contrato interconexion'] },
  { tipo: 'contrato_contraprestacion', frases: ['contraprestacion'] },
  { tipo: 'medidor_bidireccional', frases: ['medidor bidireccional', 'medidor', 'bidireccional'] },
];

export type ConfianzaClasificacion = 'alta' | 'media' | 'baja' | 'ninguna';

export interface EntradaClasificacion {
  nombreArchivo: string;
  mime?: string | null;
  /** Texto extraído del documento (OCR o PDF), si existe. */
  texto?: string | null;
}

export interface ClasificacionDocumento {
  /** Tipo sugerido; null si es ambiguo o no hay indicios. */
  tipo: TipoDocumento | null;
  compuertaSugerida: CompuertaId | null;
  confianza: ConfianzaClasificacion;
  motivos: string[];
  candidatos: { tipo: TipoDocumento; puntaje: number }[];
  /** Siempre true: una clasificación automática nunca se aplica sin que una persona la confirme. */
  requiereConfirmacionHumana: true;
}

const PUNTOS = { frase: 4, palabra: 3, mime: 2, fraseTexto: 2, palabraTexto: 1 } as const;

/** Minúsculas, sin acentos, con separadores unificados a espacios (se conservan los guiones: «sfv-01», «nom-001»). */
export function normalizarParaClasificar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_.\s]+/g, ' ').replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
}

const palabrasDe = (s: string): Set<string> => new Set(s.split(/[ ]+/).filter(Boolean));

export function clasificarDocumento(
  entrada: EntradaClasificacion,
  requisitos: readonly Requisito[] = [],
  tabla: readonly ReglaClasificacion[] = TABLA_CLASIFICACION,
): ClasificacionDocumento {
  const nombre = normalizarParaClasificar(entrada.nombreArchivo.replace(/\.[a-z0-9]{2,5}$/i, ''));
  const texto = normalizarParaClasificar(entrada.texto ?? '');
  const palabrasNombre = palabrasDe(nombre);
  const palabrasTexto = palabrasDe(texto);
  const mime = (entrada.mime ?? '').toLowerCase();

  const puntajes = tabla.map((r) => {
    const motivos: string[] = [];
    let puntaje = 0;
    for (const f of r.frases) {
      if (nombre.includes(f)) { puntaje += PUNTOS.frase; motivos.push(`el nombre contiene «${f}»`); }
      else if (texto.includes(f)) { puntaje += PUNTOS.fraseTexto; motivos.push(`el texto contiene «${f}»`); }
    }
    for (const p of r.palabras ?? []) {
      if (palabrasNombre.has(p)) { puntaje += PUNTOS.palabra; motivos.push(`el nombre incluye «${p}»`); }
      else if (palabrasTexto.has(p)) { puntaje += PUNTOS.palabraTexto; motivos.push(`el texto incluye «${p}»`); }
    }
    for (const m of r.mime ?? []) if (mime.startsWith(m)) { puntaje += PUNTOS.mime; motivos.push(`el tipo de archivo es ${mime}`); }
    return { tipo: r.tipo, puntaje, motivos };
  });

  const ordenados = puntajes.filter((p) => p.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje);
  const [primero, segundo] = ordenados;
  const candidatos = ordenados.slice(0, 3).map(({ tipo, puntaje }) => ({ tipo, puntaje }));

  if (!primero) {
    return { tipo: null, compuertaSugerida: null, confianza: 'ninguna', motivos: ['No hay indicios en el nombre, el tipo de archivo ni el texto.'], candidatos, requiereConfirmacionHumana: true };
  }
  const margen = primero.puntaje - (segundo?.puntaje ?? 0);
  const confianza: ConfianzaClasificacion = primero.puntaje >= 6 && margen >= 3 ? 'alta' : primero.puntaje >= 3 && margen >= 2 ? 'media' : 'baja';
  if (confianza === 'baja') {
    return {
      tipo: null, compuertaSugerida: null, confianza, candidatos, requiereConfirmacionHumana: true,
      motivos: [margen <= 1 ? 'Hay varios tipos posibles con indicios parecidos.' : 'Los indicios son muy débiles.', ...primero.motivos],
    };
  }
  return {
    tipo: primero.tipo,
    compuertaSugerida: requisitos.find((r) => r.tipo === primero.tipo)?.compuerta ?? null,
    confianza, motivos: primero.motivos, candidatos, requiereConfirmacionHumana: true,
  };
}
