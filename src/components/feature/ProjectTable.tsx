import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/Estados';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ProyectoVista } from './ProyectoVista';

export interface ProjectTableProps {
  proyectos: readonly ProyectoVista[];
  /** Descripción accesible de la tabla. */
  etiqueta?: string;
}

export function ProjectTable({ proyectos, etiqueta = 'Proyectos' }: ProjectTableProps) {
  const conEtapa = proyectos.some((p) => p.etapa !== undefined);
  if (proyectos.length === 0) return <EmptyState titulo="No hay proyectos" descripcion="No hay proyectos con folio KV en la fuente de datos." />;
  return (
    <div className="kv-tabla-scroll">
      <table className="kv-tabla--filas-enlace" aria-label={etiqueta}>
        <thead>
          <tr><th scope="col">Folio KV</th><th scope="col">Proyecto</th><th scope="col">Cliente</th>{conEtapa && <th scope="col">Etapa</th>}<th scope="col">Expediente</th>{conEtapa && <th scope="col">Bloqueantes</th>}<th scope="col">Observaciones</th></tr>
        </thead>
        <tbody>
          {proyectos.map((p) => (
            <tr key={p.id}>
              <td className="kv-mono kv-nowrap">{p.folio}</td>
              <td><Link to={p.to}>{p.nombre}</Link>{p.estado && <> <StatusBadge tono={p.estado.tono}>{p.estado.texto}</StatusBadge></>}</td>
              <td>{p.cliente}</td>
              {conEtapa && <td>{p.etapa}</td>}
              <td>
                {p.avance
                  ? <ProgressBar valor={p.avance.recibidos} total={p.avance.total} etiqueta={`Expediente de ${p.nombre}`} texto={`${p.avance.recibidos}/${p.avance.total}`} />
                  : <span className="kv-suave">No disponible</span>}
              </td>
              {conEtapa && (
                <td>{p.bloqueantes == null ? <span className="kv-suave">No evaluable</span> : <StatusBadge tono={p.bloqueantes > 0 ? 'error' : 'ok'} variante={p.bloqueantes > 0 ? 'solido' : 'suave'}>{p.bloqueantes}</StatusBadge>}</td>
              )}
              <td>
                {p.observaciones.abiertas} abiertas
                {p.observaciones.vencidas > 0 && <> <StatusBadge tono="error" variante="suave">{p.observaciones.vencidas} vencidas</StatusBadge></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
