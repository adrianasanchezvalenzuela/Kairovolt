import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Miga { etiqueta: string; to?: string }

export interface PageHeaderProps {
  titulo: string;
  /** Línea bajo el título (folio, ubicación, fuente de datos…). */
  meta?: ReactNode;
  migas?: readonly Miga[];
  /** Botones o enlaces a la derecha. */
  acciones?: ReactNode;
}

export function PageHeader({ titulo, meta, migas, acciones }: PageHeaderProps) {
  return (
    <header className="kv-pagina-enc">
      <div className="kv-pagina-enc__texto">
        {migas && migas.length > 0 && (
          <nav aria-label="Ruta de navegación">
            <ol className="kv-pagina-enc__migas">
              {migas.map((m, i) => (
                <li key={`${i}-${m.etiqueta}`} aria-current={i === migas.length - 1 ? 'page' : undefined}>
                  {m.to && i < migas.length - 1 ? <Link to={m.to}>{m.etiqueta}</Link> : m.etiqueta}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1>{titulo}</h1>
        {meta && <p className="kv-pagina-enc__meta">{meta}</p>}
      </div>
      {acciones && <div className="kv-pagina-enc__acciones">{acciones}</div>}
    </header>
  );
}
