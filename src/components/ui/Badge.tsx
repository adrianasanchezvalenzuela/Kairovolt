import type { ReactNode } from 'react';

type Tono = 'neutro' | 'ok' | 'alerta' | 'error';
const colores: Record<Tono, string> = {
  neutro: 'var(--kv-texto-suave)',
  ok: 'var(--kv-ok)',
  alerta: 'var(--kv-alerta)',
  error: 'var(--kv-error)',
};

export function Badge({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: colores[tono], border: `1px solid ${colores[tono]}` }}>
      {children}
    </span>
  );
}
