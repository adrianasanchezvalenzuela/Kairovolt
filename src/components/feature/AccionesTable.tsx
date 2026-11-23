import type { AccionAcordada, EstadoAccion } from '@/domain/acciones/accion';
import type { PaerSemanal } from '@/domain/indicadores/paer';
import { cumpleMetaPaer } from '@/domain/indicadores/paer';
import { Badge } from '@/components/ui/Badge';

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
    <table>
      <thead><tr><th>Sesión</th><th>Acción acordada</th><th>Responsable</th><th>Estado</th></tr></thead>
      <tbody>
        {[...paerSemanal].reverse().flatMap(({ semana, resultado }) => [
          <tr key={`h-${semana}`} style={{ background: 'var(--kv-hielo)' }}>
            <td colSpan={4}>
              <strong className="kv-mono">{semana}</strong>{' · '}
              PAER {resultado.porcentaje === null ? 'N/A' : `${resultado.porcentaje}%`} ({resultado.completadas}/{resultado.total}){' '}
              {cumpleMetaPaer(resultado) === true && <Badge tono="ok">Cumple meta</Badge>}
              {cumpleMetaPaer(resultado) === false && <Badge tono="alerta">Bajo la meta</Badge>}
            </td>
          </tr>,
          ...acciones.filter((a) => a.semana === semana).map((a) => (
            <tr key={a.id}>
              <td />
              <td>{a.descripcion}</td>
              <td>{a.responsable ?? <span className="kv-suave">Sin asignar</span>}</td>
              <td><Badge tono={etiqueta[a.estado].tono}>{etiqueta[a.estado].texto}</Badge></td>
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}
