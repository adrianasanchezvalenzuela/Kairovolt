import type { Tono } from '@/components/ui/tipos';

/** Modelo de vista de un proyecto para tarjetas y tablas. Lo arma la página; los componentes solo lo pintan. */
export interface ProyectoVista {
  id: string;
  folio: string;
  nombre: string;
  cliente: string;
  ubicacion: string;
  /** Destino al abrir el proyecto. */
  to: string;
  /** Avance del expediente; `null` = la fuente no lo trae (se muestra «No disponible», no 0%). */
  avance: { recibidos: number; total: number } | null;
  observaciones: { abiertas: number; vencidas: number };
  /** Estado general opcional (p. ej. compuerta actual). */
  estado?: { texto: string; tono: Tono };
  /** Compuerta en la que está (G0–G3) o «Completo». */
  etapa?: string;
  /** Validaciones bloqueantes sin resolver; `null` = no se pueden evaluar (expediente no disponible). */
  bloqueantes?: number | null;
  /** Datos de demostración. */
  demo?: boolean;
}
