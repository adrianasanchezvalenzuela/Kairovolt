import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { documentosVencidos, hoyIso } from '@/application/analizar-proyecto';
import { alertasDeProyecto } from '@/application/cartera';
import { historialProyecto } from '@/application/historial';
import { ErrorSincronizacion } from '@/application/sincronizacion';
import { cumpleMetaPaer, META_PAER_PORCENTAJE } from '@/domain/indicadores/paer';
import type { Observacion } from '@/domain/observaciones/observacion';
import { potenciaDcKwp } from '@/domain/proyecto/potencia';
import { puede } from '@/domain/usuarios/permisos';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { useProyectoCompleto } from '@/hooks/useExpediente';
import { useConfirmacion } from '@/hooks/useConfirmacion';
import { AccionesTable } from '@/components/feature/AccionesTable';
import { CronogramaTable } from '@/components/feature/CronogramaTable';
import { DocumentosProyecto } from '@/components/feature/DocumentosProyecto';
import { AccesoPortalPanel } from '@/components/feature/AccesoPortalPanel';
import { HistorialProyecto } from '@/components/feature/HistorialProyecto';
import { NuevaObservacionForm } from '@/components/feature/NuevaObservacionForm';
import { ObservacionesTable } from '@/components/feature/ObservacionesTable';
import { PanelEvidencia } from '@/components/feature/PanelEvidencia';
import { StageGatePanel } from '@/components/feature/StageGatePanel';
import { TiemposTabla } from '@/components/feature/TiemposTabla';
import { ValidacionesProyecto } from '@/components/feature/ValidacionesProyecto';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';

const TABS = ['resumen', 'documentos', 'validaciones', 'cronograma', 'historial'] as const;
type TabId = (typeof TABS)[number];
const esTab = (v: string | null): v is TabId => TABS.includes(v as TabId);

