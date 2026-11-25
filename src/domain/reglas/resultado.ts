import type { CompuertaId } from '../compuertas/compuerta';
import type { DefinicionRegla, DocumentoOrigen, Resultado, ResultadoValidacion, Severidad } from './tipos';

export interface DatosResultado {
  resultado: Resultado;
  explicacion: string;
  accionRecomendada: string;
  campo?: string;
  documentosOrigen?: DocumentoOrigen[];
  valorEncontrado?: string | number | null;
  valorEsperado?: string | number | null;
  compuerta?: CompuertaId | null;
  /** Para reglas que evalúan por documento: identifica el caso (el huella queda `regla:campo:<clave>`). */
  clave?: string;
  /** Escala la severidad del catálogo en un caso concreto (p. ej. «por vencer» → «mayor» si faltan pocos días). */
  severidadForzada?: Severidad;
}

/** Único lugar donde se arma un ResultadoValidacion: garantiza que todas las reglas devuelvan los mismos campos. */
export function crearResultado(regla: DefinicionRegla, d: DatosResultado): ResultadoValidacion {
  const campo = d.campo ?? regla.campo;
  const falla = d.resultado === 'no_cumple';
  return {
    reglaId: regla.id,
    reglaNombre: regla.nombre,
    categoria: regla.categoria,
    campo,
    documentosOrigen: d.documentosOrigen ?? [],
    valorEncontrado: d.valorEncontrado ?? null,
    valorEsperado: d.valorEsperado ?? null,
    resultado: d.resultado,
    severidad: falla ? (d.severidadForzada ?? regla.severidad) : 'informativa',
    explicacion: d.explicacion + (regla.supuesto && d.resultado !== 'no_evaluable' ? ' (Parámetros supuestos, por confirmar con IDC.)' : ''),
    accionRecomendada: d.accionRecomendada,
    requiereAprobacionHumana: falla && regla.requiereAprobacionHumana,
    compuerta: d.compuerta ?? null,
    huella: `${regla.id}:${campo}:${d.clave ?? '*'}`,
    parametrosSupuestos: regla.supuesto,
  };
}
