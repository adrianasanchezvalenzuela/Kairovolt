import type { ActividadEvaluada, EstadoActividad } from '@/domain/cronograma/actividad';
import { Badge } from '@/components/ui/Badge';

const etiqueta: Record<EstadoActividad, { texto: string; tono: 'ok' | 'alerta' | 'error' | 'neutro' }> = {
  completada: { texto: 'Completada', tono: 'ok' },
  atrasada: { texto: 'Atrasada', tono: 'error' },
  en_curso: { texto: 'En curso', tono: 'alerta' },
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
};

export function CronogramaTable({ actividades }: { actividades: readonly ActividadEvaluada[] }) {
  return (
    <table>
      <thead><tr><th>Compuerta</th><th>Actividad</th><th>Inicio plan</th><th>Fin plan</th><th>Fin real</th><th>Estado</th></tr></thead>
      <tbody>
        {actividades.map(({ actividad: a, estado, diasRetraso }) => (
          <tr key={a.id}>
            <td>{a.compuerta}</td>
            <td>{a.nombre}</td>
            <td className="kv-mono">{a.inicioPlan}</td>
            <td className="kv-mono">{a.finPlan}</td>
            <td className="kv-mono">{a.finReal ?? '—'}</td>
            <td>
              <Badge tono={etiqueta[estado].tono}>{etiqueta[estado].texto}</Badge>
              {diasRetraso > 0 && <span className="kv-suave"> +{diasRetraso} d</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
