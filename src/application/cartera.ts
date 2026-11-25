import { NOMBRE_COMPUERTA, ORDEN_COMPUERTAS, type CompuertaId } from '@/domain/compuertas/compuerta';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import type { Severidad } from '@/domain/reglas/tipos';
import { ORDEN_SEVERIDAD } from '@/domain/reglas/tipos';
import { calcularPaer, type ResultadoPaer } from '@/domain/indicadores/paer';
import { calcularPpc, type ResultadoPpc } from '@/domain/indicadores/ppc';
import type { AnalisisProyecto } from './analizar-proyecto';

/** Un proyecto con las decisiones aplicadas y su análisis. */
export interface ItemCartera {
  proyecto: Proyecto;
  analisis: AnalisisProyecto;
}

/** Días sin ningún hito terminado a partir de los cuales se avisa. SUPUESTO por confirmar con IDC. */
export const UMBRAL_SIN_MOVIMIENTO_DIAS = 14;

export type TipoAlerta = 'validacion_bloqueante' | 'compuerta_bloqueada' | 'observacion_vencida' | 'observacion_sin_compromiso' | 'actividad_atrasada' | 'sin_movimiento';

export interface AlertaOperativa {
  id: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  folio: string;
  proyectoId: string;
  proyecto: string;
  /** Ruta con la pestaña donde se atiende. */
  to: string;
}

const ruta = (p: Proyecto, tab: string) => `/proyectos/${encodeURIComponent(p.id)}?tab=${tab}`;

/** Alertas que requieren acción de una persona. Orden: severidad y, dentro de ella, folio. */
export function alertasDeProyecto({ proyecto: p, analisis: a }: ItemCartera): AlertaOperativa[] {
  const base = { folio: p.folio, proyectoId: p.id, proyecto: p.nombre };
  const alertas: AlertaOperativa[] = [];

  for (const v of a.pendientes) {
    alertas.push({ ...base, id: `${p.id}:val:${v.huella}`, tipo: 'validacion_bloqueante', severidad: 'bloqueante', titulo: v.titulo, detalle: 'Validación bloqueante sin resolver ni excepción aprobada.', to: `${ruta(p, 'validaciones')}&huella=${encodeURIComponent(v.huella)}` });
  }
  for (const c of p.compuertas.filter((x) => x.estado === 'bloqueada')) {
    alertas.push({ ...base, id: `${p.id}:gate:${c.id}`, tipo: 'compuerta_bloqueada', severidad: 'bloqueante', titulo: `${c.id} bloqueada`, detalle: NOMBRE_COMPUERTA[c.id], to: ruta(p, 'resumen') });
  }
  for (const { observacion: o, seguimiento } of a.seguimiento.observaciones) {
    if (seguimiento === 'vencida') alertas.push({ ...base, id: `${p.id}:obs:${o.id}`, tipo: 'observacion_vencida', severidad: 'mayor', titulo: `Observación vencida (${o.compuerta})`, detalle: o.descripcion, to: ruta(p, 'validaciones') });
    if (seguimiento === 'sin_compromiso') alertas.push({ ...base, id: `${p.id}:obs:${o.id}`, tipo: 'observacion_sin_compromiso', severidad: 'menor', titulo: `Observación sin fecha comprometida (${o.compuerta})`, detalle: o.descripcion, to: ruta(p, 'validaciones') });
  }
  for (const e of a.seguimiento.actividades.filter((x) => x.estado === 'atrasada')) {
    alertas.push({ ...base, id: `${p.id}:act:${e.actividad.id}`, tipo: 'actividad_atrasada', severidad: 'mayor', titulo: `Actividad atrasada ${e.diasRetraso} d (${e.actividad.compuerta})`, detalle: e.actividad.nombre, to: ruta(p, 'cronograma') });
  }
  const sinMov = a.tiempos?.diasSinMovimiento;
  if (sinMov != null && sinMov >= UMBRAL_SIN_MOVIMIENTO_DIAS) {
    alertas.push({ ...base, id: `${p.id}:mov`, tipo: 'sin_movimiento', severidad: 'menor', titulo: `${sinMov} días sin que termine ningún hito`, detalle: `Umbral de aviso: ${UMBRAL_SIN_MOVIMIENTO_DIAS} días (supuesto).`, to: ruta(p, 'cronograma') });
  }
  return alertas;
}

export function alertasOperativas(items: readonly ItemCartera[]): AlertaOperativa[] {
  return items.flatMap(alertasDeProyecto).sort((x, y) => ORDEN_SEVERIDAD[x.severidad] - ORDEN_SEVERIDAD[y.severidad] || x.folio.localeCompare(y.folio) || x.id.localeCompare(y.id));
}

/** Etapa actual: la primera compuerta que aún no está liberada; null si todas lo están. */
export function compuertaActual(p: Proyecto): CompuertaId | null {
  return ORDEN_COMPUERTAS.find((id) => p.compuertas.find((c) => c.id === id)?.estado !== 'liberada') ?? null;
}

export interface ResumenCartera {
  proyectos: number;
  conBloqueantes: number;
  bloqueantesTotales: number;
  observacionesAbiertas: number;
  observacionesVencidas: number;
  actividadesAtrasadas: number;
  /** PPC acumulado de TODAS las actividades de la cartera (cociente de totales, no promedio de porcentajes). */
  ppc: ResultadoPpc;
  paer: ResultadoPaer;
  /** Proyectos cuyo expediente no se pudo evaluar (la fuente no lo trae). */
  sinExpediente: number;
}

export function resumirCartera(items: readonly ItemCartera[], hoy: string): ResumenCartera {
  return {
    proyectos: items.length,
    conBloqueantes: items.filter((i) => i.analisis.pendientes.length > 0).length,
    bloqueantesTotales: items.reduce((n, i) => n + i.analisis.pendientes.length, 0),
    observacionesAbiertas: items.reduce((n, i) => n + i.analisis.seguimiento.resumenObservaciones.abiertas, 0),
    observacionesVencidas: items.reduce((n, i) => n + i.analisis.seguimiento.resumenObservaciones.vencidas, 0),
    actividadesAtrasadas: items.reduce((n, i) => n + i.analisis.seguimiento.actividades.filter((e) => e.estado === 'atrasada').length, 0),
    ppc: calcularPpc(items.flatMap((i) => i.proyecto.cronograma), hoy),
    paer: calcularPaer(items.flatMap((i) => i.proyecto.acciones)),
    sinExpediente: items.filter((i) => !i.analisis.disponible).length,
  };
}
