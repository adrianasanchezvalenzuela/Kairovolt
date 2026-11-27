import type { AccionAcordada, EstadoAccion } from '@/domain/acciones/accion';
import type { PaerSemanal } from '@/domain/indicadores/paer';
import { cumpleMetaPaer } from '@/domain/indicadores/paer';
import { StatusBadge } from '@/components/ui/StatusBadge';

const etiqueta: Record<EstadoAccion, { texto: string; tono: 'ok' | 'alerta' | 'error' }> = {
  completada: { texto: 'Completada', tono: 'ok' },
  pendiente: { texto: 'Pendiente', tono: 'alerta' },
  no_realizada: { texto: 'No realizada', tono: 'error' },
};

interface Props {
  acciones: readonly AccionAcordada[];
  paerSemanal: readonly PaerSemanal[];
}

export function AccionesTable({ acciones, paerSemanal }: Props) {
  if (paerSemanal.length === 0) return <p className="kv-suave">Sin acciones acordadas.</p>;
  return (
    <div className="kv-tabla-scroll"><table className="kv-tabla-compacta">
      <thead><tr><th>Sesión</th><th>Acción acordada</th><th>Responsable</th><th>Estado</th></tr></thead>
      <tbody>
        {[...paerSemanal].reverse().flatMap(({ semana, resultado }) => [
          <tr key={`h-${semana}`} style={{ background: 'var(--kv-hielo)' }}>
            <td colSpan={4}>
              <strong className="kv-mono">{semana}</strong>{' · '}
              PAER {resultado.porcentaje === null ? 'N/A' : `${resultado.porcentaje}%`} ({resultado.completadas}/{resultado.total}){' '}
              {cumpleMetaPaer(resultado) === true && <StatusBadge tono="ok">Cumple meta</StatusBadge>}
              {cumpleMetaPaer(resultado) === false && <StatusBadge tono="alerta">Bajo la meta</StatusBadge>}
            </td>
          </tr>,
          ...acciones.filter((a) => a.semana === semana).map((a) => (
            <tr key={a.id}>
              <td />
              <td>{a.descripcion}</td>
              <td>{a.responsable ?? <span className="kv-suave">Sin asignar</span>}</td>
              <td><StatusBadge tono={etiqueta[a.estado].tono}>{etiqueta[a.estado].texto}</StatusBadge></td>
            </tr>
          )),
        ])}
      </tbody>
    </table></div>
  );
}
