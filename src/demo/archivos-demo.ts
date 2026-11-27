/**
 * Registro central de los archivos de demostración (public/demo/documentos). Se generan con `npm run demo:documentos`.
 * Todo es ficticio y está marcado «DEMO — Sin validez oficial». Aquí se decide qué archivo corresponde a cada versión.
 */
import type { VersionDemo } from './expediente-demo';

export const BASE_DOCUMENTOS = '/demo/documentos';
export interface ArchivoDemo { etiqueta: string; ruta: string; paginas?: string[] }

const cli = (n: string) => `${BASE_DOCUMENTOS}/cliente/${n}`;
const tec = (n: string) => `${BASE_DOCUMENTOS}/idc/documentos-tecnicos/${n}`;
export const cfe = (n: string) => `${BASE_DOCUMENTOS}/cfe/${n}`;

const FIJOS: Readonly<Record<string, ArchivoDemo>> = {
  identificacion_oficial: { etiqueta: 'Identificación del titular', ruta: cli('identificacion-titular.pdf'), paginas: ['Frente', 'Reverso'] },
  constancia_situacion_fiscal: { etiqueta: 'Constancia de situación fiscal', ruta: cli('constancia-situacion-fiscal.pdf') },
  recibo_cfe: { etiqueta: 'Recibo de CFE', ruta: cli('recibo-cfe.pdf') },
  croquis: { etiqueta: 'Croquis de ubicación', ruta: tec('croquis.pdf') },
  diagrama_unifilar: { etiqueta: 'Diagrama unifilar', ruta: tec('diagrama-unifilar.pdf') },
  ficha_tecnica: { etiqueta: 'Fichas técnicas', ruta: tec('fichas-tecnicas.pdf'), paginas: ['Módulo', 'Inversor'] },
  certificado: { etiqueta: 'Certificados', ruta: tec('certificados.pdf'), paginas: ['Módulos', 'Inversores'] },
  evidencia_fotografica: { etiqueta: 'Fotografías del sistema', ruta: tec('fotografias-sistema.pdf') },
  dictamen_uvie: { etiqueta: 'Dictamen UVIE', ruta: tec('dictamen-uvie.pdf') },
};

/** Identificaciones que acompañan a la carta poder (representante y testigos). */
export const ADJUNTOS_CARTA: readonly ArchivoDemo[] = [
  { etiqueta: 'Identificación del representante', ruta: cli('identificacion-representante.pdf'), paginas: ['Frente', 'Reverso'] },
  { etiqueta: 'Identificación del testigo 1', ruta: cli('identificacion-testigo-1.pdf'), paginas: ['Frente', 'Reverso'] },
  { etiqueta: 'Identificación del testigo 2', ruta: cli('identificacion-testigo-2.pdf'), paginas: ['Frente', 'Reverso'] },
];

// Archivos que el usuario elige en esta sesión (solo memoria del navegador; nunca salen del equipo).
const subidos = new Map<string, string>();
const llave = (folio: string, id: string, n: number) => `${folio}:${id}:${n}`;
export function registrarArchivoSubido(folio: string, id: string, n: number, archivo: File) { subidos.set(llave(folio, id, n), URL.createObjectURL(archivo)); }

/** Archivo asociado a una versión. Siempre devuelve uno: lo subido en la sesión o, si no, el de demostración. */
export function archivoDeVersion(folio: string, id: string, v: VersionDemo): ArchivoDemo {
  const propio = subidos.get(llave(folio, id, v.n));
  if (propio) return { etiqueta: v.archivo, ruta: propio };
  if (id === 'solicitud') return { etiqueta: v.autor === 'idc' ? 'Solicitud prellenada por IDC' : 'Solicitud firmada', ruta: v.autor === 'idc' ? `${BASE_DOCUMENTOS}/idc/solicitud-prellenada.pdf` : cli('solicitud-firmada.pdf') };
  if (id === 'carta_poder') {
    const incompleta = v.n === 1 && (folio === 'KV-2026-005' || folio === 'KV-2026-006');
    return { etiqueta: incompleta ? 'Carta poder (falta firma del testigo 2)' : 'Carta poder firmada', ruta: cli(`carta-poder/${folio}-${incompleta ? 'sin-firma-testigo-2' : 'firmada'}.pdf`) };
  }
  return FIJOS[id] ?? { etiqueta: v.archivo, ruta: cli('recibo-cfe.pdf') };
}
