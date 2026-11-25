import { Link } from 'react-router-dom';
import { AnilloAvance } from '@/components/portal/AnilloAvance';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useVistaPortal } from '@/hooks/PortalContexto';

const QUIEN = { cliente: 'Te toca a ti', idc: 'Lo hace IDC', cfe: 'En manos de CFE' } as const;

/** Pantalla principal: cuánto llevas, en qué etapa estás y qué sigue. */
export function PortalInicio() {
  const v = useVistaPortal();
  const paso = v.siguientePaso;
  const fecha = paso.fechaEstimada ? new Date(`${paso.fechaEstimada}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : null;

  return (
    <>
      <section className="kvp-hero" aria-label="Avance de tu trámite">
        <p className="kvp-hero__nombre">{v.nombre}</p>
        <p className="kvp-hero__sub">{v.ubicacion}</p>
        <AnilloAvance porcentaje={v.avance.porcentaje} />
        <span className="kvp-hero__etapa">{v.etapaActual ? `Etapa actual: ${v.etapaActual.nombre}` : 'Trámite completo'}</span>
        {!v.avance.exacto && <p className="kvp-aprox">Avance aproximado: aún no tenemos el detalle de tus documentos y solo contamos las etapas ya completadas.</p>}
      </section>

      <section className={`kvp-tarjeta kvp-paso kvp-paso--${paso.responsable}`} style={{ marginTop: 14 }} aria-labelledby="paso-titulo">
        <p className="kvp-paso__quien">Siguiente paso · {QUIEN[paso.responsable]}</p>
        <p id="paso-titulo" className="kvp-paso__titulo">{paso.titulo}</p>
        <p style={{ margin: 0 }}>{paso.detalle}</p>
        {fecha && <p className="kvp-paso__fecha">Fecha estimada: {fecha}</p>}
        {paso.responsable === 'cliente' && <Link to="/portal/documentos" className="kvp-boton" style={{ marginTop: 14 }}>Ir a mis documentos</Link>}
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

      <details className="kvp-tarjeta" style={{ marginTop: 20 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Cómo se calcula mi avance?</summary>
        <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>{v.avance.reglas.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>
    </>
  );
}
