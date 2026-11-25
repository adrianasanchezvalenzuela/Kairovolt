import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cx } from '@/components/ui/cx';

export interface ItemNav {
  to: string;
  etiqueta: string;
  /** Símbolo corto decorativo (el texto siempre está). */
  icono?: ReactNode;
  /** Solo activo con la ruta exacta (útil para «/»). */
  exacto?: boolean;
}
export interface SeccionNav { titulo?: string; items: readonly ItemNav[] }

export interface SidebarProps {
  marca: string;
  subtitulo?: string;
  /** Destino del logotipo. */
  inicio?: string;
  secciones: readonly SeccionNav[];
  /** En pantallas angostas es un panel deslizable; en anchas siempre está visible. */
  abierto?: boolean;
  onCerrar?: () => void;
  pie?: ReactNode;
  /** Id del panel (lo referencia el botón de menú con `aria-controls`). */
  id?: string;
}

/** Navegación lateral. Quien lo usa decide qué ítems mostrar (permisos incluidos): aquí no hay reglas de negocio. */
export function Sidebar({ marca, subtitulo, inicio = '/', secciones, abierto = false, onCerrar, pie, id = 'kv-sidebar' }: SidebarProps) {
  useEffect(() => {
    if (!abierto || !onCerrar) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, onCerrar]);

  return (
    <>
      {abierto && onCerrar && <button type="button" className="kv-sidebar__velo" onClick={onCerrar} aria-label="Cerrar menú" tabIndex={-1} />}
      <aside id={id} className={cx('kv-sidebar', abierto && 'kv-sidebar--abierto')}>
        <Link to={inicio} className="kv-sidebar__marca" onClick={onCerrar}>
          {marca}
          {subtitulo && <small>{subtitulo}</small>}
        </Link>
        <nav aria-label="Navegación principal">
          {secciones.map((s, i) => (
            <div key={s.titulo ?? i} className="kv-sidebar__seccion">
              {s.titulo && <p className="kv-sidebar__titulo">{s.titulo}</p>}
              <ul className="kv-sidebar__lista">
                {s.items.map((it) => (
                  <li key={it.to}>
                    <NavLink to={it.to} end={it.exacto ?? false} className="kv-sidebar__enlace" onClick={onCerrar}>
                      {it.icono && <span className="kv-sidebar__icono" aria-hidden="true">{it.icono}</span>}
                      {it.etiqueta}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {pie && <div className="kv-sidebar__pie">{pie}</div>}
      </aside>
    </>
  );
}
