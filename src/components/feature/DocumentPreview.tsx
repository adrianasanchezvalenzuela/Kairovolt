import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/Estados';

export type TipoVistaPrevia = 'imagen' | 'pdf' | 'ninguno';

const EXT_IMAGEN = /\.(png|jpe?g|gif|webp|svg)$/i;

/** Qué se puede mostrar en línea según el tipo MIME o, si falta, la extensión. */
export function tipoVistaPrevia(mime: string | null | undefined, nombre: string): TipoVistaPrevia {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf' || (!m && /\.pdf$/i.test(nombre))) return 'pdf';
  if (m.startsWith('image/') || (!m && EXT_IMAGEN.test(nombre))) return 'imagen';
  return 'ninguno';
}

/** Solo http(s), blob: y rutas del propio sitio; descarta `javascript:`, `data:` y similares. */
export function urlSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^\/(?!\/)/.test(url) || /^blob:/i.test(url)) return url;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface DocumentPreviewProps {
  nombre: string;
  /** Si es `null` no hay archivo disponible (no se inventa una vista). */
  url: string | null;
  mime?: string | null;
  altura?: number;
  /** Botones de la barra (cerrar, descargar…). */
  acciones?: ReactNode;
}

export function DocumentPreview({ nombre, url, mime, altura = 460, acciones }: DocumentPreviewProps) {
  const segura = urlSegura(url);
  const tipo = tipoVistaPrevia(mime, nombre);

  return (
    <figure className="kv-vista" style={{ margin: 0 }}>
      <figcaption className="kv-vista__barra">
        <span className="kv-vista__nombre" title={nombre}>{nombre}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {segura && <a className="kv-btn kv-btn--secundario kv-btn--sm" href={segura} target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva<span className="kv-solo-lectores"> ({nombre})</span></a>}
          {acciones}
        </span>
      </figcaption>
      <div className="kv-vista__lienzo" style={{ height: altura }}>
        {!segura && <EmptyState compacto titulo="Sin archivo disponible" descripcion="El documento no tiene un enlace de consulta." />}
        {segura && tipo === 'imagen' && <img src={segura} alt={`Vista previa de ${nombre}`} />}
        {segura && tipo === 'pdf' && <iframe src={segura} title={`Vista previa de ${nombre}`} referrerPolicy="no-referrer" />}
        {segura && tipo === 'ninguno' && <EmptyState compacto titulo="Sin vista previa" descripcion="Este tipo de archivo no se puede mostrar aquí. Ábrelo en una pestaña nueva." />}
      </div>
    </figure>
  );
}
