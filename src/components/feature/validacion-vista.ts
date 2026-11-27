import { CAMPOS } from '@/domain/validacion/campos';
import type { ResultadoValidacion } from '@/domain/reglas/tipos';
import type { ValidacionVista } from './ValidationCard';

const texto = (v: string | number | null): string | null => (v === null || v === '' ? null : String(v));
const etiquetaLimpia = (etiqueta: string): string => {
  const limpio = etiqueta.replace(/^\s*(?:documento|campo)\s*:\s*/i, '').replaceAll('_', ' ').trim();
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : etiqueta;
};
const tituloLimpio = (titulo: string): string => titulo.replace(/^\s*(?:[A-Z]{1,8}[\s_-]*)?(?:validaci[oó]n|regla)\s*[:.#-]?\s*/i, '').trim() || titulo;

/**
 * Convierte un resultado del motor de reglas al modelo de vista. Solo traduce: no evalúa ni decide.
 * `idsAbribles` = ids de documentos del expediente cuya evidencia se puede abrir (la configuración técnica no es un documento).
 */
export function aValidacionVistaResultado(r: ResultadoValidacion, idsAbribles: ReadonlySet<string>): ValidacionVista {
  const etiquetaCampo = (CAMPOS as Record<string, { etiqueta: string }>)[r.campo]?.etiqueta;
  const documentoEspecifico = r.campo.startsWith('documento:') ? texto(r.valorEsperado) : null;
  const tituloBase = tituloLimpio(r.reglaNombre);
  const titulo = /^documentos obligatorios por compuerta$/i.test(tituloBase) && documentoEspecifico
    ? `${tituloBase} · ${documentoEspecifico}`
    : tituloBase;
  return {
    id: r.huella,
    titulo,
    resultado: r.resultado,
    severidad: r.severidad,
    categoria: etiquetaLimpia(etiquetaCampo ?? r.campo),
    reglaId: r.reglaId,
    explicacion: r.explicacion,
    esperado: texto(r.valorEsperado),
    encontrado: texto(r.valorEncontrado),
    evidencias: r.documentosOrigen.map((d) => ({ ...(idsAbribles.has(d.id) && { documentoId: d.id }), documento: d.nombre, valor: texto(d.valor), ...(etiquetaCampo && { campo: etiquetaCampo }) })),
    accionRecomendada: r.accionRecomendada,
    requiereAprobacionHumana: r.requiereAprobacionHumana,
  };
}

