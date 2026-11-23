import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizarFolio } from '@/application/portal-cliente';

export function PortalAcceso() {
  const [folio, setFolio] = useState('');
  const navigate = useNavigate();

  const consultar = (e: FormEvent) => {
    e.preventDefault();
    const f = normalizarFolio(folio);
    if (f) navigate(`/portal/${encodeURIComponent(f)}`);
  };

  return (
    <form onSubmit={consultar} style={{ maxWidth: 420 }}>
      <h1>Consulta tu proyecto</h1>
      <p className="kv-suave">Ingresa el folio KV que te entregó IDC.</p>
      <label htmlFor="folio">Folio KV</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          id="folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="KV-XXXX-0000" autoComplete="off"
          style={{ flex: 1, padding: '8px 10px', font: 'inherit', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)' }}
        />
        <button type="submit" style={{ padding: '8px 16px', font: 'inherit', fontWeight: 600, color: '#fff', background: 'var(--kv-teal)', border: 0, borderRadius: 'var(--kv-radio)', cursor: 'pointer' }}>
          Consultar
        </button>
      </div>
    </form>
  );
}
