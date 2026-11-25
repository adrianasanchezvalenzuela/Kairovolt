import type { TiempoEntreHitos } from '@/domain/tiempos/tiempos';
import { EmptyState } from '@/components/ui/Estados';
import { StatusBadge } from '@/components/ui/StatusBadge';

/** Tiempos entre hitos reales. Una fecha contradictoria se señala; nunca se corrige. */
export function TiemposTabla({ tiempos, etiqueta = 'Tiempos entre hitos' }: { tiempos: readonly TiempoEntreHitos[]; etiqueta?: string }) {
  const conDatos = tiempos.filter((t) => t.desde !== null);
  if (conDatos.length === 0) return <EmptyState compacto titulo="Sin tiempos que medir" descripcion="Aún no hay hitos terminados que sirvan de punto de partida." />;
  return (
    <div className="kv-tabla-scroll">
      <table aria-label={etiqueta}>
        <thead><tr><th scope="col">Tramo</th><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col">Días</th><th scope="col">Hábiles</th><th scope="col">Estado</th></tr></thead>
        <tbody>
          {conDatos.map((t) => (
            <tr key={t.id}>
              <td>{t.etiqueta}</td>
              <td className="kv-mono">{t.desde}</td>
              <td className="kv-mono">{t.hasta ?? '—'}</td>
              <td>{t.dias}</td>
              <td>{t.diasHabiles}</td>
              <td>
                {t.inconsistente ? <StatusBadge tono="error">Fechas contradictorias: revisar</StatusBadge> : t.enCurso ? <StatusBadge tono="alerta">En curso (corre hasta hoy)</StatusBadge> : <StatusBadge tono="ok">Terminado</StatusBadge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
