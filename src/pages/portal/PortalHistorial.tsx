import { CalendarDays, FileText, History, Waypoints } from 'lucide-react';
import { PortadaPortal } from '@/components/portal/DisenoPortal';
import { EmptyState } from '@/components/ui/Estados';
import { ZONA_HORARIA_IDC } from '@/domain/citas/cita';
import { useVistaPortal } from '@/hooks/PortalContexto';

const estados = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  prevalidado: 'Prevalidado digitalmente',
  aceptado: 'Validado definitivamente',
  rechazado: 'Requiere corrección',
};

export function PortalHistorial() {
  const { historial, recepciones } = useVistaPortal();
  const porRecibo = new Map(recepciones.map((r) => ['r:' + r.recibo, r]));
  return (
    <>
      <PortadaPortal titulo="Historial de tu trámite.">
        Consulta los hitos operativos, envíos documentales y movimientos de tus visitas a IDC.
      </PortadaPortal>
      {!historial.length ? (
        <div className="kv-cliente-superficie">
          <History size={27} aria-hidden="true" />
          <EmptyState titulo="Todavía no hay historial" descripcion="Aquí aparecerán tus envíos, visitas y las etapas completadas." />
        </div>
      ) : (
        <section className="kv-cliente-cronologia" aria-label="Línea de tiempo del proyecto">
          <ol>
            {historial.map((e) => {
              const documental = e.id.startsWith('r:');
              const cita = e.id.startsWith('c:');
              const r = porRecibo.get(e.id);
              const Icono = cita ? CalendarDays : documental ? FileText : Waypoints;
              return (
                <li key={e.id} data-tipo={cita ? 'cita' : documental ? 'documental' : 'operativo'}>
                  <span className="kv-cliente-evento-icono"><Icono size={20} aria-hidden="true" /></span>
                  <div>
                    <small>{cita ? 'Visita y citas' : documental ? 'Envío documental' : 'Avance operativo'}</small>
                    <h2>{e.titulo}</h2>
                    {r && (
                      <p>
                        {r.sustituida ? 'Sustituido' : estados[r.estado]} · {r.archivo} · {r.recibo}
                        {r.motivo && ' · ' + r.motivo}
                      </p>
                    )}
                  </div>
                  <time dateTime={e.fecha}>
                    {new Date(e.fecha.slice(0, 10) + 'T12:00:00-07:00').toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: ZONA_HORARIA_IDC,
                    })}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}
