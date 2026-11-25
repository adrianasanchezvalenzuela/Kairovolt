import { CAMPOS } from '@/domain/validacion/campos';
import type { ResultadoValidacion } from '@/domain/reglas/tipos';
import type { ValidacionVista } from './ValidationCard';

const texto = (v: string | number | null): string | null => (v === null || v === '' ? null : String(v));

/**
 * Convierte un resultado del motor de reglas al modelo de vista. Solo traduce: no evalúa ni decide.
 * `idsAbribles` = ids de documentos del expediente cuya evidencia se puede abrir (la configuración técnica no es un documento).
 */
export function aValidacionVistaResultado(r: ResultadoValidacion, idsAbribles: ReadonlySet<string>): ValidacionVista {
  const etiquetaCampo = (CAMPOS as Record<string, { etiqueta: string }>)[r.campo]?.etiqueta;
  return {
    id: r.huella,
    titulo: r.reglaNombre,
    resultado: r.resultado,
    severidad: r.severidad,
    categoria: etiquetaCampo ?? r.campo.replaceAll('_', ' '),
    reglaId: r.reglaId,
    explicacion: r.explicacion,
    esperado: texto(r.valorEsperado),
    encontrado: texto(r.valorEncontrado),
    evidencias: r.documentosOrigen.map((d) => ({ ...(idsAbribles.has(d.id) && { documentoId: d.id }), documento: d.nombre, valor: texto(d.valor), ...(etiquetaCampo && { campo: etiquetaCampo }) })),
    accionRecomendada: r.accionRecomendada,
    requiereAprobacionHumana: r.requiereAprobacionHumana,
  };
}

