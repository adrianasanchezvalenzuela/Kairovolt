import { NOMBRE_COMPUERTA, type Compuerta, type CompuertaId, type EstadoCompuerta } from '@/domain/compuertas/compuerta';
import type { ResumenCompuerta } from '@/domain/checklist/checklist';
import type { Tono } from '@/components/ui/tipos';
import { StageGateStepper } from './StageGateStepper';

export const ETIQUETA_ESTADO_COMPUERTA: Record<EstadoCompuerta, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  liberada: 'Liberada',
  bloqueada: 'Bloqueada',
};
export const TONO_ESTADO_COMPUERTA: Record<EstadoCompuerta, Tono> = { pendiente: 'neutro', en_revision: 'alerta', liberada: 'ok', bloqueada: 'error' };

interface Props {
  compuertas: readonly Compuerta[];
  resumenes: readonly ResumenCompuerta[];
  seleccionada: CompuertaId;
  onSeleccionar: (id: CompuertaId) => void;
}

/** Adaptador: convierte las compuertas del dominio en pasos para `StageGateStepper`. */
export function GateStepper({ compuertas, resumenes, seleccionada, onSeleccionar }: Props) {
  return (
    <StageGateStepper
      etiqueta="Compuertas del proyecto"
      seleccionadoId={seleccionada}
      onSeleccionar={(id) => onSeleccionar(id as CompuertaId)}
      pasos={compuertas.map((c) => {
        const r = resumenes.find((x) => x.compuerta === c.id);
        return {
          id: c.id, titulo: NOMBRE_COMPUERTA[c.id], tono: TONO_ESTADO_COMPUERTA[c.estado], estado: ETIQUETA_ESTADO_COMPUERTA[c.estado],
          progreso: r ? `${r.recibidosObligatorios}/${r.totalObligatorios} documentos` : '—',
        };
      })}
    />
  );
}
