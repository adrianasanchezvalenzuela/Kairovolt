import type { ReactNode } from 'react';
import { Boton } from './Boton';
import { cx } from './cx';

interface BaseProps {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  compacto?: boolean;
}

export interface EmptyStateProps extends BaseProps {
  /** Símbolo corto dentro del círculo (por defecto «∅»). */
  icono?: ReactNode;
}

/** Nada que mostrar (sin datos, sin resultados). Explica por qué y qué hacer. */
export function EmptyState({ titulo, descripcion, acciones, compacto, icono = '∅' }: EmptyStateProps) {
  return (
    <div className={cx('kv-estado', compacto && 'kv-estado--compacto')}>
      <span className="kv-estado__icono" aria-hidden="true">{icono}</span>
      <p className="kv-estado__titulo">{titulo}</p>
      {descripcion && <p className="kv-estado__texto">{descripcion}</p>}
      {acciones && <div className="kv-estado__acciones">{acciones}</div>}
    </div>
  );
}

export interface LoadingStateProps {
  etiqueta?: string;
  /** `linea` (en texto), `bloque` (reemplaza una sección) o `pagina` (pantalla completa). */
  variante?: 'linea' | 'bloque' | 'pagina';
}

export function LoadingState({ etiqueta = 'Cargando…', variante = 'bloque' }: LoadingStateProps) {
  return (
    <div className={cx('kv-cargando', variante !== 'linea' && `kv-cargando--${variante}`)} role="status" aria-live="polite">
      <span className="kv-giro" aria-hidden="true" />
      <span>{etiqueta}</span>
    </div>
  );
}

export interface ErrorStateProps extends BaseProps {
  /** Texto técnico (mensaje del servidor). Se muestra aparte y pequeño. */
  detalle?: string;
  onReintentar?: () => void;
  textoReintentar?: string;
}

export function ErrorState({ titulo, descripcion, detalle, acciones, onReintentar, textoReintentar = 'Reintentar', compacto }: ErrorStateProps) {
  return (
    <div className={cx('kv-estado', 'kv-estado--error', compacto && 'kv-estado--compacto')} role="alert">
      <span className="kv-estado__icono" aria-hidden="true">!</span>
      <p className="kv-estado__titulo">{titulo}</p>
      {descripcion && <p className="kv-estado__texto">{descripcion}</p>}
      {detalle && <p className="kv-estado__detalle kv-mono">{detalle}</p>}
      {(onReintentar || acciones) && (
        <div className="kv-estado__acciones">
          {onReintentar && <Boton variante="secundario" onClick={onReintentar}>{textoReintentar}</Boton>}
          {acciones}
        </div>
      )}
    </div>
  );
}
