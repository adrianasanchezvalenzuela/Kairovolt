import type { SeguimientoProyecto } from '@/application/seguimiento-proyecto';
import type { Observacion, SeguimientoObservacion } from '@/domain/observaciones/observacion';
import { EmptyState } from '@/components/ui/Estados';
import { Boton } from '@/components/ui/Boton';
import { StatusBadge } from '@/components/ui/StatusBadge';

const etiqueta: Record<SeguimientoObservacion, { texto: string; tono: 'ok' | 'alerta' | 'error' | 'neutro' }> = {
  cerrada: { texto: 'Cerrada', tono: 'ok' },
  vencida: { texto: 'Vencida', tono: 'error' },
  sin_compromiso: { texto: 'Sin fecha compromiso', tono: 'alerta' },
  en_plazo: { texto: 'En plazo', tono: 'neutro' },
};

interface Props {
  observaciones: SeguimientoProyecto['observaciones'];
  /** Si se da, cada observación abierta muestra el botón "Cerrar". */
  onCerrar?: (o: Observacion) => void;
  ocupado?: boolean;
}

export function ObservacionesTable({ observaciones, onCerrar, ocupado }: Props) {
  if (observaciones.length === 0) return <EmptyState compacto titulo="Sin observaciones" descripcion="Aún no hay observaciones registradas para este proyecto." />;
  return (
    <div className="kv-tabla-scroll"><table className="kv-tabla-compacta">
      <thead><tr><th>Compuerta</th><th>Origen</th><th>Observación</th><th>Responsable</th><th>Compromiso</th><th>Seguimiento</th>{onCerrar && <th />}</tr></thead>
      <tbody>
        {observaciones.map(({ observacion: o, seguimiento }) => (
          <tr key={o.id}>
            <td><span className="kv-mono">{o.compuerta}</span></td>
            <td><StatusBadge tono="neutro">{o.origen.toUpperCase()}</StatusBadge></td>
            <td>{o.descripcion}</td>
            <td>{o.responsable ?? <span className="kv-suave">Sin asignar</span>}</td>
            <td className="kv-mono">{o.fechaCompromiso ?? '—'}</td>
            <td><StatusBadge tono={etiqueta[seguimiento].tono}>{etiqueta[seguimiento].texto}</StatusBadge></td>
            {onCerrar && <td>{o.estado !== 'cerrada' && <Boton tamano="sm" disabled={ocupado} onClick={() => onCerrar(o)}>Cerrar</Boton>}</td>}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
