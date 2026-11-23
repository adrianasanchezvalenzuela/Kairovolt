import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { VistaPortalCliente } from '@/application/portal-cliente';
import type { EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { portalClienteRepositorio } from '@/infrastructure';
import { Badge } from '@/components/ui/Badge';

const estadoGate: Record<EstadoCompuerta, { texto: string; tono: 'neutro' | 'alerta' | 'ok' | 'error' }> = {
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
  en_revision: { texto: 'En revisión', tono: 'alerta' },
  liberada: { texto: 'Completada', tono: 'ok' },
  bloqueada: { texto: 'Detenida', tono: 'error' },
};
const motivo = { faltante: 'Falta', vencido: 'Vencido', por_vencer: 'Por vencer' } as const;
const tonoMotivo = { faltante: 'alerta', vencido: 'error', por_vencer: 'alerta' } as const;

export function PortalProyecto() {
  const { folio = '' } = useParams();
  const [vista, setVista] = useState<VistaPortalCliente | null | undefined>(undefined);
  useEffect(() => {
    setVista(undefined);
    const hoy = new Date().toISOString().slice(0, 10);
    portalClienteRepositorio.consultar(folio, hoy).then(setVista);
  }, [folio]);

  if (vista === undefined) return <p>Cargando…</p>;
  if (vista === null) {
    return (
      <>
        <h1>Folio no encontrado</h1>
        <p className="kv-suave">Revisa que el folio esté completo. <Link to="/portal">Intentar de nuevo</Link></p>
      </>
    );
  }

  const pct = vista.avance.total === 0 ? 0 : Math.round((vista.avance.recibidos / vista.avance.total) * 100);

  return (
    <>
      <h1>{vista.nombre}</h1>
      <p className="kv-suave"><span className="kv-mono">{vista.folio}</span> · {vista.ubicacion}</p>

      <h2>Avance de documentos: {pct}%</h2>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, background: 'var(--kv-hielo)', borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--kv-teal)', borderRadius: 4 }} />
      </div>
      <p className="kv-suave">{vista.avance.recibidos} de {vista.avance.total} documentos obligatorios recibidos</p>

      <h2>Etapas</h2>
      <table>
        <tbody>
          {vista.compuertas.map((c) => (
            <tr key={c.id}>
              <td><strong>{c.id}</strong> · {c.nombre}</td>
              <td className="kv-suave">{c.recibidos}/{c.total} documentos</td>
              <td><Badge tono={estadoGate[c.estado].tono}>{estadoGate[c.estado].texto}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Pendientes de tu parte</h2>
      {vista.pendientesCliente.length === 0 ? <p><Badge tono="ok">Nada pendiente por ahora</Badge></p> : (
        <table>
          <tbody>
            {vista.pendientesCliente.map((p) => (
              <tr key={p.id}>
                <td>{p.titulo}</td>
                <td className="kv-suave">{p.detalle}</td>
                <td><Badge tono={tonoMotivo[p.motivo]}>{motivo[p.motivo]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Próximos pasos</h2>
      {vista.proximosHitos.length === 0 ? <p className="kv-suave">Sin actividades programadas.</p> : (
        <table>
          <tbody>
            {vista.proximosHitos.map((h) => (
              <tr key={h.id}>
                <td>{h.nombre}</td>
                <td className="kv-mono">{h.finPlan}</td>
                <td>{h.estado === 'atrasada' ? <Badge tono="alerta">Reprogramando</Badge> : h.estado === 'en_curso' ? <Badge tono="ok">En curso</Badge> : <Badge>Programada</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
