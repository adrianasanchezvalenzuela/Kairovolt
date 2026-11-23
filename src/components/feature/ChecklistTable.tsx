import type { ResumenCompuerta, DecisionCompuerta } from '@/domain/checklist/checklist';
import { Badge } from '@/components/ui/Badge';

interface Props {
  resumen: ResumenCompuerta;
  decision: DecisionCompuerta;
}

export function ChecklistTable({ resumen, decision }: Props) {
  return (
    <>
      <table>
        <thead><tr><th>Requisito</th><th>Tipo</th><th>Canal</th><th>Estado</th><th>Documento</th></tr></thead>
        <tbody>
          {resumen.items.map(({ requisito, documento }) => (
            <tr key={requisito.id}>
              <td>{requisito.nombre}</td>
              <td>{requisito.obligatorio ? 'Obligatorio' : <span title={requisito.condicion}>Condicional</span>}</td>
              <td>{requisito.canal === 'fisico' ? <Badge tono="alerta">Físico / firma</Badge> : 'Digital'}</td>
              <td>{documento ? <Badge tono="ok">Recibido</Badge> : <Badge tono={requisito.obligatorio ? 'error' : 'neutro'}>Faltante</Badge>}</td>
              <td className="kv-suave">{documento?.nombre ?? requisito.condicion ?? '—'}</td>
            </tr>
          ))}
          {resumen.items.length === 0 && (
            <tr><td colSpan={5} className="kv-suave">Sin requisitos definidos para {resumen.compuerta}.</td></tr>
          )}
        </tbody>
      </table>
      <p style={{ marginTop: 12 }}>
        {decision.permitido
          ? <Badge tono="ok">{resumen.compuerta} lista para solicitarse</Badge>
          : <><Badge tono="alerta">{resumen.compuerta} no puede solicitarse</Badge> <span className="kv-suave">{decision.motivos.join(' · ')}</span></>}
      </p>
    </>
  );
}
