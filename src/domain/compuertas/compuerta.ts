export type CompuertaId = 'G0' | 'G1' | 'G2' | 'G3';

export type EstadoCompuerta = 'pendiente' | 'en_revision' | 'liberada' | 'bloqueada';

export interface Compuerta {
  id: CompuertaId;
  estado: EstadoCompuerta;
}

/** Orden del proceso; única fuente de verdad del orden de compuertas. */
export const ORDEN_COMPUERTAS: readonly CompuertaId[] = ['G0', 'G1', 'G2', 'G3'];

export const NOMBRE_COMPUERTA: Record<CompuertaId, string> = {
  G0: 'Prefactibilidad y diagnóstico',
  G1: 'Acopio legal y documentación técnica',
  G2: 'Validación bloqueante',
  G3: 'Verificación UVIE, contratación y energización',
};
