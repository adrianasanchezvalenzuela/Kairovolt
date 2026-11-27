import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Camera,
  FileBadge,
  FileText,
  Fingerprint,
  Inbox,
  Map as MapIcon,
  Receipt,
  ScrollText,
  Workflow,
} from 'lucide-react';
import type { GuiaDocumentoCliente, Recepcion } from '@/application/portal-cliente';
import {
  EnlacePortal,
  IlustracionCroquis,
  IlustracionExpediente,
  IlustracionFotosSistema,
  PortadaPortal,
} from '@/components/portal/DisenoPortal';
import { ESTADO_DOCUMENTO } from '@/components/portal/estados';
import { SubirDocumento } from '@/components/portal/SubirDocumento';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Dialogo } from '@/components/ui/Dialogo';
import { EmptyState } from '@/components/ui/Estados';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ETIQUETA_CATEGORIA_PORTAL,
  ETIQUETA_EMISOR,
  ORDEN_CATEGORIAS_PORTAL,
  type CategoriaPortal,
  type ProgresoPreparacion,
} from '@/domain/checklist/preparacion';
import { evaluarElegibilidadCita } from '@/domain/citas/cita';
import { ETAPA_CLIENTE } from '@/domain/portal/textos';
import { usePortal, useVistaPortal } from '@/hooks/PortalContexto';
import { guardarPreparacionPortal, listarPreparacionPortal } from '@/infrastructure/portal-http';
import { CartaDemoPortal } from '@/components/portal/CartaDemoPortal';
import { GuiaSolicitud } from '@/components/portal/GuiaSolicitud';
import { DocumentosPorResponsable } from '@/components/portal/DocumentosPorResponsable';
import { esFolioDocumentalDemo } from '@/demo/expediente-demo';
import { GuiaVisualDocumento } from '@/components/portal/GuiasVisuales';
import { VistaArchivoPortal } from '@/components/portal/VistaArchivoPortal';
import { demosPortal } from '@/data/demos-portal';

const filtros = ['Todos', 'Pendientes', 'En revisión', 'Por corregir', 'Prevalidados', 'Validados'] as const;
const estadoRecibo = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  prevalidado: 'Prevalidado digitalmente',
  aceptado: 'Validado definitivamente',
  rechazado: 'Requiere corrección',
};
const iconos: Record<string, typeof FileText> = {
  recibo_cfe: Receipt,
  identificacion_oficial: Fingerprint,
  constancia_situacion_fiscal: FileBadge,
  carta_poder: ScrollText,
  croquis: MapIcon,
  diagrama_unifilar: Workflow,
  ficha_tecnica: FileText,
  certificado: BadgeCheck,
  solicitud: ScrollText,
  evidencia_fotografica: Camera,
  dictamen_uvie: FileBadge,
};

function inferirCategoria(id: string, g?: GuiaDocumentoCliente): CategoriaPortal {
  if (g?.categoriaPortal) return g.categoriaPortal;
  if (id === 'recibo_cfe') return 'servicio_electrico';
  if (id === 'croquis' || id === 'evidencia_fotografica') return 'ubicacion_instalacion';
  if (id === 'diagrama_unifilar' || id === 'ficha_tecnica' || id === 'certificado' || id === 'memoria_calculo') {
    return 'documentacion_tecnica';
  }
  if (id === 'solicitud' || id === 'dictamen_uvie' || id === 'certificado_uiie') return 'solicitudes_verificaciones';
  return 'identificacion_datos';
}

/** Demos documentales (005 y 006): documentos agrupados por responsable con el estado mock compartido con el panel IDC. */
export function PortalDocumentos() {
  const v = useVistaPortal();
  return v.demo && esFolioDocumentalDemo(v.folio) ? <DocumentosPorResponsable /> : <PortalDocumentosBase />;
}

