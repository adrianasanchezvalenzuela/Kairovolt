import { NOMBRE_COMPUERTA, ORDEN_COMPUERTAS } from '@/domain/compuertas/compuerta';
import type { Proyecto } from '@/domain/proyecto/proyecto';

export interface EstadoIntegracionAdmin {
  modo: 'real' | 'demo';
  /** Texto para mostrar tal cual («CONECTADO A ZOHO» o «DEMO — NO CONECTADO…»). */
  etiqueta: string;
  persistencia: 'supabase' | 'memoria';
  servicios: { crm: boolean; projects: boolean; workdrive: boolean };
}

export interface RegistroSincronizacion {
  id: string;
  folio: string;
  destino: string;
  operacion: string;
  estado: 'ok' | 'error' | 'omitido';
  accion: string | null;
  error: string | null;
  categoriaError: string | null;
  creadoEn: string;
}

export interface PasoSincronizacion { clave: string; destino: string; operacion: string; estado: 'ok' | 'error' | 'omitido'; accion: string | null; error: string | null }

export interface ResultadoSimulacion {
  folio: string;
  modo: 'real' | 'simulado';
  etiqueta: string;
  ok: boolean;
  pasos: PasoSincronizacion[];
  advertencias: string[];
}

export interface TareaEnvio { clave: string; nombre: string; inicioPlan: string | null; finPlan: string | null; predecesora: string | null }

/** Puerto de la administración de la integración. Solo SIMULA: la escritura real no se ofrece desde la interfaz en esta fase. */
export interface IntegracionAdminRepositorio {
  estado(): Promise<EstadoIntegracionAdmin>;
  registro(folio?: string): Promise<RegistroSincronizacion[]>;
  simular(p: { folio: string; nombre: string; tareas: TareaEnvio[]; subcarpetas: string[] }): Promise<ResultadoSimulacion>;
}

/** Una tarea por compuerta con las fechas que abarcan sus actividades; cada una depende de la anterior. Sin fechas, queda en null. */
export function tareasDeCompuertas(p: Proyecto): TareaEnvio[] {
  return ORDEN_COMPUERTAS.map((g, i) => {
    const acts = p.cronograma.filter((a) => a.compuerta === g);
    return {
      clave: g, nombre: `${g} — ${NOMBRE_COMPUERTA[g]}`,
      inicioPlan: acts.length === 0 ? null : acts.map((a) => a.inicioPlan).sort()[0]!,
      finPlan: acts.length === 0 ? null : acts.map((a) => a.finPlan).sort().at(-1)!,
      predecesora: i === 0 ? null : ORDEN_COMPUERTAS[i - 1]!,
    };
  });
}
