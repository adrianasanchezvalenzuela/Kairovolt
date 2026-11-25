import type { ResumenCompuerta } from '../checklist/checklist';
import { ORDEN_COMPUERTAS, type Compuerta, type CompuertaId, type EstadoCompuerta } from '../compuertas/compuerta';

/**
 * REGLAS EXPLÍCITAS DEL PORCENTAJE DE AVANCE QUE VE EL CLIENTE
 *
 *  1. El proceso tiene 4 etapas (G0–G3). Cada una pesa `PESO_ETAPA` (SUPUESTO: pesos iguales, por confirmar con IDC).
 *  2. Una etapa LIBERADA vale 100 %.
 *  3. Una etapa NO liberada vale (documentos obligatorios recibidos ÷ documentos obligatorios) × 100, redondeado hacia abajo,
 *     con tope `TOPE_ETAPA_NO_LIBERADA` (95 %): el 100 % solo se alcanza cuando IDC libera la etapa.
 *     Una etapa sin documentos obligatorios definidos vale 0 hasta que se libere.
 *  4. Si la fuente NO trae el expediente (no hay checklist), una etapa no liberada no se puede medir: cuenta 0 y el avance se marca
 *     como APROXIMADO (`exacto: false`), calculado solo con las etapas completadas.
 *  5. Avance global = promedio ponderado de las 4 etapas, redondeado al entero más cercano. Es 100 solo con las 4 etapas liberadas.
 *
 * El porcentaje no depende de observaciones, validaciones ni de ningún dato interno de IDC.
 */
export const PESO_ETAPA: Readonly<Record<CompuertaId, number>> = { G0: 25, G1: 25, G2: 25, G3: 25 };
export const TOPE_ETAPA_NO_LIBERADA = 95;

export const REGLAS_AVANCE: readonly string[] = [
  'El trámite tiene 4 etapas con el mismo peso.',
  'Una etapa completada vale 100 %.',
  'Una etapa en curso vale los documentos obligatorios recibidos entre los que le corresponden, sin pasar de 95 %: el 100 % lo da la liberación de la etapa por parte de IDC.',
  'El avance total es el promedio de las 4 etapas.',
];

export interface AvanceEtapa {
  compuerta: CompuertaId;
  estado: EstadoCompuerta;
  /** null = no se puede medir (la fuente no trae el expediente). */
  porcentaje: number | null;
  recibidos: number | null;
  total: number | null;
}

export interface AvancePortal {
  /** 0–100. */
  porcentaje: number;
  /** false = calculado solo con las etapas completadas porque no hay expediente que medir. */
  exacto: boolean;
  etapas: AvanceEtapa[];
}

export interface EntradaAvance {
  compuertas: readonly Compuerta[];
  /** null/ausente = la fuente no trae el expediente. */
  checklist: readonly ResumenCompuerta[] | null;
  pesos?: Readonly<Record<CompuertaId, number>>;
  tope?: number;
}

export function calcularAvance({ compuertas, checklist, pesos = PESO_ETAPA, tope = TOPE_ETAPA_NO_LIBERADA }: EntradaAvance): AvancePortal {
  const etapas = ORDEN_COMPUERTAS.map((id): AvanceEtapa => {
    const estado = compuertas.find((c) => c.id === id)?.estado ?? 'pendiente';
    const r = checklist?.find((x) => x.compuerta === id);
    if (estado === 'liberada') return { compuerta: id, estado, porcentaje: 100, recibidos: r?.recibidosObligatorios ?? null, total: r?.totalObligatorios ?? null };
    if (!r) return { compuerta: id, estado, porcentaje: null, recibidos: null, total: null };
    const porcentaje = r.totalObligatorios === 0 ? 0 : Math.min(tope, Math.floor((r.recibidosObligatorios / r.totalObligatorios) * 100));
    return { compuerta: id, estado, porcentaje, recibidos: r.recibidosObligatorios, total: r.totalObligatorios };
  });
  const pesoTotal = ORDEN_COMPUERTAS.reduce((s, id) => s + pesos[id], 0);
  const suma = etapas.reduce((s, e) => s + (e.porcentaje ?? 0) * pesos[e.compuerta], 0);
  return {
    porcentaje: pesoTotal === 0 ? 0 : Math.round(suma / pesoTotal),
    exacto: checklist !== null && checklist.length > 0,
    etapas,
  };
}
