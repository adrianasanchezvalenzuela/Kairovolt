import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { auditarExpediente } from '@/application/auditar-expediente';
import { seguimientoProyecto } from '@/application/seguimiento-proyecto';
import { ErrorSincronizacion } from '@/application/sincronizacion';
import type { CompuertaId } from '@/domain/compuertas/compuerta';
import { evaluarCarpetaFisica, evaluarChecklist, puedeSolicitarCompuerta } from '@/domain/checklist/checklist';
import { cumpleMetaPaer, META_PAER_PORCENTAJE } from '@/domain/indicadores/paer';
import type { Observacion } from '@/domain/observaciones/observacion';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { potenciaDcKwp } from '@/domain/proyecto/potencia';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { catalogoRequisitos } from '@/infrastructure';
import { AccionesTable } from '@/components/feature/AccionesTable';
import { ChecklistTable } from '@/components/feature/ChecklistTable';
import { CronogramaTable } from '@/components/feature/CronogramaTable';
import { GateStepper } from '@/components/feature/GateStepper';
import { HallazgosPanel } from '@/components/feature/HallazgosPanel';
import { NuevaObservacionForm } from '@/components/feature/NuevaObservacionForm';
import { ObservacionesTable } from '@/components/feature/ObservacionesTable';
import { SincronizarCompuerta } from '@/components/feature/SincronizarCompuerta';
import { Indicador } from '@/components/ui/Indicador';

