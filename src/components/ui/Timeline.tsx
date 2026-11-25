import type { ReactNode } from 'react';
import { cx } from './cx';
import { claseTono, type Tono } from './tipos';

export interface EventoLinea {
  id: string;
  titulo: ReactNode;
  /** ISO `YYYY-MM-DD` (o texto libre ya formateado). */
  fecha?: string | null;
  descripcion?: ReactNode;
  tono?: Tono;
  /** Insignia junto al título. */
  estado?: ReactNode;
  /** Punto relleno = ya ocurrió. */
  hecho?: boolean;
}

export interface TimelineProps {
  eventos: readonly EventoLinea[];
  etiqueta: string;
  /** Por defecto respeta el orden recibido. */
  orden?: 'dado' | 'reciente-primero' | 'antiguo-primero';
}

const clave = (e: EventoLinea) => e.fecha ?? '';

export function Timeline({ eventos, etiqueta, orden = 'dado' }: TimelineProps) {
  const lista = orden === 'dado' ? eventos : [...eventos].sort((a, b) => (orden === 'antiguo-primero' ? clave(a).localeCompare(clave(b)) : clave(b).localeCompare(clave(a))));
  return (
    <ol className="kv-linea" aria-label={etiqueta}>
      {lista.map((e) => (
        <li key={e.id} className={cx('kv-linea__item', claseTono(e.tono ?? 'neutro'), e.hecho && 'kv-linea__item--hecho')}>
          <span className="kv-linea__punto" aria-hidden="true" />
          <div>
            {e.fecha && <time className="kv-linea__fecha" dateTime={e.fecha}>{e.fecha}</time>}
            <p className="kv-linea__titulo">{e.titulo}{e.estado}</p>
            {e.descripcion && <p className="kv-linea__texto">{e.descripcion}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
