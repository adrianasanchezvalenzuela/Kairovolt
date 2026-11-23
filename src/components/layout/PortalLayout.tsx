import { Link, Outlet } from 'react-router-dom';
import { portalClienteRepositorio } from '@/infrastructure';
import { Badge } from '@/components/ui/Badge';

export function PortalLayout() {
  return (
    <>
      <header style={{ background: 'var(--kv-navy)', color: '#fff', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '3px solid var(--kv-ambar)' }}>
        <Link to="/portal" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>KairóVolt</Link>
        <span style={{ opacity: 0.7 }}>Seguimiento de interconexión</span>
        <span style={{ marginLeft: 'auto' }}>
          {portalClienteRepositorio.origen === 'mock' && <Badge tono="alerta">Datos MOCK</Badge>}
        </span>
      </header>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Outlet />
      </main>
    </>
  );
}