export function ProyectoDetalle() {
  const { id = '' } = useParams();
  const { repositorio, sincronizacion } = useFuenteDatos();
  const [proyecto, setProyecto] = useState<Proyecto | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [compuertaId, setCompuertaId] = useState<CompuertaId>('G0');
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(
    () => repositorio.obtenerPorId(id).then((p) => { setProyecto(p); setError(null); }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error desconocido')),
    [repositorio, id],
  );
  useEffect(() => { setProyecto(undefined); void cargar(); }, [cargar]);

  if (error) return <p role="alert" style={{ color: 'var(--kv-error)' }}>No se pudo cargar el proyecto: {error}</p>;
  if (proyecto === undefined) return <p>Cargando…</p>;
  if (proyecto === null) return <p>Proyecto no encontrado.</p>;

  const s = proyecto.sistema;
  const disponible = proyecto.documentosDisponibles;
  const resumenes = disponible ? evaluarChecklist(catalogoRequisitos, proyecto.documentos) : [];
  const hoy = new Date().toISOString().slice(0, 10);
  const auditoria = auditarExpediente(proyecto, catalogoRequisitos, hoy);
  const seg = seguimientoProyecto(proyecto, hoy);
  const carpeta = evaluarCarpetaFisica(resumenes);
  const resumen = resumenes.find((r) => r.compuerta === compuertaId);
  const compuerta = proyecto.compuertas.find((c) => c.id === compuertaId);
  const paerActual = seg.paerSemanal.at(-1);

  const avisosLiberar = [
    ...puedeSolicitarCompuerta(compuertaId, proyecto.compuertas, resumenes, disponible ? auditoria.bloqueantes.length : 0).motivos.filter((m) => !m.includes('ya está liberada')),
    ...(disponible ? [] : ['El expediente no está disponible desde Zoho: no se pudo validar el checklist ni los hallazgos.']),
  ];

  const cerrarObservacion = async (o: Observacion) => {
    if (!sincronizacion || !window.confirm('¿Marcar esta observación como cerrada en Zoho?')) return;
    setCerrando(true);
    setErrorCierre(null);
    try {
      await sincronizacion.observacion({
        folio: proyecto.folio, observacionId: o.id, compuerta: o.compuerta, origen: o.origen, estado: 'cerrada',
        descripcion: o.descripcion, fechaCompromiso: o.fechaCompromiso, responsable: o.responsable,
      });
      await cargar();
    } catch (e) {
      setErrorCierre(e instanceof ErrorSincronizacion ? e.message : 'Error inesperado.');
    } finally {
      setCerrando(false);
    }
  };

  return (
    <>
      <h1>{proyecto.nombre}</h1>
      <p className="kv-suave">
        <span className="kv-mono">{proyecto.folio}</span> · {proyecto.municipio}, {proyecto.estado}
        {proyecto.esMock && <> · <Link to={`/portal/${proyecto.folio}`}>Ver portal del cliente</Link></>}
      </p>

      {!disponible && (
        <p className="kv-suave" style={{ background: 'var(--kv-hielo)', padding: '8px 12px', borderRadius: 'var(--kv-radio)' }}>
          El expediente (documentos y vigencias) todavía no se lee desde Zoho: el checklist, los hallazgos y la carpeta física no están disponibles para este proyecto.
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0 0' }}>
        <Indicador etiqueta="PPC acumulado" valor={seg.ppc.porcentaje === null ? '—' : `${seg.ppc.porcentaje}%`} detalle={`${seg.ppc.cumplidas}/${seg.ppc.planeadas} actividades cumplidas a tiempo`} />
        <Indicador
          etiqueta="PAER última semana"
          valor={paerActual?.resultado.porcentaje == null ? '—' : `${paerActual.resultado.porcentaje}%`}
          detalle={paerActual ? `${paerActual.resultado.completadas}/${paerActual.resultado.total} acciones · meta >${META_PAER_PORCENTAJE}%${cumpleMetaPaer(paerActual.resultado) === false ? ' (no cumple)' : ''}` : 'Sin acciones acordadas'}
        />
        <Indicador etiqueta="Observaciones abiertas" valor={String(seg.resumenObservaciones.abiertas)} detalle={`${seg.resumenObservaciones.vencidas} vencidas · ${seg.resumenObservaciones.sinCompromiso} sin fecha compromiso`} />
        {disponible && <Indicador etiqueta="Hallazgos bloqueantes" valor={String(auditoria.bloqueantes.length)} />}
      </div>

      {disponible && (
        <>
          <h2>Hallazgos ({auditoria.bloqueantes.length} bloqueantes · {auditoria.advertencias.length} advertencias)</h2>
          <HallazgosPanel hallazgos={auditoria.hallazgos} />
        </>
      )}

      <h2>Compuertas</h2>
      <GateStepper compuertas={proyecto.compuertas} resumenes={resumenes} seleccionada={compuertaId} onSeleccionar={setCompuertaId} />

      {sincronizacion && compuerta && (
        <SincronizarCompuerta
          key={`${compuerta.id}-${compuerta.estado}`}
          folio={proyecto.folio} compuerta={compuerta} sincronizacion={sincronizacion} avisos={avisosLiberar} onSincronizado={() => void cargar()}
        />
      )}

      {resumen && (
        <>
          <h2>Checklist {resumen.compuerta}</h2>
          <ChecklistTable resumen={resumen} decision={puedeSolicitarCompuerta(resumen.compuerta, proyecto.compuertas, resumenes, auditoria.bloqueantes.length)} />
        </>
      )}

      <h2>Observaciones</h2>
      <ObservacionesTable observaciones={seg.observaciones} {...(sincronizacion && { onCerrar: (o: Observacion) => void cerrarObservacion(o) })} ocupado={cerrando} />
      {errorCierre && <p role="alert" style={{ color: 'var(--kv-error)' }}>{errorCierre}</p>}
      {sincronizacion && (
        <NuevaObservacionForm folio={proyecto.folio} compuertaInicial={compuertaId} sincronizacion={sincronizacion} onCreada={() => void cargar()} />
      )}

      {(proyecto.acciones.length > 0 || proyecto.esMock) && (
        <>
          <h2>Acuerdos semanales (Sprint de Energización)</h2>
          <AccionesTable acciones={proyecto.acciones} paerSemanal={seg.paerSemanal} />
        </>
      )}

      <h2>Cronograma</h2>
      {seg.actividades.length > 0
        ? <CronogramaTable actividades={seg.actividades} />
        : <p className="kv-suave">Sin actividades con fechas de inicio y fin.</p>}

      {disponible && (
        <>
          <h2>Carpeta física</h2>
          <p>
            {carpeta.listos}/{carpeta.total} documentos con firma o entrega física disponibles
            {carpeta.pendientes.length > 0 && <span className="kv-suave"> · Pendientes: {carpeta.pendientes.map((i) => i.requisito.nombre).join('; ')}</span>}
          </p>
        </>
      )}

      {s && (
        <>
          <h2>Sistema</h2>
          <table><tbody>
            <tr><th>Paneles</th><td>{s.numeroPaneles} × {s.potenciaPanelW} W</td></tr>
            <tr><th>Potencia DC</th><td>{potenciaDcKwp(s.numeroPaneles, s.potenciaPanelW)} kWp</td></tr>
            <tr><th>Potencia AC</th><td>{s.potenciaAcKw} kW</td></tr>
            <tr><th>Inversores</th><td>{s.numeroInversores} × {s.marcaInversor} {s.potenciaInversorKw} kW</td></tr>
            <tr><th>Transformador</th><td>{s.transformadorKva} kVA</td></tr>
          </tbody></table>
        </>
      )}
    </>
  );
}
