import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useVistaPortal } from '@/hooks/PortalContexto';
import { datosPortal } from '@/infrastructure/portal-http';
import { pasosParticipantes } from '@/application/participantes';

const QUIEN = { cliente: 'Te toca a ti', idc: 'Lo hace IDC', cfe: 'En manos de CFE' } as const;

/** Pantalla principal: cuánto llevas, en qué etapa estás y qué sigue. */
export function PortalInicio() {
  const v = useVistaPortal();
  const paso = v.siguientePaso;
  const [captura, setCaptura] = useState<string | null>(null);
  const [confirmarDatos, setConfirmarDatos] = useState(false);
  useEffect(() => {
    if (!v.permisos.editarParticipantes) return;
    let vigente = true;
    void datosPortal().then((r) => {
      if (!vigente) return;
      setCaptura(r?.confirmado ? 'Confirmada' : r
        ? `${pasosParticipantes(r.datos).filter(Boolean).length} de 2 secciones de captura completas` : 'Sin iniciar');
      setConfirmarDatos(!r?.confirmado);
    }).catch(() => { if (vigente) setCaptura('No se pudo consultar'); });
    return () => { vigente = false; };
  }, [v.folio, v.permisos.editarParticipantes]);
  const aceptados = v.documentos?.filter((d) => d.estado === 'aceptado').length ?? 0;
  const porRevisar = v.documentos?.filter((d) => d.estado === 'en_revision').length ?? 0;
  const correcciones = v.documentos?.filter((d) => d.estado === 'rechazado').length ?? 0;
  const porEntregar = v.documentos?.filter((d) => d.puedeSubir && d.estado !== 'rechazado').length ?? 0;
  const fecha = paso.fechaEstimada ? new Date(`${paso.fechaEstimada}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : null;

  return (
    <>
      <section className="kvp-hero" aria-label="Avance de tu trámite">
        <p className="kvp-hero__nombre">{v.nombre}</p>
        <p className="kvp-hero__sub">{v.ubicacion}</p>
        <p className="kvp-hero__sub">Avance operativo · {v.etapas.filter((e) => e.tono === 'ok').length} de {v.etapas.length} etapas completadas</p>
        <span className="kvp-hero__etapa">{v.etapaActual ? `Etapa actual: ${v.etapaActual.nombre}` : 'Trámite completo'}</span>
      </section>

      <section aria-label="Preparación de tu expediente">
        <dl className="kvp-resumen">
          {v.permisos.editarParticipantes && <div><dt>Captura de datos</dt><dd>{captura ?? 'Consultando…'}</dd></div>}
          <div><dt>Preparación documental</dt><dd>{v.documentos?.length ? `${porEntregar} por entregar · ${correcciones} por corregir` : 'Sin requisitos disponibles'}</dd></div>
          <div><dt>Revisión IDC</dt><dd>{v.documentos?.length ? `${aceptados} aceptados · ${porRevisar} por revisar` : 'Sin documentos evaluables'}</dd></div>
        </dl>
      </section>

      <section className={`kvp-tarjeta kvp-paso kvp-paso--${paso.responsable}`} style={{ marginTop: 14 }} aria-labelledby="paso-titulo">
        <p className="kvp-paso__quien">Siguiente paso · {QUIEN[paso.responsable]}</p>
        <p id="paso-titulo" className="kvp-paso__titulo">{correcciones ? 'Atiende las correcciones de IDC' : confirmarDatos ? 'Completa los datos de tu expediente' : paso.titulo}</p>
        {correcciones > 0 || confirmarDatos
          ? <Link to={correcciones ? '/portal/documentos' : '/portal/mis-datos'} className="kvp-boton">{correcciones ? 'Ver correcciones' : 'Ir a Mis datos'}</Link>
          : <>
            <p style={{ margin: 0 }}>{paso.detalle}</p>
            {fecha && <p className="kvp-paso__fecha">Fecha estimada: {fecha}</p>}
            {paso.responsable === 'cliente' && <Link to="/portal/documentos" className="kvp-boton" style={{ marginTop: 14 }}>Ir a mis documentos</Link>}
          </>}
      </section>

      <h2>Tu camino</h2>
      <ol className="kvp-etapas" aria-label="Etapas del trámite">
        {v.etapas.map((e, i) => (
          <li key={e.id} className={`kvp-etapa${e.tono === 'ok' ? ' kvp-etapa--ok' : ''}${e.actual ? ' kvp-etapa--actual' : ''}${e.tono === 'alerta' ? ' kvp-etapa--alerta' : ''}`} aria-current={e.actual ? 'step' : undefined}>
            <span className="kvp-etapa__punto" aria-hidden="true">{e.tono === 'ok' ? '✓' : i + 1}</span>
            <div>
              <div className="kvp-etapa__titulo">{e.nombre} <StatusBadge tono={e.tono} variante="suave">{e.estado}</StatusBadge></div>
              <p className="kvp-etapa__texto">{e.descripcion}</p>
              {e.porcentaje !== null && e.tono !== 'ok' && <ProgressBar valor={e.porcentaje} total={100} etiqueta={`Avance de ${e.nombre}`} texto={`${e.porcentaje}%`} />}
            </div>
          </li>
        ))}
      </ol>

      {v.documentos && v.documentos.some((d) => ['pendiente', 'rechazado', 'vencido'].includes(d.estado)) && <section aria-labelledby="inicio-pendientes">
        <h2 id="inicio-pendientes">Pendientes documentales</h2>
        <ul className="kvp-avisos">{v.documentos.filter((d) => ['pendiente', 'rechazado', 'vencido'].includes(d.estado)).slice(0, 3).map((d) => <li className="kvp-aviso kvp-aviso--accion" key={d.id}>
          <span className="kvp-aviso__icono" aria-hidden="true">!</span><div><p className="kvp-aviso__titulo">{d.nombre}</p><p className="kvp-doc__texto">{d.detalle ?? 'Revisa la guía documental y prepara este documento.'}</p></div>
        </li>)}</ul>
        <Link to="/portal/documentos" className="kvp-enlace-accion">Revisar documentos →</Link>
      </section>}

      {v.historial.length > 0 && <section aria-labelledby="inicio-historial">
        <h2 id="inicio-historial">Actividad reciente</h2>
        <ol className="kvp-actividad">{v.historial.slice(0, 3).map((e) => <li key={e.id}><time>{new Date(`${e.fecha}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</time><span>{e.titulo}</span></li>)}</ol>
      </section>}

      {v.recepciones.length > 0 && <section aria-label="Documentos recientes">
        <h2>Documentos recientes</h2>
        <ul>{v.recepciones.slice(0, 3).map((r) => <li key={r.recibo}>{r.documento} · {r.recibo}</li>)}</ul>
        <Link to="/portal/documentos">Ver todos los envíos</Link>
      </section>}
      {v.notificaciones.length > 0 && <section aria-label="Avisos recientes">
        <h2>Avisos</h2>
        <ul>{v.notificaciones.slice(0, 3).map((n) => <li key={n.id}>{n.titulo}</li>)}</ul>
        <Link to="/portal/avisos">Ver avisos</Link>
      </section>}
    </>
  );
}
