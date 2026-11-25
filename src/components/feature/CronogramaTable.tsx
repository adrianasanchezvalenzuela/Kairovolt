import { Link } from 'react-router-dom';
import type { Actividad, ActividadEvaluada, EstadoActividad } from '@/domain/cronograma/actividad';
import { StatusBadge } from '@/components/ui/StatusBadge';

const etiqueta: Record<EstadoActividad, { texto: string; tono: 'ok' | 'alerta' | 'error' | 'neutro' }> = {
  completada: { texto: 'Completada', tono: 'ok' },
  atrasada: { texto: 'Atrasada', tono: 'error' },
  en_curso: { texto: 'En curso', tono: 'alerta' },
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
};

export interface CronogramaTableProps {
  actividades: readonly ActividadEvaluada[];
  /** Si se da, agrega la columna «Proyecto» (para vistas de varios proyectos). Recibe la actividad. */
  proyectoDe?: (actividad: Actividad) => { folio: string; to: string } | undefined;
}

export function CronogramaTable({ actividades, proyectoDe }: CronogramaTableProps) {
  return (
    <div className="kv-tabla-scroll">
      <table aria-label="Cronograma">
        <thead>
          <tr>
            {proyectoDe && <th scope="col">Proyecto</th>}
            <th scope="col">Compuerta</th><th scope="col">Actividad</th><th scope="col">Responsable</th><th scope="col">Inicio plan</th><th scope="col">Fin plan</th><th scope="col">Fin real</th><th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {actividades.map(({ actividad: a, estado, diasRetraso }) => {
            const p = proyectoDe?.(a);
            return (
              <tr key={`${p?.folio ?? ''}-${a.id}`}>
                {proyectoDe && <td className="kv-mono kv-nowrap">{p ? <Link to={p.to}>{p.folio}</Link> : '—'}</td>}
                <td>{a.compuerta}</td>
                <td>{a.nombre}</td>
                <td>{a.responsable ?? <span className="kv-suave">Sin asignar</span>}</td>
                <td className="kv-mono">{a.inicioPlan}</td>
                <td className="kv-mono">{a.finPlan}</td>
                <td className="kv-mono">{a.finReal ?? '—'}</td>
                <td>
                  <StatusBadge tono={etiqueta[estado].tono}>{etiqueta[estado].texto}</StatusBadge>
                  {diasRetraso > 0 && <span className="kv-suave"> +{diasRetraso} d</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
