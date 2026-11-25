import type { CompuertaId } from './compuerta';

/** Quién liberó una compuerta y cuándo. Es un dato HUMANO: el sistema nunca aprueba por su cuenta. */
export interface AprobacionCompuerta {
  compuerta: CompuertaId;
  /** Nombre (o rol) de quien aprobó. */
  aprobadoPor: string;
  /** ISO YYYY-MM-DD. */
  fecha: string;
  comentario?: string | null;
}
