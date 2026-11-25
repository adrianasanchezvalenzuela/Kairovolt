import { crearResolvedor } from './configuracion';
import { evaluarCruzadas } from './cruzadas';
import { evaluarObligatorios } from './obligatorios';
import { evaluarTecnicas } from './tecnicas';
import { evaluarVigencias } from './vigencias';
import { ORDEN_SEVERIDAD, type CategoriaRegla, type ConfiguracionReglas, type ContextoValidacion, type Evaluador, type Resultado, type ResultadoValidacion } from './tipos';

const EVALUADORES: readonly Evaluador[] = [evaluarCruzadas, evaluarTecnicas, evaluarObligatorios, evaluarVigencias];
const ORDEN_RESULTADO: Record<Resultado, number> = { no_cumple: 0, no_evaluable: 1, cumple: 2 };

export interface OpcionesEjecucion {
  /** Limita a estas categorías. */
  categorias?: readonly CategoriaRegla[];
  /** Limita a estos ids de regla. */
  reglaIds?: readonly string[];
}

/**
 * Ejecuta las reglas ACTIVAS sobre el expediente y devuelve todos los resultados (los que cumplen, los que no y los no evaluables),
 * primero los fallos más graves. Es una función pura: no modifica el contexto ni corrige ningún dato.
 */
export function ejecutarReglas(ctx: ContextoValidacion, config?: ConfiguracionReglas, opciones: OpcionesEjecucion = {}): ResultadoValidacion[] {
  const resolver = crearResolvedor(config);
  return EVALUADORES.flatMap((evaluar) => evaluar(ctx, resolver))
    .filter((r) => resolver(r.reglaId).activa)
    .filter((r) => !opciones.categorias || opciones.categorias.includes(r.categoria))
    .filter((r) => !opciones.reglaIds || opciones.reglaIds.includes(r.reglaId))
    .sort((a, b) =>
      ORDEN_RESULTADO[a.resultado] - ORDEN_RESULTADO[b.resultado]
      || ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]
      || a.reglaId.localeCompare(b.reglaId)
      || a.huella.localeCompare(b.huella));
}

export const fallos = (rs: readonly ResultadoValidacion[]): ResultadoValidacion[] => rs.filter((r) => r.resultado === 'no_cumple');
export const bloqueantes = (rs: readonly ResultadoValidacion[]): ResultadoValidacion[] => fallos(rs).filter((r) => r.severidad === 'bloqueante');

export interface ResumenValidacion {
  total: number;
  cumplen: number;
  noCumplen: number;
  noEvaluables: number;
  porSeveridad: Record<'bloqueante' | 'mayor' | 'menor' | 'informativa', number>;
  requierenAprobacionHumana: number;
}

export function resumirValidacion(rs: readonly ResultadoValidacion[]): ResumenValidacion {
  const f = fallos(rs);
  const porSeveridad = { bloqueante: 0, mayor: 0, menor: 0, informativa: 0 };
  for (const r of f) porSeveridad[r.severidad]++;
  return {
    total: rs.length,
    cumplen: rs.filter((r) => r.resultado === 'cumple').length,
    noCumplen: f.length,
    noEvaluables: rs.filter((r) => r.resultado === 'no_evaluable').length,
    porSeveridad,
    requierenAprobacionHumana: f.filter((r) => r.requiereAprobacionHumana).length,
  };
}
