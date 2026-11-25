import { Bell, CircleAlert, FileCheck2, Inbox, Radio } from 'lucide-react';
import { EnlacePortal, PortadaPortal } from '@/components/portal/DisenoPortal';
import { EmptyState } from '@/components/ui/Estados';
import { useVistaPortal } from '@/hooks/PortalContexto';

const tipo = {
  recepcion: { Icono: FileCheck2, etiqueta: 'Recepción', ruta: '/portal/documentos' },
  accion: { Icono: CircleAlert, etiqueta: 'Acción requerida', ruta: '/portal/documentos' },
  avance: { Icono: Radio, etiqueta: 'Actualización del proyecto', ruta: '/portal/inicio' },
} as const;

export function PortalAvisos() {
  const { notificaciones } = useVistaPortal();
  const grupos = new Map<string, typeof notificaciones>();
  for (const n of notificaciones) {
    const dia = n.fecha.slice(0, 10);
    grupos.set(dia, [...(grupos.get(dia) ?? []), n]);
  }

  return <>
    <PortadaPortal titulo="Centro de avisos.">Consulta novedades del proyecto y acciones que requieren tu atención.</PortadaPortal>
    {!grupos.size ? <div className="kv-cliente-superficie"><Inbox size={28} aria-hidden="true" />
      <EmptyState titulo="No hay avisos por ahora" descripcion="Las novedades de tu trámite aparecerán aquí." />
    </div> : <div className="kv-cliente-notificaciones">
      {[...grupos].map(([dia, items]) => <section key={dia}>
        <h2><Bell size={19} aria-hidden="true" /> <time dateTime={dia}>{new Date(dia + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</time></h2>
        <ul>{items.map((n) => {
          const { Icono, etiqueta, ruta } = tipo[n.tipo];
          const correccion = n.id.startsWith('n:rechazo:');
          return <li key={n.id} data-tipo={correccion ? 'correccion' : n.tipo}>
            <span className="kv-cliente-evento-icono"><Icono size={20} aria-hidden="true" /></span>
            <div><small>{correccion ? 'Corrección documental' : etiqueta}</small><h3>{n.titulo}</h3>{n.detalle && <p>{n.detalle}</p>}</div>
            <EnlacePortal to={ruta} secundario>{n.tipo === 'avance' ? 'Ver proyecto' : 'Ir a Documentos'}</EnlacePortal>
          </li>;
        })}</ul>
      </section>)}
    </div>}
  </>;
}
