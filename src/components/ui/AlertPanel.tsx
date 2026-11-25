import type { ReactNode } from 'react';
import { cx } from './cx';
import { claseTono, type Tono } from './tipos';

export interface AlertPanelProps {
  tono?: Tono;
  titulo?: string;
  children?: ReactNode;
  /** Botones o enlaces bajo el texto. */
  acciones?: ReactNode;
  /** Si se da, aparece una «×» que lo invoca. */
  onCerrar?: () => void;
  variante?: 'bloque' | 'en-linea';
  /** `false` = no se anuncia a lectores de pantalla (para listas persistentes de alertas que ya estaban en la página). */
  anunciar?: boolean;
}

const SIMBOLO: Record<Tono, string> = { neutro: 'i', info: 'i', ok: '✓', alerta: '!', error: '!' };

/** Aviso con contexto. Los errores se anuncian de inmediato (`role="alert"`); el resto de forma cortés (`role="status"`). */
export function AlertPanel({ tono = 'info', titulo, children, acciones, onCerrar, variante = 'bloque', anunciar = true }: AlertPanelProps) {
  return (
    <div className={cx('kv-alerta', claseTono(tono), variante === 'en-linea' && 'kv-alerta--en-linea')} role={anunciar ? (tono === 'error' ? 'alert' : 'status') : undefined}>
      <span className="kv-alerta__icono" aria-hidden="true">{SIMBOLO[tono]}</span>
      <div className="kv-alerta__cuerpo">
        {titulo && <p className="kv-alerta__titulo">{titulo}</p>}
        {children && <div className="kv-alerta__texto">{children}</div>}
        {acciones && <div className="kv-alerta__acciones">{acciones}</div>}
      </div>
      {onCerrar && <button type="button" className="kv-alerta__cerrar" onClick={onCerrar} aria-label="Cerrar aviso">×</button>}
    </div>
  );
}
