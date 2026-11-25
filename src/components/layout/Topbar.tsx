import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '@/components/ui/Boton';
import { cx } from '@/components/ui/cx';

export interface TopbarProps {
  /** Nombre y destino de la marca (se oculta en pantallas anchas si hay Sidebar). */
  marca?: { texto: string; to: string };
  subtitulo?: string;
  /** Si se da, aparece el botón de menú (solo en pantallas angostas). */
  onMenu?: () => void;
  menuAbierto?: boolean;
  menuControla?: string;
  variante?: 'claro' | 'oscuro';
  /** Contenido de la derecha: estado de datos, usuario, sesión. */
  children?: ReactNode;
}

export function Topbar({ marca, subtitulo, onMenu, menuAbierto = false, menuControla = 'kv-sidebar', variante = 'claro', children }: TopbarProps) {
  return (
    <header className={cx('kv-topbar', variante === 'oscuro' && 'kv-topbar--oscuro')}>
      {onMenu && (
        <Boton className="kv-topbar__menu" variante="secundario" tamano="sm" onClick={onMenu} aria-expanded={menuAbierto} aria-controls={menuControla} aria-label="Abrir menú de navegación">☰</Boton>
      )}
      {marca && <Link to={marca.to} className="kv-topbar__marca">{marca.texto}</Link>}
      {subtitulo && <span className="kv-topbar__sub">{subtitulo}</span>}
      <div className="kv-topbar__derecha">{children}</div>
    </header>
  );
}
