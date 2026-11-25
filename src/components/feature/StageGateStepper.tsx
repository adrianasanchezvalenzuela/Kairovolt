import { StatusBadge } from '@/components/ui/StatusBadge';
import { cx } from '@/components/ui/cx';
import { claseTono, type Tono } from '@/components/ui/tipos';

export interface PasoCompuerta {
  id: string;
  titulo: string;
  descripcion?: string;
  tono: Tono;
  /** Texto del estado (siempre visible: el color no es la única señal). */
  estado: string;
  /** Ej.: «3/5 documentos». */
  progreso?: string;
}

export interface StageGateStepperProps {
  pasos: readonly PasoCompuerta[];
  etiqueta: string;
  seleccionadoId?: string;
  /** Si se omite, los pasos son solo informativos (no son botones). */
  onSeleccionar?: (id: string) => void;
  orientacion?: 'horizontal' | 'vertical';
}

/** Línea de compuertas (G0–G3). Genérico: no conoce reglas de negocio, solo pinta lo que recibe. */
export function StageGateStepper({ pasos, etiqueta, seleccionadoId, onSeleccionar, orientacion = 'horizontal' }: StageGateStepperProps) {
  return (
    <ol className={cx('kv-pasos', orientacion === 'vertical' && 'kv-pasos--vertical')} aria-label={etiqueta}>
      {pasos.map((p) => {
        const activo = p.id === seleccionadoId;
        const contenido = (
          <>
            <span className="kv-paso__cabecera">
              <span className="kv-paso__id">{p.id}</span>
              <StatusBadge tono={p.tono}>{p.estado}</StatusBadge>
            </span>
            <span className="kv-paso__descripcion" style={{ display: 'block' }}>{p.titulo}</span>
            {p.descripcion && <span className="kv-paso__progreso" style={{ display: 'block' }}>{p.descripcion}</span>}
            {p.progreso && <span className="kv-paso__progreso" style={{ display: 'block' }}>{p.progreso}</span>}
          </>
        );
        return (
          <li key={p.id} className={cx('kv-paso', claseTono(p.tono), activo && 'kv-paso--activo')}>
            {onSeleccionar
              ? <button type="button" className="kv-paso__caja" aria-current={activo ? 'step' : undefined} onClick={() => onSeleccionar(p.id)}>{contenido}</button>
              : <div className="kv-paso__caja" aria-current={activo ? 'step' : undefined}>{contenido}</div>}
          </li>
        );
      })}
    </ol>
  );
}
