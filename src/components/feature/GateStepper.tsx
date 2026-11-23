import { NOMBRE_COMPUERTA, type Compuerta, type CompuertaId, type EstadoCompuerta } from '@/domain/compuertas/compuerta';
import type { ResumenCompuerta } from '@/domain/checklist/checklist';
import { Badge } from '@/components/ui/Badge';

export const ETIQUETA_ESTADO_COMPUERTA: Record<EstadoCompuerta, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  liberada: 'Liberada',
  bloqueada: 'Bloqueada',
};
const tono = { pendiente: 'neutro', en_revision: 'alerta', liberada: 'ok', bloqueada: 'error' } as const;

interface Props {
  compuertas: readonly Compuerta[];
  resumenes: readonly ResumenCompuerta[];
  seleccionada: CompuertaId;
  onSeleccionar: (id: CompuertaId) => void;
}

export function GateStepper({ compuertas, resumenes, seleccionada, onSeleccionar }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {compuertas.map((c) => {
        const r = resumenes.find((x) => x.compuerta === c.id);
        const activa = c.id === seleccionada;
        return (
          <button
            key={c.id}
            onClick={() => onSeleccionar(c.id)}
            aria-pressed={activa}
            style={{
              flex: '1 1 160px', textAlign: 'left', cursor: 'pointer', padding: '10px 12px', background: '#fff',
              borderRadius: 'var(--kv-radio)', font: 'inherit', color: 'inherit',
              border: `1px solid ${activa ? 'var(--kv-teal)' : 'var(--kv-borde)'}`,
              borderTop: `3px solid ${activa ? 'var(--kv-teal)' : 'var(--kv-borde)'}`,
            }}
          >
            <strong>{c.id}</strong>{' '}
            <Badge tono={tono[c.estado]}>{ETIQUETA_ESTADO_COMPUERTA[c.estado]}</Badge>
            <div style={{ fontSize: 12, marginTop: 2 }}>{NOMBRE_COMPUERTA[c.id]}</div>
            <div className="kv-suave" style={{ marginTop: 4 }}>
              {r ? `${r.recibidosObligatorios}/${r.totalObligatorios} documentos` : '—'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
