import type { SeguimientoProyecto } from '@/application/seguimiento-proyecto';
import type { Observacion, SeguimientoObservacion } from '@/domain/observaciones/observacion';
import { Badge } from '@/components/ui/Badge';

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
  if (observaciones.length === 0) return <p className="kv-suave">Sin observaciones registradas.</p>;
  return (
    <table>
      <thead><tr><th>Compuerta</th><th>Origen</th><th>Observación</th><th>Responsable</th><th>Compromiso</th><th>Seguimiento</th>{onCerrar && <th />}</tr></thead>
      <tbody>
        {observaciones.map(({ observacion: o, seguimiento }) => (
          <tr key={o.id}>
            <td>{o.compuerta}</td>
            <td>{o.origen.toUpperCase()}</td>
            <td>{o.descripcion}</td>
            <td>{o.responsable ?? <span className="kv-suave">Sin asignar</span>}</td>
            <td className="kv-mono">{o.fechaCompromiso ?? '—'}</td>
            <td><Badge tono={etiqueta[seguimiento].tono}>{etiqueta[seguimiento].texto}</Badge></td>
            {onCerrar && <td>{o.estado !== 'cerrada' && <button disabled={ocupado} onClick={() => onCerrar(o)}>Cerrar</button>}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
