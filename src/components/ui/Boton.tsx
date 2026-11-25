import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma' | 'sobre-oscuro';
  tamano?: 'sm' | 'md';
  /** Deshabilita y muestra un indicador; el texto sigue visible para lectores de pantalla. */
  cargando?: boolean;
  children: ReactNode;
}

/** Botón único del sistema. Siempre `type="button"` salvo que se indique otro. */
export function Boton({ variante = 'secundario', tamano = 'md', cargando = false, disabled, className, type = 'button', children, ...resto }: BotonProps) {
  return (
    <button {...resto} type={type} disabled={disabled || cargando} aria-busy={cargando || undefined} className={cx('kv-btn', `kv-btn--${variante}`, tamano === 'sm' && 'kv-btn--sm', className)}>
      {cargando && <span className="kv-btn__cargando" aria-hidden="true" />}
      {children}
    </button>
  );
}
