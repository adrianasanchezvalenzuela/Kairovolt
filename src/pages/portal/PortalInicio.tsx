import { useEffect, useState } from 'react';
import { ArrowRight, Bell, CalendarDays, Check, ClipboardList, FolderOpen, History, MapPin, Waypoints, Zap } from 'lucide-react';
import { EnergiaPortal, EnlacePortal, IlustracionExpediente } from '@/components/portal/DisenoPortal';
import { datosPortal, listarPreparacionPortal, resumenVisitaPortal, type ResumenVisitaPortal } from '@/infrastructure/portal-http';
import type { ProgresoPreparacion } from '@/domain/checklist/preparacion';
import {
  ESTADOS_CITA_ACTIVOS,
  formatearFechaLargaHermosillo,
  INFO_TIPO_VISITA,
} from '@/domain/citas/cita';
import { pasosParticipantes } from '@/application/participantes';
import { useVistaPortal } from '@/hooks/PortalContexto';
import { esCapturaDemo } from '@/data/demos-portal';

export function PortalInicio() {
  const v = useVistaPortal();
  const [captura, setCaptura] = useState<string | null>(null);
  const [confirmarDatos, setConfirmarDatos] = useState(false);
  const [preparacion, setPreparacion] = useState<ProgresoPreparacion[] | null>(null);
  const [visita, setVisita] = useState<ResumenVisitaPortal | null>(null);

  useEffect(() => {
    if (v.documentos === null) return;
    let vigente = true;
    void listarPreparacionPortal().then((p) => { if (vigente) setPreparacion(p); }).catch(() => {});
    void resumenVisitaPortal().then((r) => { if (vigente) setVisita(r); }).catch(() => {});
    return () => { vigente = false; };
  }, [v.folio, v.documentos === null, v.notificaciones.length]);

  useEffect(() => {
    if (!v.permisos.editarParticipantes) return;
    let vigente = true;
    void datosPortal().then((r) => {
      if (!vigente) return;
      setCaptura(r?.confirmado ? 'Confirmada' : r ? pasosParticipantes(r.datos).filter(Boolean).length + ' de 2 secciones' : 'Sin iniciar');
      setConfirmarDatos(!r?.confirmado);
    }).catch(() => { if (vigente) setCaptura('Sin datos disponibles'); });
    return () => { vigente = false; };
  }, [v.folio, v.permisos.editarParticipantes]);

  const soloCaptura = esCapturaDemo(v);
  const documentos = v.documentos?.filter((d) => d.estado !== 'no_aplica') ?? null;
  const favorables = documentos?.filter((d) => d.estado === 'aceptado' || d.estado === 'prevalidado').length ?? 0;
  const revision = documentos?.filter((d) => d.estado === 'en_revision' || d.estado === 'recibido').length ?? 0;
  const correcciones = documentos?.filter((d) => d.estado === 'rechazado').length ?? 0;
  const pendientes = documentos?.filter(
    (d) => d.estado === 'rechazado' || d.estado === 'vencido' || (d.estado === 'pendiente' && !preparacion?.some((p) => p.documento === d.id && p.preparado)),
  ).length ?? 0;

  const citaActiva = visita?.citaActiva && ESTADOS_CITA_ACTIVOS.includes(visita.citaActiva.estado) ? visita.citaActiva : null;
  const expedientePreparadoVisita = visita?.elegibilidad.permitida === true;
  const paso = v.siguientePaso;
  const actual = v.etapas.find((etapa) => etapa.actual);
  const ultima = v.notificaciones[0] ?? v.historial[0];
  const avisos = v.notificaciones.filter((n) => n.tipo === 'accion').length;

  let accion: { titulo: string; texto: string; ruta: string; boton: string; variante: 'identidad' | 'documentos' | 'validacion' | 'visita'; urgente?: boolean };

  if (soloCaptura) {
    accion = {
      titulo: 'Completa los datos de tu expediente.',
      texto: 'Registra al titular, a quien realizará el trámite y a los testigos cuando corresponda.',
      ruta: '/portal/mis-datos',
      boton: 'Completar mis datos',
      variante: 'identidad',
    };
  } else if (citaActiva?.estado === 'cambio_solicitado' && citaActiva.propuestaPor === 'idc') {
    const fechaProp = citaActiva.propuestaFecha ? formatearFechaLargaHermosillo(citaActiva.propuestaFecha) : '';
    accion = {
      titulo: 'Tenemos una nueva propuesta de horario.',
      texto: fechaProp
        ? `IDC propuso el ${fechaProp} de ${citaActiva.propuestaHoraInicio} a ${citaActiva.propuestaHoraFin} (Hermosillo).`
        : 'IDC propuso un nuevo horario para tu visita. Revísalo y respóndenos en el portal.',
      ruta: '/portal/visita',
      boton: 'Revisar propuesta',
      variante: 'visita',
      urgente: true,
    };
  } else if (citaActiva && (citaActiva.estado === 'confirmada' || citaActiva.estado === 'reprogramada')) {
    accion = {
      titulo: '¡Tenemos una cita!',
      texto: `${INFO_TIPO_VISITA[citaActiva.tipoVisita].titulo} · ${formatearFechaLargaHermosillo(citaActiva.fecha)} · ${citaActiva.horaInicio} – ${citaActiva.horaFin} (Hermosillo).`,
      ruta: '/portal/visita',
      boton: 'Ver mi próxima visita',
      variante: 'visita',
    };
  } else if (citaActiva && (citaActiva.estado === 'solicitada' || citaActiva.estado === 'pendiente_confirmacion' || citaActiva.estado === 'cambio_solicitado')) {
    accion = {
      titulo: 'Recibimos tu solicitud.',
      texto: `Estamos coordinando tu horario con IDC (${formatearFechaLargaHermosillo(citaActiva.fecha)} · ${citaActiva.horaInicio}, Hermosillo).`,
      ruta: '/portal/visita',
      boton: 'Consultar mi solicitud',
      variante: 'visita',
    };
  } else if (expedientePreparadoVisita) {
    accion = {
      titulo: 'Tu expediente está listo.',
      texto: 'Revisa lo que debes llevar y agenda tu visita.',
      ruta: '/portal/visita',
      boton: 'Preparar mi visita',
      variante: 'visita',
    };
  } else if (correcciones > 0) {
    const docCorreccion = documentos?.find((d) => d.estado === 'rechazado');
    accion = {
      titulo: 'Atiende las correcciones de IDC.',
      texto: docCorreccion
        ? `Tienes indicaciones en «${docCorreccion.nombre}». Revísalas y continúa con tu expediente.`
        : 'Revisa los comentarios de IDC y envía la versión actualizada.',
      ruta: docCorreccion ? '/portal/documentos?documento=' + encodeURIComponent(docCorreccion.id) : '/portal/documentos',
      boton: 'Continuar mi expediente',
      variante: 'documentos',
      urgente: true,
    };
  } else if (confirmarDatos) {
    accion = {
      titulo: 'Completa los datos de tu expediente.',
      texto: 'Revisa y confirma la información del titular y de quien tramita.',
      ruta: '/portal/mis-datos',
      boton: 'Completar mis datos',
      variante: 'identidad',
    };
  } else if (pendientes > 0 || paso.responsable === 'cliente') {
    accion = {
      titulo: 'Preparemos tus documentos.',
      texto: 'Consulta las guías, marca tu avance y sube tus archivos para revisión previa de IDC.',
      ruta: '/portal/documentos',
      boton: 'Continuar mi expediente',
      variante: 'documentos',
    };
  } else {
    accion = {
      titulo: revision ? 'IDC está revisando tus envíos.' : paso.titulo,
      texto: paso.detalle,
      ruta: revision ? '/portal/documentos' : '/portal/avisos',
      boton: revision ? 'Consultar mis envíos' : 'Consultar avisos',
      variante: revision ? 'validacion' : 'documentos',
    };
  }

  const resumenDocumentos = !documentos
    ? 'Documentos no disponibles'
    : expedientePreparadoVisita
      ? `Documentación preparada para entrega física (${favorables} de ${documentos.length})`
      : `${pendientes} pendientes · ${revision} en revisión · ${favorables} favorables`;

  return (
    <>
      <div className="kv-cliente-principal">
        <section className="kv-cliente-proyecto" aria-label="Avance operativo">
          <EnergiaPortal className="kv-cliente-proyecto__energia" />
          <div className="kv-cliente-proyecto__texto">
            <div className="kv-cliente-proyecto__folio"><Zap size={15} aria-hidden="true" /> {v.folio}</div>
            <h1>Más cerca de tu próxima conexión.</h1>
            <p>Nosotros te guiamos. Tú avanzas a tu ritmo.</p>
            <h2>{v.nombre}</h2>
            {v.ubicacion && <p><MapPin size={16} aria-hidden="true" /> {v.ubicacion}</p>}
          </div>
        </section>

        <section className={'kv-cliente-accion' + (accion.urgente ? ' kv-cliente-accion--urgente' : '')}>
          <IlustracionExpediente variante={accion.variante} />
          <span className="kv-cliente-etiqueta">Tu próxima acción</span>
          <h2>{accion.titulo}</h2>
          <p>{accion.texto}</p>
          {!soloCaptura && !expedientePreparadoVisita && !citaActiva && !correcciones && !confirmarDatos && !revision && paso.fechaEstimada && (
            <p>Fecha estimada <time dateTime={paso.fechaEstimada}>{paso.fechaEstimada}</time></p>
          )}
          <EnlacePortal to={accion.ruta}>{accion.boton}</EnlacePortal>
        </section>
      </div>

      <section className="kv-cliente-seccion">
        <h2>Tu espacio</h2>
        <div className="kv-cliente-espacio">
          {v.permisos.editarParticipantes && (
            <article>
              <ClipboardList size={20} aria-hidden="true" />
              <h3><EnlacePortal to="/portal/mis-datos" secundario>Mis datos</EnlacePortal></h3>
              <p>{captura ?? 'Consultando…'}</p>
            </article>
          )}
          {!soloCaptura && (
            <article>
              <FolderOpen size={20} aria-hidden="true" />
              <h3><EnlacePortal to="/portal/documentos" secundario>Mis documentos</EnlacePortal></h3>
              <p>{resumenDocumentos}</p>
            </article>
          )}
          {!soloCaptura && (expedientePreparadoVisita || citaActiva) ? (
            <article>
              <CalendarDays size={20} aria-hidden="true" />
              <h3><EnlacePortal to="/portal/visita" secundario>Mi visita a IDC</EnlacePortal></h3>
              <p>
                {citaActiva
                  ? `${citaActiva.fecha} · ${citaActiva.horaInicio} (Hermosillo)`
                  : 'Lista para preparar y agendar'}
              </p>
            </article>
          ) : (
            <article>
              <Waypoints size={20} aria-hidden="true" />
              <h3><a href="#recorrido" className="kv-cliente-enlace">Mi recorrido <ArrowRight size={15} aria-hidden="true" /></a></h3>
              <p>{v.etapaActual?.nombre ?? 'Trámite completo'}</p>
            </article>
          )}
          {!soloCaptura && (
            <article>
              <Bell size={20} aria-hidden="true" />
              <h3><EnlacePortal to="/portal/avisos" secundario>Mis avisos</EnlacePortal></h3>
              <p>{avisos ? avisos + ' requieren atención' : 'Sin acciones pendientes'}</p>
            </article>
          )}
        </div>
      </section>

      <section id="recorrido" className="kv-cliente-seccion kv-cliente-camino">
        <div className="kv-cliente-linea">
          <h2>Tu recorrido de interconexión</h2>
          <span>{v.etapas.filter((e) => e.tono === 'ok').length} de {v.etapas.length} etapas completadas</span>
        </div>
        <div className="kv-cliente-segmentos" aria-hidden="true">
          {v.etapas.map((e) => <i key={e.id} data-estado={e.tono === 'ok' ? 'completa' : e.actual ? 'actual' : 'pendiente'} />)}
        </div>
        <p><strong>{actual?.nombre ?? 'Trámite completo'}</strong>{actual && ' · ' + actual.descripcion}</p>
        <details>
          <summary>Consultar el recorrido completo</summary>
          <ol>
            {v.etapas.map((e, i) => (
              <li key={e.id} aria-current={e.actual ? 'step' : undefined} data-estado={e.tono === 'ok' ? 'completa' : e.actual ? 'actual' : 'pendiente'}>
                <span className="kv-cliente-camino__punto">{e.tono === 'ok' ? <Check size={17} aria-hidden="true" /> : i + 1}</span>
                <div><strong>{e.nombre}</strong><small>{e.estado}</small><p>{e.descripcion}</p></div>
              </li>
            ))}
          </ol>
        </details>
      </section>

      <section className="kv-cliente-seccion kv-cliente-ultima">
        <div className="kv-cliente-linea">
          <h2><History size={20} aria-hidden="true" /> Última actualización</h2>
          {!soloCaptura && <EnlacePortal to="/portal/historial" secundario>Historial completo</EnlacePortal>}
        </div>
        {ultima ? <p>{ultima.titulo} <time dateTime={ultima.fecha}>{ultima.fecha.slice(0, 10)}</time></p> : <p>Aún no hay actualizaciones.</p>}
      </section>
    </>
  );
}
