import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cx } from '@/components/ui/cx';
import type { Tono } from '@/components/ui/tipos';

export interface DocumentRowProps {
  nombre: string;
  /** Línea secundaria bajo el nombre (condición, fecha de emisión…). */
  detalle?: ReactNode;
  /** Obligatorio, condicional… */
  tipo?: ReactNode;
  /** Digital, físico/firma… */
  canal?: ReactNode;
  estado: { texto: string; tono: Tono };
  /** Nombre del archivo recibido, vigencia, enlace de vista previa… */
  archivo?: ReactNode;
  /** Botones de fila (si la tabla muestra la columna de acciones). */
  acciones?: ReactNode;
  atenuado?: boolean;
}

/** Fila de un documento dentro de un `DocumentTable`. */
export function DocumentRow({ nombre, detalle, tipo, canal, estado, archivo, acciones, atenuado }: DocumentRowProps) {
  return (
    <tr className={cx(atenuado && 'kv-doc--atenuado')}>
      <th scope="row">
        <span className="kv-doc__nombre">{nombre}</span>
        {detalle && <span className="kv-doc__detalle">{detalle}</span>}
      </th>
      <td>{tipo ?? '—'}</td>
      <td>{canal ?? '—'}</td>
      <td><StatusBadge tono={estado.tono}>{estado.texto}</StatusBadge></td>
      <td className="kv-suave">{archivo ?? '—'}</td>
      {acciones !== undefined && <td>{acciones}</td>}
    </tr>
  );
}

export interface DocumentTableProps {
  etiqueta: string;
  children: ReactNode;
  /** Muestra la columna de acciones (las filas deben pasar `acciones`). */
  conAcciones?: boolean;
  /** Fila final cuando no hay documentos. */
  vacio?: string;
}

export function DocumentTable({ etiqueta, children, conAcciones = false, vacio }: DocumentTableProps) {
  return (
    <div className="kv-tabla-scroll">
      <table className="kv-tabla-compacta" aria-label={etiqueta}>
        <thead>
          <tr>
            <th scope="col">Documento</th><th scope="col">Tipo</th><th scope="col">Canal</th><th scope="col">Estado</th><th scope="col">Archivo</th>
            {conAcciones && <th scope="col"><span className="kv-solo-lectores">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {children}
          {vacio && <tr><td colSpan={conAcciones ? 6 : 5} className="kv-suave">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