export function ProyectoDetalle() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { sincronizacion } = useFuenteDatos();
  const pc = useProyectoCompleto(id);
  const { confirmar, modal } = useConfirmacion();
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [evidencia, setEvidencia] = useState<string | null>(null);

  const tab: TabId = esTab(params.get('tab')) ? (params.get('tab') as TabId) : 'resumen';
  const enfocar = params.get('huella');
  const cambiarTab = (t: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', t); n.delete('huella'); return n; }, { replace: true });

  // Al llegar desde una alerta, lleva la validación señalada a la vista.
  useEffect(() => {
    if (tab !== 'validaciones' || !enfocar || !pc.analisis) return;
    document.getElementById(`val-${enfocar}`)?.scrollIntoView({ block: 'center' });
  }, [tab, enfocar, pc.analisis]);

  if (pc.error) return <ErrorState titulo="No se pudo cargar el proyecto" detalle={pc.error} onReintentar={() => void pc.recargar()} />;
  if (pc.cargando) return <LoadingState etiqueta="Cargando proyecto…" />;
  if (pc.noEncontrado || !pc.proyecto || !pc.analisis || !pc.decisiones) {
    return <EmptyState titulo="Proyecto no encontrado" descripcion="Es posible que el folio ya no exista en la fuente de datos." acciones={<Link to="/proyectos" className="kv-btn kv-btn--secundario">Volver a proyectos</Link>} />;
  }

  const { proyecto, analisis, decisiones, permisos, usuario, fuente } = pc;
  const hoy = hoyIso();
  const s = proyecto.sistema;
  const paerActual = analisis.seguimiento.paerSemanal.at(-1);
  const alertas = alertasDeProyecto({ proyecto, analisis });
  const nombreUsuario = usuario?.nombre ?? usuario?.correo ?? null;
  const documentoEvidencia = proyecto.documentos.find((d) => d.id === evidencia) ?? null;

  const cerrarObservacionZoho = async (o: Observacion) => {
    if (!sincronizacion) return;
    const acepta = await confirmar({ titulo: 'Cerrar observación', mensaje: <>La observación se marcará como cerrada en Zoho CRM: <em>{o.descripcion}</em></>, confirmarTexto: 'Cerrar en Zoho', tono: 'alerta' });
    if (!acepta) return;
    setCerrando(true);
    setErrorCierre(null);
    try {
      await sincronizacion.observacion({ folio: proyecto.folio, observacionId: o.id, compuerta: o.compuerta, origen: o.origen, estado: 'cerrada', descripcion: o.descripcion, fechaCompromiso: o.fechaCompromiso, responsable: o.responsable });
      await pc.recargar();
    } catch (e) {
      setErrorCierre(e instanceof ErrorSincronizacion ? e.message : 'Error inesperado.');
    } finally {
      setCerrando(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'resumen', etiqueta: 'Resumen' },
    { id: 'documentos', etiqueta: 'Documentos', extra: analisis.disponible && analisis.checklist.some((r) => !r.completa) ? <StatusBadge tono="alerta" variante="suave">{analisis.checklist.reduce((n, r) => n + r.faltantes.length, 0)} faltan</StatusBadge> : null },
    { id: 'validaciones', etiqueta: 'Validaciones', extra: analisis.pendientes.length > 0 ? <StatusBadge tono="error" variante="solido">{analisis.pendientes.length}</StatusBadge> : null },
    { id: 'cronograma', etiqueta: 'Cronograma' },
    { id: 'historial', etiqueta: 'Historial' },
  ];

  return (
    <>
      {modal}
      <PageHeader
        titulo={proyecto.nombre}
        migas={[{ etiqueta: 'Proyectos', to: '/proyectos' }, { etiqueta: proyecto.folio }]}
        meta={<><span className="kv-mono">{proyecto.folio}</span> · {proyecto.municipio}, {proyecto.estado} · {proyecto.cliente}</>}
        acciones={proyecto.esMock && <Link to="/portal" className="kv-btn kv-btn--secundario kv-btn--sm">Abrir el portal del cliente</Link>}
      />
      {proyecto.esMock && <p className="kv-demo"><strong>Caso demostrativo:</strong> datos de prueba (no son los del proyecto real). Las inconsistencias reproducen el caso de 40 kW; los documentos no tienen archivos.</p>}

      <Tabs tabs={tabs} activa={tab} onCambiar={cambiarTab} etiqueta="Secciones del proyecto">
        {tab === 'resumen' && (
          <>
            <KPIGrid etiqueta="Indicadores del proyecto">
              <KPI etiqueta="Bloqueantes sin resolver" tono={analisis.pendientes.length > 0 ? 'error' : 'ok'} valor={analisis.disponible ? String(analisis.pendientes.length) : null} detalle={analisis.disponible ? 'Sin resolver ni excepción aprobada' : 'Expediente no disponible'} />
              <KPI etiqueta="PPC acumulado" valor={analisis.seguimiento.ppc.porcentaje === null ? null : `${analisis.seguimiento.ppc.porcentaje}%`} detalle={`${analisis.seguimiento.ppc.cumplidas}/${analisis.seguimiento.ppc.planeadas} actividades cumplidas a tiempo`} />
              <KPI
                etiqueta="PAER última semana" tono={paerActual && cumpleMetaPaer(paerActual.resultado) === false ? 'alerta' : 'ok'}
                valor={paerActual?.resultado.porcentaje == null ? null : `${paerActual.resultado.porcentaje}%`}
                detalle={paerActual ? `${paerActual.resultado.completadas}/${paerActual.resultado.total} acciones · meta >${META_PAER_PORCENTAJE}%${cumpleMetaPaer(paerActual.resultado) === false ? ' (no cumple)' : ''}` : 'Sin acciones acordadas'}
              />
              <KPI etiqueta="Observaciones abiertas" tono={analisis.seguimiento.resumenObservaciones.vencidas > 0 ? 'error' : 'ok'} valor={String(analisis.seguimiento.resumenObservaciones.abiertas)} detalle={`${analisis.seguimiento.resumenObservaciones.vencidas} vencidas · ${analisis.seguimiento.resumenObservaciones.sinCompromiso} sin fecha compromiso`} />
            </KPIGrid>

            {alertas.length > 0 && (
              <>
                <h2>Requiere atención</h2>
                <ul className="kv-lista-alertas">
                  {alertas.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <AlertPanel tono={a.severidad === 'bloqueante' ? 'error' : a.severidad === 'mayor' ? 'alerta' : 'info'} titulo={a.titulo} variante="en-linea" anunciar={false}>
                        {a.detalle} <Link to={a.to}>Atender</Link>
                      </AlertPanel>
                    </li>
                  ))}
                </ul>
                {alertas.length > 6 && <p className="kv-suave">y {alertas.length - 6} más en la pestaña correspondiente.</p>}
              </>
            )}

            <h2>Stage-Gate</h2>
            <StageGatePanel
              proyecto={proyecto} analisis={analisis}
              puedeLiberar={permisos.liberarCompuertas} puedeGestionar={permisos.gestionarValidaciones}
              permiteSimular={fuente === 'zoho' && sincronizacion !== null}
              destinoCambio={fuente === 'zoho' ? 'Zoho Projects (datos reales)' : 'este navegador (datos de prueba)'}
              vencidos={documentosVencidos(analisis)}
              onAbrirDocumento={setEvidencia}
              onCambiar={async (c) => {
                const r = await pc.cambiarCompuerta(c.compuerta, c.a, { comentario: c.comentario, simular: c.simular });
                if (r.tipo === 'simulado') return `Simulación: no se escribió nada en Zoho (${JSON.stringify(r.resultado.tipo === 'simulado' ? r.resultado.peticion : r.resultado)}).`;
                return r.tipo === 'zoho' ? `${c.compuerta} actualizada en Zoho Projects.` : `${c.compuerta} actualizada en este navegador (datos de prueba).`;
              }}
            />

            {puede(usuario?.rol, 'gestionar_portal') && (
              <>
                <h2>Portal del cliente</h2>
                <AccesoPortalPanel folio={proyecto.folio} />
              </>
            )}

            <div className="kv-dos-col">
              <div>
                <h2>Observaciones</h2>
                <ObservacionesTable observaciones={analisis.seguimiento.observaciones} {...(sincronizacion && { onCerrar: (o: Observacion) => void cerrarObservacionZoho(o) })} ocupado={cerrando} />
                {errorCierre && <AlertPanel tono="error" onCerrar={() => setErrorCierre(null)}>{errorCierre}</AlertPanel>}
                {sincronizacion && <NuevaObservacionForm folio={proyecto.folio} compuertaInicial="G1" sincronizacion={sincronizacion} onCreada={() => void pc.recargar()} />}
              </div>
              <div>
                <h2>Datos del sistema</h2>
                {s ? (
                  <dl className="kv-dato">
                    <dt>Paneles</dt><dd>{s.numeroPaneles} × {s.potenciaPanelW} W</dd>
                    <dt>Potencia DC</dt><dd>{potenciaDcKwp(s.numeroPaneles, s.potenciaPanelW)} kWp</dd>
                    <dt>Potencia AC</dt><dd>{s.potenciaAcKw} kW</dd>
                    <dt>Inversores</dt><dd>{s.numeroInversores} × {s.marcaInversor} {s.potenciaInversorKw} kW</dd>
                    <dt>Transformador</dt><dd>{s.transformadorKva} kVA</dd>
                  </dl>
                ) : <p className="kv-suave">La fuente no trae los datos técnicos del sistema.</p>}
                {analisis.disponible && <p className="kv-suave" style={{ marginTop: 12 }}>Carpeta física: {analisis.carpetaFisica.listos}/{analisis.carpetaFisica.total} documentos con firma o entrega física disponibles.</p>}
              </div>
            </div>
          </>
        )}

        {tab === 'documentos' && <DocumentosProyecto proyecto={proyecto} analisis={analisis} />}

        {tab === 'validaciones' && (
          <ValidacionesProyecto
            proyecto={proyecto} analisis={analisis} permisos={permisos} usuario={nombreUsuario} hoy={hoy} enfocar={enfocar}
            acciones={{ registrarObservacion: pc.registrarObservacion, asignarResponsable: pc.asignarResponsable, resolver: pc.resolver }}
          />
        )}

        {tab === 'cronograma' && (
          <>
            {analisis.seguimiento.actividades.length > 0
              ? <CronogramaTable actividades={analisis.seguimiento.actividades} />
              : <EmptyState compacto titulo="Sin cronograma" descripcion="No hay actividades con fechas de inicio y fin." />}
            {analisis.tiempos && (
              <>
                <h2>Tiempos del proceso</h2>
                <TiemposTabla tiempos={analisis.tiempos.entreHitos} />
              </>
            )}
            {(proyecto.acciones.length > 0 || proyecto.esMock) && (
              <>
                <h2>Acuerdos semanales (Sprint de Energización)</h2>
                <AccionesTable acciones={proyecto.acciones} paerSemanal={analisis.seguimiento.paerSemanal} />
              </>
            )}
          </>
        )}

        {tab === 'historial' && <HistorialProyecto eventos={historialProyecto(proyecto, decisiones)} />}
      </Tabs>
      <PanelEvidencia documento={documentoEvidencia} onCerrar={() => setEvidencia(null)} />
    </>
  );
}