function PortalDocumentosBase() {
  const v = useVistaPortal();
  const { subir } = usePortal();
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>('Todos');
  const [busqueda, setBusqueda] = useSearchParams();
  const abierto = busqueda.get('documento');
  const [ocupado, setOcupado] = useState(false);
  const [acuse, setAcuse] = useState<{ recepcion: Recepcion; guardado: boolean } | null>(null);
  const [progreso, setProgreso] = useState<ProgresoPreparacion[] | null>(null);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [preparacionError, setPreparacionError] = useState('');
  const [preparacionAviso, setPreparacionAviso] = useState('');
  const [revisionVisible, setRevisionVisible] = useState(false);
  const [versionElegida, setVersionElegida] = useState('');

  useEffect(() => {
    if (v.documentos === null) return;
    let vigente = true;
    void listarPreparacionPortal()
      .then((lista) => { if (vigente) setProgreso(lista); })
      .catch((e: Error) => { if (vigente) setPreparacionError(e.message); });
    return () => { vigente = false; };
  }, [v.folio, v.documentos === null]);

  useEffect(() => {
    if (abierto) setMarcadas(progreso?.find((p) => p.documento === abierto)?.marcadas ?? []);
    setVersionElegida('');
  }, [abierto, progreso]);

  if (v.documentos === null) {
    return <AlertPanel tono="info" titulo="Documentos no disponibles">Tu acceso no incluye esta sección. Si la necesitas, comunícate con IDC.</AlertPanel>;
  }

  const solicitudes = new Map(v.documentos.map((d) => [d.id, d]));
  const guias = new Map((v.guiaDocumental ?? []).map((g) => [g.id, g]));
  const elegibilidad = evaluarElegibilidadCita('entrega_expediente', v, progreso ?? []);

  // Documentos principales (obligatorios o condicionales con aplicabilidad confirmada)
  const principalesIds = v.documentos.filter((d) => d.estado !== 'no_aplica').map((d) => d.id);
  // Documentos adicionales condicionales pendientes de confirmar aplicabilidad (se muestran en sección aparte, nunca ocultos del catálogo)
  const condicionalesIds = (v.guiaDocumental ?? [])
    .filter((g) => !solicitudes.has(g.id) && g.aplicabilidad === 'pendiente_revision')
    .map((g) => g.id);

  const pasaFiltro = (id: string) => {
    const estado = solicitudes.get(id)?.estado;
    const preparado = progreso?.some((p) => p.documento === id && p.preparado);
    switch (filtro) {
      case 'Pendientes':
        return estado === 'pendiente' || estado === 'vencido' || estado === 'por_vencer' || (!estado && !preparado);
      case 'En revisión':
        return estado === 'recibido' || estado === 'en_revision';
      case 'Por corregir':
        return estado === 'rechazado';
      case 'Prevalidados':
        return estado === 'prevalidado';
      case 'Validados':
        return estado === 'aceptado';
      default:
        return true;
    }
  };

  const visiblesPrincipales = principalesIds.filter(pasaFiltro);
  const visiblesCondicionales = condicionalesIds.filter(pasaFiltro);

  const gruposPorCategoria = ORDEN_CATEGORIAS_PORTAL.map((cat) => ({
    categoria: cat,
    titulo: ETIQUETA_CATEGORIA_PORTAL[cat],
    ids: visiblesPrincipales.filter((id) => inferirCategoria(id, guias.get(id)) === cat),
  })).filter((g) => g.ids.length > 0);

  const guia = abierto ? guias.get(abierto) : undefined;
  const documento = abierto ? solicitudes.get(abierto) : undefined;
  const versiones = v.recepciones.filter((r) => r.documentoId === abierto);
  const recepcion = versiones.find((r) => r.recibo === versionElegida) ?? versiones[0];
  const actual = progreso?.find((p) => p.documento === abierto);
  const instrucciones = guia?.guiaPreparacion;
  const puntos = instrucciones?.comprobaciones ?? [];
  const mostrarRevision = !!documento && ['en_revision', 'recibido', 'rechazado', 'prevalidado', 'aceptado'].includes(documento.estado);
  const puedePreparar = !!documento && !mostrarRevision && documento.estado !== 'no_aplica' && (!guia?.condicion || guia.aplicabilidad === 'aplica');
  const puedeGenerarCarta = (id: string) =>
    id === 'carta_poder' && v.permisos.editarParticipantes && (v.demo || guias.get(id)?.generacionAutomatica === true);
  const permiteMultiples = guia?.permiteMultiples === true || instrucciones?.permiteMultiples === true;
  const capturaCamara = instrucciones?.capturaCamara === true;

  function abrirDetalle(id: string, abrirSubida = false) {
    setMarcadas(progreso?.find((p) => p.documento === id)?.marcadas ?? []);
    setPreparacionAviso('');
    setRevisionVisible(abrirSubida);
    setVersionElegida('');
    setBusqueda({ documento: id }, { replace: true });
  }

  async function guardar(preparado: boolean) {
    if (!abierto) return;
    setOcupado(true);
    setPreparacionError('');
    try {
      const guardado = await guardarPreparacionPortal({ documento: abierto, marcadas, preparado });
      setProgreso((lista) => [...(lista ?? []).filter((p) => p.documento !== guardado.documento), guardado]);
      setPreparacionAviso(preparado ? 'Marcado como preparado por ti.' : 'Lista guardada.');
    } catch (e) {
      setPreparacionError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  const badge = (id: string) => {
    const d = solicitudes.get(id);
    const g = guias.get(id);
    const rec = v.recepciones.find((r) => r.documentoId === id && !r.sustituida);
    const preparado = progreso?.some((p) => p.documento === id && p.preparado);
    if (!d) {
      return (
        <StatusBadge tono={g?.aplicabilidad === 'pendiente_revision' ? 'alerta' : 'neutro'} variante="suave">
          {g?.aplicabilidad === 'no_aplica' ? 'No aplica' : 'Aplicabilidad por confirmar'}
        </StatusBadge>
      );
    }
    if (preparado && d.estado === 'pendiente') {
      return <StatusBadge tono="ok" variante="suave">Preparado por ti</StatusBadge>;
    }
    return (
      <StatusBadge tono={ESTADO_DOCUMENTO[d.estado].tono} variante="suave">
        {d.estado === 'rechazado' && (rec?.causa === 'incompleto' || rec?.causa === 'faltan_datos')
          ? 'Información incompleta'
          : d.estado === 'en_revision' && rec?.estado === 'en_revision'
            ? 'En revisión por IDC'
            : d.estado === 'prevalidado'
              ? 'Prevalidado digitalmente'
              : d.estado === 'aceptado'
                ? 'Validado definitivamente'
                : ESTADO_DOCUMENTO[d.estado].texto}
      </StatusBadge>
    );
  };

  const subirYConfirmar: typeof subir = async (id, archivo, onProgreso) => {
    setOcupado(true);
    try {
      const resultado = await subir(id, archivo, onProgreso);
      setAcuse({ recepcion: resultado.recepcion, guardado: resultado.archivosGuardados });
      setVersionElegida('');
      return resultado;
    } finally {
      setOcupado(false);
    }
  };

  const renderTarjeta = (id: string) => {
    const d = solicitudes.get(id);
    const g = guias.get(id);
    const preparado = progreso?.some((p) => p.documento === id && p.preparado);
    const estado = d?.estado;
    const Icono = iconos[id] ?? FileText;
    const accion =
      estado === 'rechazado' || estado === 'vencido'
        ? 'Corregir mi documento'
        : estado === 'aceptado' || estado === 'prevalidado'
          ? 'Ver mi documento'
          : estado === 'en_revision' || estado === 'recibido'
            ? 'Consultar mi envío'
            : preparado
              ? 'Consultar preparación'
              : 'Preparar mi documento';
    const emisorEtiqueta = g?.emisorDocumento ? ETIQUETA_EMISOR[g.emisorDocumento] : null;
    const subtituloOrigen = emisorEtiqueta
      ? `Emite / elabora: ${emisorEtiqueta} · Puedes aportarlo`
      : 'Puedes prepararlo o subir tu copia';
    const descripcion =
      estado === 'rechazado'
        ? 'Tienes indicaciones de IDC para corregir y volver a enviar.'
        : estado === 'aceptado'
          ? 'IDC completó la validación definitiva de este documento.'
          : estado === 'prevalidado'
            ? 'Revisión digital favorable por IDC. Falta llevarlo en tu carpeta física.'
            : estado === 'en_revision' || estado === 'recibido'
              ? 'IDC está revisando tu versión enviada.'
              : preparado
                ? 'Marcaste este requisito como preparado por ti. También puedes solicitar revisión digital.'
                : g?.guiaPreparacion?.motivo ?? g?.descripcion;

    return (
      <li key={id} data-estado={preparado && estado === 'pendiente' ? 'preparado' : estado}>
        <span className="kv-cliente-docs__icono"><Icono size={22} aria-hidden="true" /></span>
        <div className="kv-cliente-docs__info">
          <small>{subtituloOrigen}</small>
          <h3>{d?.nombre ?? g?.nombre}</h3>
          {descripcion && <p>{descripcion}</p>}
        </div>
        <div className="kv-cliente-docs__acciones">
          {badge(id)}
          <button type="button" onClick={() => abrirDetalle(id, estado === 'rechazado' || estado === 'vencido')}>
            {accion}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="kv-cliente-intro">
        <PortadaPortal titulo="Preparemos tu expediente.">
          Te explicamos qué es cada documento, quién lo emite o elabora y cómo puedes aportarlo antes de tu visita a IDC.
        </PortadaPortal>
        <IlustracionExpediente variante="documentos" />
      </div>

      {elegibilidad.permitida && (
        <section className="kv-visita-banner" aria-label="Estado de preparación documental">
          <div>
            <span className="kv-cliente-etiqueta">Estado documental</span>
            <h2>{elegibilidad.etiquetaEstadoDocumental}</h2>
            <p>
              Todos los requisitos obligatorios aplicables ({elegibilidad.totalObligatorios} de {elegibilidad.totalObligatorios}) tienen revisión digital favorable.
              Esto no equivale a aceptación de CFE ni liberación automática de compuertas: el siguiente paso es coordinar tu entrega física.
            </p>
          </div>
          <EnlacePortal to="/portal/visita">
            <CalendarCheck2 size={17} aria-hidden="true" /> Preparar mi visita
          </EnlacePortal>
        </section>
      )}

      {acuse && !abierto && (
        <AlertPanel tono="ok" titulo="Archivo recibido" onCerrar={() => setAcuse(null)}>
          {acuse.recepcion.archivo} · Acuse <strong className="kv-mono">{acuse.recepcion.recibo}</strong>.
          {!acuse.guardado && ' El archivo de demostración no se conserva.'}
        </AlertPanel>
      )}

      <section className="kv-cliente-docs" aria-label="Requisitos documentales">
        <div className="kv-cliente-linea">
          <h2>Documentos de tu expediente</h2>
          <span>{visiblesPrincipales.length} de {principalesIds.length} requisitos aplicables</span>
        </div>
        {import.meta.env.DEV && v.demo && v.folio === demosPortal[1].folio && (
          <div style={{ marginTop: 8 }}>
            <EnlacePortal to="/portal/revision-demo" secundario>Simular revisión de IDC (demo)</EnlacePortal>
          </div>
        )}
        <div className="kv-cliente-filtros" role="group" aria-label="Filtrar documentos">
          {filtros.map((f) => (
            <button type="button" key={f} aria-pressed={f === filtro} onClick={() => setFiltro(f)}>
              {f}
            </button>
          ))}
        </div>

        {gruposPorCategoria.length === 0 && visiblesCondicionales.length === 0 ? (
          <EmptyState titulo="No hay documentos en esta vista" descripcion="Selecciona otro filtro para ver los requisitos disponibles." />
        ) : (
          <>
            {gruposPorCategoria.map((grupo) => (
              <section key={grupo.categoria} className="kv-doc-grupo">
                <h3>{grupo.titulo}</h3>
                <ul className="kv-doc-tarjetas">{grupo.ids.map(renderTarjeta)}</ul>
              </section>
            ))}
            {visiblesCondicionales.length > 0 && (
              <section className="kv-doc-grupo kv-doc-grupo--condicional">
                <h3>Documentos adicionales según tu caso</h3>
                <p className="kv-suave">IDC confirmará si alguno de estos requisitos aplica a tu proyecto.</p>
                <ul className="kv-doc-tarjetas">{visiblesCondicionales.map(renderTarjeta)}</ul>
              </section>
            )}
          </>
        )}
      </section>

      <section className="kv-cliente-seccion kv-cliente-recepciones">
        <h2><Inbox size={21} aria-hidden="true" /> Confirmaciones de recepción</h2>
        {v.recepciones.length === 0 ? (
          <EmptyState compacto titulo="Aún no hay confirmaciones" descripcion="Cada envío aparecerá aquí con su acuse." />
        ) : (
          <ul>
            {v.recepciones.map((r) => (
              <li key={r.recibo}>
                <div>
                  <strong>{r.documento}</strong>
                  <p>{r.archivo} · <span className="kv-mono">{r.recibo}</span></p>
                </div>
                <div>
                  <span>{r.sustituida ? 'Sustituido' : estadoRecibo[r.estado]}</span>
                  <time dateTime={r.fecha}>{r.fecha.slice(0, 10)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialogo
        abierto={!!(documento || guia)}
        titulo={documento?.nombre ?? guia?.nombre ?? 'Documento'}
        onCerrar={() => setBusqueda({}, { replace: true })}
        posicion="derecha"
        ocupado={ocupado}
      >
        {abierto && (
          <div className="kv-cliente-detalle kv-doc-guia">
            <header className="kv-doc-guia__portada">
              <div>
                {badge(abierto)}
                <h2>{mostrarRevision ? 'Seguimiento de tu documento' : 'Guía y preparación'}</h2>
              </div>
              <IlustracionExpediente variante={mostrarRevision ? 'validacion' : 'documentos'} />
            </header>

            {acuse?.recepcion.documentoId === abierto && (
              <AlertPanel tono="ok" titulo="Archivo recibido">
                Acuse <strong className="kv-mono">{acuse.recepcion.recibo}</strong>.
                {!acuse.guardado && ' El archivo de demostración no se conserva.'}
              </AlertPanel>
            )}

            {mostrarRevision && (
              <>
                {documento?.estado === 'rechazado' && (
                  <AlertPanel tono="error" titulo="IDC solicitó una corrección">
                    {versiones[0]?.motivo ?? documento.detalle}
                    {v.demo && <p>Comentario de demostración.</p>}
                  </AlertPanel>
                )}
                {documento?.estado === 'aceptado' && (
                  <AlertPanel tono="ok">IDC completó la validación definitiva de este documento.</AlertPanel>
                )}
                {documento?.estado === 'prevalidado' && (
                  <AlertPanel tono="info">
                    Tu copia digital cuenta con revisión favorable (prevalidada). La recepción física y la validación definitiva se registran por separado en IDC.
                  </AlertPanel>
                )}
                {documento?.estado === 'en_revision' && (
                  <AlertPanel tono="info">IDC está revisando tu archivo enviado. Te avisaremos en cuanto concluya la revisión.</AlertPanel>
                )}

                {recepcion ? (
                  <section className="kv-doc-bloque">
                    <h3>{recepcion.archivo}</h3>
                    <p>
                      Versión {versiones.length - versiones.indexOf(recepcion)} · {estadoRecibo[recepcion.estado]} · Envío {recepcion.fecha.slice(0, 10)}
                    </p>
                    {recepcion.revisadoEn && <p>Revisión {recepcion.revisadoEn.slice(0, 10)} · {recepcion.revisorPublico}</p>}
                    {recepcion.sustituida && recepcion.motivo && <p>{recepcion.motivo}</p>}
                    <VistaArchivoPortal recepcion={recepcion} />
                  </section>
                ) : (
                  <p className="kv-suave">El expediente no tiene una copia digital disponible todavía.</p>
                )}
                {puedeGenerarCarta(abierto) && (
                  <details className="kv-doc-bloque">
                    <summary>Generar Carta Poder</summary>
                    <CartaDemoPortal />
                  </details>
                )}
              </>
            )}

            {abierto === 'solicitud' && <GuiaSolicitud />}

            <details className="kv-doc-bloque" open={!mostrarRevision && abierto !== 'solicitud'}>
              <summary>Guía contextual de preparación y entrega</summary>
              {(documento ?? guia) && <p className="kv-suave">Etapa de referencia: {ETAPA_CLIENTE[(documento ?? guia)!.etapa].nombre}</p>}
              {instrucciones?.queEs && (
                <>
                  <h3>Qué es</h3>
                  <p>{instrucciones.queEs}</p>
                </>
              )}
              {instrucciones?.motivo && (
                <>
                  <h3>Para qué se solicita</h3>
                  <p>{instrucciones.motivo}</p>
                </>
              )}
              {instrucciones?.quienElabora && (
                <>
                  <h3>Quién lo elabora o emite</h3>
                  <p>{instrucciones.quienElabora}</p>
                </>
              )}
              {(instrucciones?.dondeConseguir || instrucciones?.oficial) && (
                <section className="kv-doc-bloque">
                  <h3>Dónde conseguirlo</h3>
                  {instrucciones.dondeConseguir && <p>{instrucciones.dondeConseguir}</p>}
                  {instrucciones.oficial && (
                    <a href={instrucciones.oficial} target="_blank" rel="noreferrer" className="kv-cliente-enlace">
                      Abrir sitio oficial
                    </a>
                  )}
                </section>
              )}

              {abierto && <GuiaVisualDocumento id={abierto} />}
              {instrucciones?.ilustracion === 'croquis' && <IlustracionCroquis />}
              {instrucciones?.ilustracion === 'fotos' && <IlustracionFotosSistema />}

              {!!instrucciones?.pasos?.length && (
                <>
                  <h3>Cómo prepararlo</h3>
                  <ol>{instrucciones.pasos.map((paso) => <li key={paso}>{paso}</li>)}</ol>
                </>
              )}

              {instrucciones?.comoSubir && (
                <>
                  <h3>Cómo subirlo</h3>
                  <p>{instrucciones.comoSubir}</p>
                </>
              )}

              {!mostrarRevision && documento?.detalle && <AlertPanel tono="info">{documento.detalle}</AlertPanel>}

              {guia && (
                <>
                  <dl>
                    <dt>Quién lo emite / elabora</dt>
                    <dd>{guia.emisorDocumento ? ETIQUETA_EMISOR[guia.emisorDocumento] : 'Según el tipo de documento'}</dd>
                    <dt>Quién puede aportarlo</dt>
                    <dd>Tú puedes subirlo aquí o IDC puede incorporarlo en el expediente</dd>
                    <dt>Revisión y validación</dt>
                    <dd>Siempre a cargo del equipo de IDC</dd>
                    {guia.requiereVigencia && (
                      <>
                        <dt>Vigencia</dt>
                        <dd>{documento?.vigencia ?? 'Verificar que esté vigente'}</dd>
                      </>
                    )}
                  </dl>
                  {(guia.validacionIdc === 'pendiente' || !instrucciones?.revisadaEn) && (
                    <p className="kv-cliente-nota">
                      Guía orientativa. No sustituye requisitos oficiales de CFE; confirma cualquier particularidad con IDC.
                    </p>
                  )}
                  {guia.condicion && <p>{guia.condicion}</p>}
                  {guia.camposEsperados.length > 0 && (
                    <>
                      <h3>Qué debe incluir</h3>
                      <ul>{guia.camposEsperados.map((c) => <li key={c}>{c}</li>)}</ul>
                    </>
                  )}
                  {guia.ejemplosAutorizados.length > 0 && (
                    <>
                      <h3>Ejemplos autorizados</h3>
                      <ul>{guia.ejemplosAutorizados.map((e) => <li key={e}>{e}</li>)}</ul>
                    </>
                  )}
                </>
              )}

              <section className="kv-doc-bloque kv-doc-bloque--entrega">
                <h3>Entrega física</h3>
                <p>{instrucciones?.entrega ?? 'Las indicaciones de entrega física están pendientes de confirmación por IDC.'}</p>
                {instrucciones?.originalOCopia && <p>{instrucciones.originalOCopia}</p>}
                {instrucciones?.firmas && <p>{instrucciones.firmas}</p>}
              </section>

              {instrucciones?.legibilidad && <p>{instrucciones.legibilidad}</p>}
              {instrucciones?.revisadaEn && <p>Guía revisada por IDC <time>{instrucciones.revisadaEn}</time></p>}

              {puedePreparar && (
                <fieldset className="kv-cliente-preparacion" disabled={ocupado || progreso === null}>
                  <legend>Qué revisar antes de enviarlo (preparación autónoma)</legend>
                  {puntos.length > 0 && <p>{marcadas.length} de {puntos.length} comprobaciones marcadas</p>}
                  {puntos.map((p, i) => (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={marcadas.includes(i)}
                        onChange={(e) => {
                          const marcado = e.target.checked;
                          setMarcadas((lista) => (marcado ? [...lista, i] : lista.filter((j) => j !== i)));
                        }}
                      />
                      {p}
                    </label>
                  ))}
                  {guia?.revisionDigital === 'obligatoria' && <p>Este requisito exige revisión digital por IDC.</p>}
                  <p className="kv-suave">Marcar «Preparado por ti» guarda tu avance personal y no equivale a validación de IDC.</p>
                  <div className="kvp-subir__controles">
                    {puntos.length > 0 && (
                      <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => void guardar(false)}>
                        Guardar lista
                      </button>
                    )}
                    <button
                      type="button"
                      className="kvp-boton"
                      disabled={marcadas.length !== puntos.length}
                      onClick={() => void guardar(!actual?.preparado)}
                    >
                      {actual?.preparado ? 'Volver a pendiente' : 'Ya lo tengo preparado'}
                    </button>
                  </div>
                </fieldset>
              )}
              {preparacionAviso && <p role="status">{preparacionAviso}</p>}
              {preparacionError && <AlertPanel tono="error">{preparacionError}</AlertPanel>}
            </details>

            {!mostrarRevision && puedeGenerarCarta(abierto) && <CartaDemoPortal />}

            {documento?.puedeSubir && (revisionVisible || permiteMultiples ? (
              <>
                <h3>
                  {documento.estado === 'rechazado'
                    ? 'Enviar documento corregido'
                    : permiteMultiples
                      ? 'Subir fotografías del sistema'
                      : 'Solicitar revisión digital'}
                </h3>
                <SubirDocumento
                  key={documento.id}
                  documento={documento}
                  onSubir={subirYConfirmar}
                  conservaArchivos={v.persistencia.archivos === 'supabase'}
                  multiple={permiteMultiples}
                  capturaCamara={capturaCamara}
                />
              </>
            ) : (
              <section className="kv-doc-bloque">
                <h3>Revisión digital por IDC</h3>
                <p>Si ya cuentas con el archivo, súbelo para que el equipo de IDC lo revise antes de tu visita.</p>
                <button type="button" className="kvp-boton" onClick={() => setRevisionVisible(true)}>
                  Subir archivo para revisión digital
                </button>
              </section>
            ))}

            {versiones.length > 0 && (
              <>
                <h3>Historial de envíos ({versiones.length})</h3>
                <ul className="kv-cliente-versiones">
                  {versiones.map((r) => (
                    <li key={r.recibo}>
                      <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setVersionElegida(r.recibo)}>
                        {r.archivo}
                      </button>
                      <span>{r.sustituida ? 'Sustituido' : estadoRecibo[r.estado]} · {r.fecha.slice(0, 10)}</span>
                      <code>{r.recibo}</code>
                      {r.motivo && <p>{r.motivo}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Dialogo>
    </>
  );
}
