import { cx } from './cx';
import { claseTono, type Tono } from './tipos';

export interface ProgressBarProps {
  /** Cantidad lograda y total; con total 0 se muestra «Sin datos». */
  valor: number;
  total: number;
  etiqueta: string;
  tono?: Tono;
  grueso?: boolean;
  /** Texto a la derecha; por defecto «valor/total». */
  texto?: string;
}

export function ProgressBar({ valor, total, etiqueta, tono = 'ok', grueso = false, texto }: ProgressBarProps) {
  const pct = total <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((valor / total) * 100)));
  return (
    <div className={cx('kv-progreso', claseTono(tono), grueso && 'kv-progreso--grueso')}>
      <div className="kv-progreso__pista" role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={total <= 0 ? 'Sin datos' : `${pct}% (${valor} de ${total})`}>
        <div className="kv-progreso__barra" style={{ width: `${pct}%` }} />
      </div>
      <span className="kv-progreso__texto">{texto ?? (total <= 0 ? 'Sin datos' : `${valor}/${total}`)}</span>
    </div>
  );
}
