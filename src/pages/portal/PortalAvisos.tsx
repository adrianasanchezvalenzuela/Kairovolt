import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/Estados';
import { useVistaPortal } from '@/hooks/PortalContexto';

const ICONO = { recepcion: '✓', accion: '!', avance: '★' } as const;
const fecha = (iso: string) => (iso.length > 10 ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }));

export function PortalAvisos() {
  const v = useVistaPortal();
  return (
    <>
      <h1>Avisos</h1>
      <p className="kv-suave">Lo más reciente de tu trámite.</p>
      {v.notificaciones.length === 0
        ? <EmptyState titulo="No hay avisos por ahora" descripcion="Te avisaremos aquí cuando haya novedades." />
        : (
          <ul className="kvp-avisos" aria-label="Avisos">
            {v.notificaciones.map((n) => (
              <li key={n.id} className={`kvp-aviso kvp-aviso--${n.tipo}`}>
                <span className="kvp-aviso__icono" aria-hidden="true">{ICONO[n.tipo]}</span>
                <div>
                  <p className="kvp-aviso__titulo">{n.titulo}</p>
                  {n.detalle && <p style={{ margin: '2px 0 0', color: 'var(--kv-texto-suave)', fontSize: 14 }}>{n.detalle}</p>}
                  <span className="kvp-aviso__fecha">{fecha(n.fecha)}</span>
                  {n.tipo === 'accion' && <div style={{ marginTop: 8 }}><Link to="/portal/documentos">Ir a mis documentos</Link></div>}
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
