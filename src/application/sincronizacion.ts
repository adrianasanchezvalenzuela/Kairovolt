import type { CompuertaId, EstadoCompuerta } from '@/domain/compuertas/compuerta';
import type { EstadoObservacion, OrigenObservacion } from '@/domain/observaciones/observacion';

export type ResultadoSincronizacion =
  | { tipo: 'simulado'; peticion: unknown }
  | { tipo: 'sin_cambios'; detalle: string }
  | { tipo: 'sincronizado'; detalle: string };

export interface CambioCompuerta {
  folio: string;
  compuerta: CompuertaId;
  estado: EstadoCompuerta;
  /** true: el backend arma la petición pero no escribe en Zoho. */
  simular?: boolean;
}

export interface EnvioObservacion {
  folio: string;
  /** Hace idempotente el envío: el mismo id + estado no se duplica en Zoho. */
  observacionId: string;
  compuerta: CompuertaId;
  origen: OrigenObservacion;
  estado: EstadoObservacion;
  descripcion: string;
  fechaCompromiso?: string | null;
  responsable?: string | null;
}

/** Error legible para el usuario (el backend ya no incluye secretos en sus mensajes). */
export class ErrorSincronizacion extends Error {}

export interface SincronizacionRepositorio {
  compuerta(cambio: CambioCompuerta): Promise<ResultadoSincronizacion>;
  observacion(envio: EnvioObservacion): Promise<ResultadoSincronizacion>;
}
