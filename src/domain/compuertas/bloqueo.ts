import type { ResumenCompuerta } from '../checklist/checklist';
import { excepcionesVigentes } from '../observaciones/resolucion';
import type { Observacion, OrigenObservacion } from '../observaciones/observacion';
import type { ResultadoValidacion } from '../reglas/tipos';
import { ORDEN_COMPUERTAS, type Compuerta, type CompuertaId } from './compuerta';

export type TipoRazonBloqueo = 'validacion_bloqueante' | 'compuerta_liberada' | 'compuerta_previa' | 'documentos_faltantes' | 'observaciones_abiertas';

export interface RazonBloqueo {
  tipo: TipoRazonBloqueo;
  mensaje: string;
  /** Ids o huellas de lo que bloquea (reglas, compuertas, observaciones). */
  referencias: string[];
}

export interface DecisionBloqueo {
  compuerta: CompuertaId;
  bloqueada: boolean;
  /** TODAS las razones, no solo la primera. */
  razones: RazonBloqueo[];
}

export interface ConfiguracionBloqueo {
  /** Compuertas que no se pueden solicitar con validaciones bloqueantes sin resolver. Por defecto, G2 (filtro anti-reingresos). */
  compuertasConValidaciones: readonly CompuertaId[];
  /** Observaciones abiertas de estos orígenes bloquean su compuerta (además de las de severidad bloqueante). */
  origenesQueBloquean: readonly OrigenObservacion[];
}

export const CONFIGURACION_BLOQUEO_POR_DEFECTO: ConfiguracionBloqueo = { compuertasConValidaciones: ['G2'], origenesQueBloquean: ['cfe', 'uvie'] };

export interface ValidacionPendiente {
  reglaId: string;
  huella: string;
  titulo: string;
}

export interface EntradaBloqueo {
  compuerta: CompuertaId;
  compuertas: readonly Compuerta[];
  resumenes: readonly ResumenCompuerta[];
  /** Validaciones bloqueantes SIN resolver ni excepción aprobada (ver `validacionesPendientes`). */
  validacionesBloqueantes: readonly ValidacionPendiente[];
  observaciones?: readonly Observacion[];
  config?: ConfiguracionBloqueo;
}

/**
 * Bloqueos de una compuerta: validaciones bloqueantes pendientes (G2), compuerta ya liberada, compuertas previas sin liberar,
 * documentos obligatorios faltantes y observaciones abiertas que bloquean. Devuelve todas las razones, en un orden estable.
 */
export function evaluarBloqueoCompuerta(e: EntradaBloqueo): DecisionBloqueo {
  const cfg = e.config ?? CONFIGURACION_BLOQUEO_POR_DEFECTO;
  const razones: RazonBloqueo[] = [];
  const estadoDe = (c: CompuertaId) => e.compuertas.find((x) => x.id === c)?.estado;

  if (cfg.compuertasConValidaciones.includes(e.compuerta) && e.validacionesBloqueantes.length > 0) {
    razones.push({ tipo: 'validacion_bloqueante', mensaje: `${e.validacionesBloqueantes.length} hallazgo(s) bloqueante(s) abierto(s)`, referencias: e.validacionesBloqueantes.map((v) => v.huella) });
  }
  if (estadoDe(e.compuerta) === 'liberada') razones.push({ tipo: 'compuerta_liberada', mensaje: `${e.compuerta} ya está liberada`, referencias: [e.compuerta] });
  for (const previa of ORDEN_COMPUERTAS.slice(0, ORDEN_COMPUERTAS.indexOf(e.compuerta))) {
    if (estadoDe(previa) !== 'liberada') razones.push({ tipo: 'compuerta_previa', mensaje: `${previa} no está liberada`, referencias: [previa] });
  }
  const resumen = e.resumenes.find((r) => r.compuerta === e.compuerta);
  if (resumen && !resumen.completa) {
    razones.push({ tipo: 'documentos_faltantes', mensaje: `Faltan ${resumen.faltantes.length} documento(s) obligatorio(s) de ${e.compuerta}`, referencias: resumen.faltantes.map((f) => f.requisito.tipo) });
  }
  const abiertas = (e.observaciones ?? []).filter(
    (o) => o.compuerta === e.compuerta && o.estado !== 'cerrada' && (o.severidad === 'bloqueante' || cfg.origenesQueBloquean.includes(o.origen)),
  );
  if (abiertas.length > 0) {
    razones.push({ tipo: 'observaciones_abiertas', mensaje: `${abiertas.length} observación(es) abierta(s) que bloquean ${e.compuerta}`, referencias: abiertas.map((o) => o.id) });
  }
  return { compuerta: e.compuerta, bloqueada: razones.length > 0, razones };
}

/**
 * Fallos bloqueantes que siguen pendientes: los que no tienen una excepción aprobada vigente. Una excepción solo vale
 * para el valor que se aprobó; si el dato cambia, el fallo vuelve a bloquear.
 */
export function validacionesPendientes(resultados: readonly ResultadoValidacion[], observaciones: readonly Observacion[] = []): ValidacionPendiente[] {
  const excepciones = excepcionesVigentes(observaciones, resultados);
  return resultados
    .filter((r) => r.resultado === 'no_cumple' && r.severidad === 'bloqueante' && !excepciones.has(r.huella))
    .map((r) => ({ reglaId: r.reglaId, huella: r.huella, titulo: `${r.reglaNombre}: ${r.campo}` }));
}
