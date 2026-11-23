import type { Hallazgo } from '@/domain/validacion/hallazgo';
import { Badge } from '@/components/ui/Badge';

const categoria = { discrepancia: 'Discrepancia', campo_incompleto: 'Campo incompleto', vigencia: 'Vigencia' } as const;

export function HallazgosPanel({ hallazgos }: { hallazgos: readonly Hallazgo[] }) {
  if (hallazgos.length === 0) return <p><Badge tono="ok">Sin hallazgos</Badge></p>;
  return (
    <table>
      <thead><tr><th>Severidad</th><th>Categoría</th><th>Hallazgo</th><th>Evidencia</th></tr></thead>
      <tbody>
        {hallazgos.map((h) => (
          <tr key={h.id}>
            <td><Badge tono={h.severidad === 'bloqueante' ? 'error' : 'alerta'}>{h.severidad === 'bloqueante' ? 'Bloqueante' : 'Advertencia'}</Badge></td>
            <td>{categoria[h.categoria]}</td>
            <td><strong>{h.titulo}</strong><div className="kv-suave">{h.detalle}</div></td>
            <td>
              {h.categoria === 'campo_incompleto'
                ? <span className="kv-suave">—</span>
                : h.evidencias.map((e) => (
                  <div key={`${e.documentoId}`}>{e.documentoNombre}: <span className="kv-mono">{e.valor ?? '—'}</span></div>
                ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
