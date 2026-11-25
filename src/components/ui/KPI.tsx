import type { ReactNode } from 'react';
import { cx } from './cx';
import { claseTono, type Tono } from './tipos';

export interface KPIProps {
  etiqueta: string;
  /** `null` = sin dato (se muestra «—»; nunca un cero inventado). */
  valor: ReactNode | null;
  detalle?: ReactNode;
  /** Color del borde y, con `resaltarValor`, del número. */
  tono?: Tono;
  resaltarValor?: boolean;
  compacto?: boolean;
  /** Texto accesible cuando el valor es «—». */
  sinDato?: string;
}

/** Indicador numérico con etiqueta. Sustituye al antiguo `Indicador`. */
export function KPI({ etiqueta, valor, detalle, tono = 'ok', resaltarValor = false, compacto = false, sinDato = 'Sin dato' }: KPIProps) {
  return (
    <div className={cx('kv-kpi', claseTono(tono), compacto && 'kv-kpi--compacto')}>
      <p className="kv-kpi__etiqueta">{etiqueta}</p>
      <p className={cx('kv-kpi__valor', resaltarValor && 'kv-kpi__valor--tono')}>
        {valor === null ? <><span aria-hidden="true" className="kv-kpi__sin-dato">—</span><span className="kv-solo-lectores">{sinDato}</span></> : valor}
      </p>
      {detalle && <p className="kv-kpi__detalle">{detalle}</p>}
    </div>
  );
}

/** Rejilla responsiva para varios KPI. */
export function KPIGrid({ children, etiqueta }: { children: ReactNode; etiqueta?: string }) {
  return <div className="kv-kpis" role="group" aria-label={etiqueta}>{children}</div>;
}
