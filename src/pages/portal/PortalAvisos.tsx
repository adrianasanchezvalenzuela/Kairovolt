import { Bell, CalendarDays, CircleAlert, FileCheck2, Inbox, Mail, Radio } from 'lucide-react';
import { EnlacePortal, PortadaPortal } from '@/components/portal/DisenoPortal';
import { EmptyState } from '@/components/ui/Estados';
import { formatearFechaLargaHermosillo, ZONA_HORARIA_IDC } from '@/domain/citas/cita';
import { useVistaPortal } from '@/hooks/PortalContexto';
import { accionesTramite } from '@/demo/tramite-demo';

const tipo = {
  recepcion: { Icono: FileCheck2, etiqueta: 'Recepción', ruta: '/portal/documentos' },
  accion: { Icono: CircleAlert, etiqueta: 'Acción requerida', ruta: '/portal/documentos' },
  avance: { Icono: Radio, etiqueta: 'Actualización del proyecto', ruta: '/portal/inicio' },
  cita: { Icono: CalendarDays, etiqueta: 'Tu visita a IDC', ruta: '/portal/visita' },
} as const;

export function PortalAvisos() {
  const { notificaciones, demo, folio } = useVistaPortal();
  const grupos = new Map<string, typeof notificaciones>();
  for (const n of notificaciones) {
    const dia = n.fecha.slice(0, 10);
    grupos.set(dia, [...(grupos.get(dia) ?? []), n]);
  }
  const correosSimulados = notificaciones.filter((n) => n.documentoId || n.citaId).slice(0, 10);

  return (
    <>
      <PortadaPortal titulo="Centro de avisos.">
        Consulta novedades de tu expediente, revisiones de IDC y actualizaciones de tu visita.
      </PortadaPortal>

      {demo && (
        <details className="kv-cliente-superficie" open={notificaciones.some((n) => n.citaId || n.id.startsWith('n:rechazo:'))}>
          <summary><Mail size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Correos simulados ({correosSimulados.length})</summary>
          <p className="kv-suave" style={{ marginTop: 6 }}>
            Estos mensajes se visualizan únicamente en el modo demostración. No se envían correos reales desde los demos ni se adjuntan archivos personales o códigos de acceso.
          </p>
          {correosSimulados.length === 0 ? (
            <p className="kv-suave" style={{ marginTop: 8 }}>Aún no hay correos generados en este recorrido.</p>
          ) : (
            correosSimulados.map((n) => {
              const esCita = !!n.citaId;
              const esConfirmada = n.eventoTipo === 'cita_confirmada';
              const esRechazo = n.id.startsWith('n:rechazo:');
              const asunto = n.correoDemo ? n.correoDemo.asunto : esConfirmada
                ? 'KairóVolt | Tu visita a IDC está confirmada.'
                : `KairóVolt | ${n.titulo}`;
              const eventoLabel = n.correoDemo ? (esRechazo ? 'Corrección solicitada' : 'Actualización documental') : esConfirmada
                ? 'Cita confirmada'
                : n.eventoTipo === 'cita_propuesta_horario'
                  ? 'Propuesta de nuevo horario'
                  : n.eventoTipo === 'cita_reprogramada'
                    ? 'Cita reprogramada'
                    : n.eventoTipo === 'cita_cancelada'
                      ? 'Cita cancelada'
                      : esCita
                        ? 'Solicitud de cita recibida'
                        : esRechazo
                          ? 'Corrección solicitada'
                          : 'Actualización documental';

              return (
                <details className="kv-doc-correo" key={n.id} open={esConfirmada || esRechazo}>
                  <summary>{asunto}</summary>
                  <dl>
                    <dt>Destinatario</dt><dd>{n.correoDemo?.para ?? 'cliente-demo@example.invalid'}</dd>
                    <dt>Fecha</dt><dd>{n.fecha.slice(0, 10)}</dd>
                    <dt>Evento</dt><dd>{eventoLabel}</dd>
                    <dt>Estado</dt><dd>Simulado (sin envío externo)</dd>
                  </dl>
                  <div className="kv-doc-correo__contenido">
                    <header>KairóVolt · IDC Sistemas Eléctricos</header>
                    {n.correoDemo ? (
                      <>
                        <h3>{n.titulo}</h3>
                        {n.correoDemo.parrafos.map((p) => <p key={p}>{p}</p>)}
                        <EnlacePortal to={'/portal/documentos?documento=' + encodeURIComponent(n.documentoId ?? '')}>{n.correoDemo.boton}</EnlacePortal>
                        <p className="kv-suave">Equipo IDC — KairóVolt. Mensaje de demostración · Sin validez legal.</p>
                      </>
                    ) : esConfirmada && n.citaResumen ? (
                      <>
                        <h3>¡Nos vemos pronto!</h3>
                        <p>Tu cita para la entrega física de tu expediente ha sido confirmada.</p>
                        <p>
                          <strong>Fecha:</strong> {formatearFechaLargaHermosillo(n.citaResumen.fecha)}.<br />
                          <strong>Horario:</strong> {n.citaResumen.horaInicio} – {n.citaResumen.horaFin} (hora de Hermosillo).<br />
                          <strong>Lugar:</strong> {n.citaResumen.ubicacion ?? 'Ubicación autorizada confirmada por IDC en tu portal'}.
                        </p>
                        <p>Consulta en tu portal los documentos que debes llevar.</p>
                        <EnlacePortal to="/portal/visita">Ver detalles de mi visita</EnlacePortal>
                        <p className="kv-suave">Equipo IDC — KairóVolt.</p>
                      </>
                    ) : esCita ? (
                      <>
                        <h3>{n.titulo}</h3>
                        <p>{n.detalle ?? 'Hay una novedad sobre tu solicitud de visita a IDC.'}</p>
                        <EnlacePortal to="/portal/visita">Ver detalles de mi visita</EnlacePortal>
                        <p className="kv-suave">Equipo IDC — KairóVolt.</p>
                      </>
                    ) : (
                      <>
                        <h3>{n.titulo}</h3>
                        <p>Hola, cliente de demostración.</p>
                        <p>
                          {esRechazo
                            ? 'Nuestro equipo revisó tu documento. Consulta el comentario y envía la versión corregida desde el portal.'
                            : 'Hay una actualización de tu documento. Consulta el resultado en el expediente.'}
                        </p>
                        <EnlacePortal to={'/portal/documentos?documento=' + encodeURIComponent(n.documentoId!)}>
                          Consultar mi expediente
                        </EnlacePortal>
                      </>
                    )}
                  </div>
                </details>
              );
            })
          )}
        </details>
      )}

      {!grupos.size ? (
        <div className="kv-cliente-superficie">
          <Inbox size={28} aria-hidden="true" />
          <EmptyState titulo="No hay avisos por ahora" descripcion="Las novedades de tu trámite aparecerán aquí." />
        </div>
      ) : (
        <div className="kv-cliente-notificaciones">
          {[...grupos].map(([dia, items]) => (
            <section key={dia}>
              <h2>
                <Bell size={19} aria-hidden="true" />{' '}
                <time dateTime={dia}>
                  {new Date(dia + 'T12:00:00-07:00').toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: ZONA_HORARIA_IDC,
                  })}
                </time>
              </h2>
              <ul>
                {items.map((n) => {
                  const cfg = tipo[n.tipo];
                  const Icono = n.citaId ? CalendarDays : cfg.Icono;
                  const correccion = n.id.startsWith('n:rechazo:');
                  const destino = n.ruta ? n.ruta : n.citaId
                    ? '/portal/visita'
                    : n.documentoId
                      ? '/portal/documentos?documento=' + encodeURIComponent(n.documentoId)
                      : cfg.ruta;
                  const textoEnlace = n.accion ? n.accion : n.citaId
                    ? n.eventoTipo === 'cita_propuesta_horario'
                      ? 'Revisar propuesta'
                      : 'Ver detalles de mi visita'
                    : correccion
                      ? 'Corregir mi documento'
                      : n.tipo === 'avance'
                        ? 'Ver proyecto'
                        : 'Ir a Documentos';
                  return (
                    <li key={n.id} data-tipo={correccion ? 'correccion' : n.tipo} data-leido={n.leido === undefined ? undefined : String(n.leido)}>
                      <span className="kv-cliente-evento-icono"><Icono size={20} aria-hidden="true" /></span>
                      <div>
                        <small>{correccion ? 'Corrección documental' : n.citaId ? 'Cita de visita' : cfg.etiqueta}</small>
                        <h3>{n.titulo}{n.leido === false && <span className="kv-aviso-nuevo">Nuevo</span>}</h3>
                        {n.detalle && <p>{n.detalle}</p>}
                        {n.leido === false && <button type="button" className="kv-aviso-leer" onClick={() => accionesTramite.leerAviso(folio, n.id)}>Marcar como leído</button>}
                      </div>
                      <EnlacePortal to={destino} secundario>{textoEnlace}</EnlacePortal>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
