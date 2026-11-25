import type { ReactNode } from 'react';
import { cx } from './cx';
import { claseTono, type Tono } from './tipos';

export interface StatusBadgeProps {
  tono?: Tono;
  /** `contorno` (por defecto), `suave` (fondo tenue) o `solido` (énfasis). */
  variante?: 'contorno' | 'suave' | 'solido';
  tamano?: 'sm' | 'md';
  /** Punto de color antes del texto. */
  punto?: boolean;
  children: ReactNode;
  title?: string;
}

/** Estado corto en texto (Recibido, Vencida, Bloqueante…). Sustituye al antiguo `Badge`. */
export function StatusBadge({ tono = 'neutro', variante = 'contorno', tamano = 'sm', punto = false, children, title }: StatusBadgeProps) {
  return (
    <span className={cx('kv-badge', claseTono(tono), variante !== 'contorno' && `kv-badge--${variante}`, tamano === 'md' && 'kv-badge--md')} title={title}>
      {punto && <span className="kv-badge__punto" aria-hidden="true" />}
      {children}
    </span>
  );
}
