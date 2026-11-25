import type { CompuertaId } from '../compuertas/compuerta';
import type { Requisito } from '../checklist/checklist';
import type { DocumentoExpediente } from '../documentos/documento';
import type { ConfiguracionTecnica } from '../entidades/configuracion-tecnica';
import type { Proyecto } from '../proyecto/proyecto';

/** `no_evaluable` = faltan datos para evaluar la regla (nunca se inventan ni se suponen). */
export type Resultado = 'cumple' | 'no_cumple' | 'no_evaluable';

/** `bloqueante` impide solicitar la compuerta mientras no se resuelva o se apruebe como excepción. */
export type Severidad = 'bloqueante' | 'mayor' | 'menor' | 'informativa';

export const ORDEN_SEVERIDAD: Record<Severidad, number> = { bloqueante: 0, mayor: 1, menor: 2, informativa: 3 };

export type CategoriaRegla = 'cruzada' | 'tecnica' | 'obligatorio' | 'vigencia';

/** Un documento (o la configuración técnica del proyecto, con id 'configuracion') que aporta un valor a la validación. */
export interface DocumentoOrigen {
  id: string;
  nombre: string;
  /** Valor tal como aparece ahí (con su unidad si aplica); null = vacío. */
  valor: string | number | null;
}

/**
 * Resultado de una validación. Es una LECTURA: ninguna regla modifica ni corrige datos. Cuando hay datos
 * contradictorios, el resultado los muestra y exige una decisión humana; no elige cuál es el correcto.
 */
export interface ResultadoValidacion {
  reglaId: string;
  reglaNombre: string;
  categoria: CategoriaRegla;
  /** Campo evaluado (un `CampoDato`, o un nombre descriptivo como 'campos_obligatorios'). */
  campo: string;
  documentosOrigen: DocumentoOrigen[];
  valorEncontrado: string | number | null;
  /** Valor esperado o de referencia (p. ej. el calculado, o el de la configuración técnica). null = no hay referencia. */
  valorEsperado: string | number | null;
  resultado: Resultado;
  /** Severidad si NO cumple; los resultados que cumplen o no son evaluables llevan 'informativa'. */
  severidad: Severidad;
  explicacion: string;
  accionRecomendada: string;
  /** true = un humano debe decidir (resolver o aprobar como excepción) antes de continuar. Solo aplica si no cumple. */
  requiereAprobacionHumana: boolean;
  /** Compuerta que bloquea este resultado, si es específica de una. */
  compuerta: CompuertaId | null;
  /** Clave estable (regla + campo + origen) para enlazar observaciones y detectar que un problema reaparece. */
  huella: string;
  /** true = los parámetros usados son supuestos por confirmar, no reglas de CFE confirmadas. */
  parametrosSupuestos: boolean;
}

export type ValorParametro = number | string | boolean | readonly string[] | readonly number[] | { readonly [clave: string]: readonly string[] | readonly number[] };

/** Definición de una regla. El catálogo por defecto está en `configuracion.ts`; se sobrescribe sin tocar código. */
export interface DefinicionRegla {
  id: string;
  nombre: string;
  categoria: CategoriaRegla;
  campo: string;
  descripcion: string;
  severidad: Severidad;
  requiereAprobacionHumana: boolean;
  activa: boolean;
  /** true = los valores por defecto de esta regla son supuestos por confirmar con IDC. */
  supuesto: boolean;
  parametros: { readonly [nombre: string]: ValorParametro };
}

export interface OverrideRegla {
  severidad?: Severidad;
  requiereAprobacionHumana?: boolean;
  activa?: boolean;
  parametros?: { readonly [nombre: string]: ValorParametro };
}

/** Configuración editable: se aplica encima del catálogo por defecto (por zona, por proyecto, etc.). */
export interface ConfiguracionReglas {
  overrides?: { readonly [reglaId: string]: OverrideRegla };
}

export interface ContextoValidacion {
  /** Fecha de la validación (ISO YYYY-MM-DD). Se pasa de fuera para que el resultado sea reproducible. */
  hoy: string;
  /** Solo las versiones vigentes de cada documento. */
  documentos: readonly DocumentoExpediente[];
  configuracion?: ConfiguracionTecnica | null;
  requisitos?: readonly Requisito[];
  revisionDocumental?: Proyecto['revisionDocumental'];
}

/** Devuelve la regla ya combinada con la configuración. Los evaluadores la piden por id. */
export type ResolverRegla = (id: string) => DefinicionRegla;

export type Evaluador = (ctx: ContextoValidacion, regla: ResolverRegla) => ResultadoValidacion[];
