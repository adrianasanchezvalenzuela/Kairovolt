import { useEffect, useState } from 'react';
import { ArrowRight, Bell, Check, ClipboardList, FolderOpen, History, MapPin, Waypoints, Zap } from 'lucide-react';
import { EnergiaPortal, EnlacePortal, IlustracionExpediente } from '@/components/portal/DisenoPortal';
import { datosPortal } from '@/infrastructure/portal-http';
import { pasosParticipantes } from '@/application/participantes';
import { useVistaPortal } from '@/hooks/PortalContexto';

export function PortalInicio() {
  const v = useVistaPortal();
  const [captura, setCaptura] = useState<string | null>(null);
  const [confirmarDatos, setConfirmarDatos] = useState(false);
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

  const documentos = v.documentos;
  const aceptados = documentos?.filter((d) => d.estado === 'aceptado').length;
  const revision = documentos?.filter((d) => d.estado === 'en_revision' || d.estado === 'recibido').length;
  const correcciones = documentos?.filter((d) => d.estado === 'rechazado').length ?? 0;
  const pendientes = documentos?.filter((d) => ['pendiente', 'rechazado', 'vencido'].includes(d.estado)).length;
  const paso = v.siguientePaso;
  const actual = v.etapas.find((etapa) => etapa.actual);
  const ultima = v.notificaciones[0] ?? v.historial[0];
  const accion = correcciones ? { titulo: 'Atiende las correcciones de IDC', texto: paso.detalle, ruta: '/portal/documentos', boton: 'Ver correcciones' }
    : confirmarDatos ? { titulo: 'Completa los datos de tu expediente', texto: 'Revisa y confirma la información del titular y de quien tramita.', ruta: '/portal/mis-datos', boton: 'Ir a Mis datos' }
    : paso.responsable === 'cliente'
      ? { titulo: 'Preparemos tus documentos.', texto: paso.detalle, ruta: '/portal/documentos', boton: 'Continuar mi expediente' }
      : { titulo: revision ? 'IDC está revisando tus envíos.' : paso.titulo, texto: paso.detalle,
        ruta: revision ? '/portal/documentos' : '/portal/avisos', boton: revision ? 'Consultar mis envíos' : 'Consultar avisos' };
  const avisos = v.notificaciones.filter((n) => n.tipo === 'accion').length;

  return <>
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
      <section className={'kv-cliente-accion' + (correcciones ? ' kv-cliente-accion--urgente' : '')}>
        <IlustracionExpediente variante={confirmarDatos && !correcciones ? 'identidad' : revision && !correcciones ? 'validacion' : 'documentos'} />
        <span className="kv-cliente-etiqueta">Tu próxima acción</span>
        <h2>{accion.titulo}</h2><p>{accion.texto}</p>
        {!correcciones && !confirmarDatos && !revision && paso.fechaEstimada &&
          <p>Fecha estimada <time dateTime={paso.fechaEstimada}>{paso.fechaEstimada}</time></p>}
        <EnlacePortal to={accion.ruta}>{accion.boton}</EnlacePortal>
      </section>
    </div>
    <section className="kv-cliente-seccion"><h2>Tu espacio</h2>
      <div className="kv-cliente-espacio">
        {v.permisos.editarParticipantes && <article><ClipboardList size={20} aria-hidden="true" /><h3><EnlacePortal to="/portal/mis-datos" secundario>Mis datos</EnlacePortal></h3><p>{captura ?? 'Consultando…'}</p></article>}
        <article><FolderOpen size={20} aria-hidden="true" /><h3><EnlacePortal to="/portal/documentos" secundario>Mis documentos</EnlacePortal></h3>
          <p>{documentos ? `${pendientes} pendientes · ${revision} en revisión · ${aceptados} aceptados` : 'Documentos no disponibles'}</p></article>
        <article><Waypoints size={20} aria-hidden="true" /><h3><a href="#recorrido" className="kv-cliente-enlace">Mi recorrido <ArrowRight size={15} aria-hidden="true" /></a></h3><p>{v.etapaActual?.nombre ?? 'Trámite completo'}</p></article>
        <article><Bell size={20} aria-hidden="true" /><h3><EnlacePortal to="/portal/avisos" secundario>Mis avisos</EnlacePortal></h3><p>{avisos ? avisos + ' requieren atención' : 'Sin acciones pendientes'}</p></article>
      </div>
    </section>
    <section id="recorrido" className="kv-cliente-seccion kv-cliente-camino">
      <div className="kv-cliente-linea"><h2>Tu recorrido de interconexión</h2><span>{v.etapas.filter((e) => e.tono === 'ok').length} de {v.etapas.length} etapas completadas</span></div>
      <div className="kv-cliente-segmentos" aria-hidden="true">{v.etapas.map((e) => <i key={e.id} data-estado={e.tono === 'ok' ? 'completa' : e.actual ? 'actual' : 'pendiente'} />)}</div>
      <p><strong>{actual?.nombre ?? 'Trámite completo'}</strong>{actual && ' · ' + actual.descripcion}</p>
      <details><summary>Consultar el recorrido completo</summary>
      <ol>{v.etapas.map((e, i) => <li key={e.id} aria-current={e.actual ? 'step' : undefined} data-estado={e.tono === 'ok' ? 'completa' : e.actual ? 'actual' : 'pendiente'}>
        <span className="kv-cliente-camino__punto">{e.tono === 'ok' ? <Check size={17} aria-hidden="true" /> : i + 1}</span>
        <div><strong>{e.nombre}</strong><small>{e.estado}</small><p>{e.descripcion}</p></div>
      </li>)}</ol></details>
    </section>
    <section className="kv-cliente-seccion kv-cliente-ultima">
      <div className="kv-cliente-linea"><h2><History size={20} aria-hidden="true" /> Última actualización</h2><EnlacePortal to="/portal/historial" secundario>Historial completo</EnlacePortal></div>
      {ultima ? <p>{ultima.titulo} <time dateTime={ultima.fecha}>{ultima.fecha.slice(0, 10)}</time></p> : <p>Aún no hay actualizaciones.</p>}
    </section>
  </>;
}
