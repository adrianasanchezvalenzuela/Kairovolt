import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CAUSAS_CORRECCION } from '@/application/revision-documental';
import { CitasIdcPanel } from '@/components/feature/CitasIdcPanel';
import { DocumentPreview } from '@/components/feature/DocumentPreview';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, LoadingState } from '@/components/ui/Estados';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { puede } from '@/domain/usuarios/permisos';
import type { RequisitoDocumental } from '@/domain/checklist/catalogo';
import { catalogoRepositorio } from '@/infrastructure/catalogo';
import '@/styles/bandeja-idc.css';

type Estado = 'recibido' | 'en_revision' | 'prevalidado' | 'aceptado' | 'rechazado';
export interface RecepcionIDC {
  id: string;
  folio: string;
  recibo: string;
  documento_id: string;
  documento_nombre: string;
  archivo_nombre: string;
  mime: string;
  estado: Estado;
  creado_en: string;
  motivo_rechazo: string | null;
  sustituye_recepcion_id: string | null;
}
interface RespuestaRecepciones { recepciones: RecepcionIDC[]; hayMas: boolean }
interface Filtros { folio: string; estado: string; tipo: string; desde: string }
type Decision = Estado | 'entregado';

const ESTADOS: Record<Estado, { texto: string; tono: 'alerta' | 'info' | 'ok' | 'error' }> = {
  recibido: { texto: 'Pendiente de revisión', tono: 'alerta' },
  en_revision: { texto: 'En revisión', tono: 'info' },
  prevalidado: { texto: 'Prevalidado', tono: 'info' },
  aceptado: { texto: 'Aceptado · validado en expediente', tono: 'ok' },
  rechazado: { texto: 'Requiere corrección', tono: 'error' },
};
const RUTA = '/api/admin/revision/recepciones';
const VACIOS: Filtros = { folio: '', estado: '', tipo: '', desde: '' };
const SIN_DEMO: readonly RecepcionIDC[] = [];
const tabs = [
  { id: 'documentos', etiqueta: 'Documentos recibidos' },
  { id: 'citas', etiqueta: 'Solicitudes de cita' },
] as const;

async function consultar(filtros: Record<string, string>, signal?: AbortSignal): Promise<RespuestaRecepciones> {
  const r = await fetch(RUTA + '?' + new URLSearchParams(filtros), { signal, cache: 'no-store' });
  if (!r.ok) throw new Error(r.status === 503
    ? 'La revisión documental no está disponible. Verifica la conexión del servidor con Supabase.'
    : 'No se pudieron consultar las recepciones. Revisa tu sesión y permisos.');
  return await r.json() as RespuestaRecepciones;
}

const fecha = (valor: string) => {
  const d = new Date(valor);
  return Number.isNaN(d.valueOf()) ? valor : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

function cifra(n: number | null, hayMas = false) {
  if (n === null) return '—';
  return hayMas ? `${n}+` : String(n);
}

export function BandejaIDC() {
  const { usuario } = useFuenteDatos();
  return <BandejaIDCContenido autorizado={puede(usuario?.rol, 'gestionar_validaciones')} />;
}

/** Punto de entrada exclusivo de la ruta de desarrollo aislada; nunca consulta permisos ni servicios. */
export function BandejaIDCContenidoDemo({ recepciones }: { recepciones: readonly RecepcionIDC[] }) {
  if (!import.meta.env.DEV) return null;
  return <BandejaIDCContenido autorizado modoDemo recepcionesDemo={recepciones} />;
}

function BandejaIDCContenido({ autorizado, modoDemo = false, recepcionesDemo = SIN_DEMO }: {
  autorizado: boolean;
  modoDemo?: boolean;
  recepcionesDemo?: readonly RecepcionIDC[];
}) {
  const [campos, setCampos] = useState(VACIOS);
  const [filtros, setFiltros] = useState(VACIOS);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'recientes' | 'antiguos'>('recientes');
  const [offset, setOffset] = useState(0);
  const [filas, setFilas] = useState<RecepcionIDC[] | null>(() => modoDemo ? [...recepcionesDemo] : null);
  const [anterior, setAnterior] = useState<RecepcionIDC[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [seleccion, setSeleccion] = useState<RecepcionIDC | null>(null);
  const [resumen, setResumen] = useState<{ pendientes: RespuestaRecepciones | null; aceptados: RespuestaRecepciones | null; rechazados: RespuestaRecepciones | null }>(() => modoDemo ? {
    pendientes: { recepciones: recepcionesDemo.filter((r) => r.estado === 'recibido'), hayMas: false },
    aceptados: { recepciones: recepcionesDemo.filter((r) => r.estado === 'aceptado'), hayMas: false },
    rechazados: { recepciones: recepcionesDemo.filter((r) => r.estado === 'rechazado'), hayMas: false },
  } : { pendientes: null, aceptados: null, rechazados: null });
  const [error, setError] = useState('');
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [causa, setCausa] = useState('');
  const [explicacion, setExplicacion] = useState('');
  const [errorRechazo, setErrorRechazo] = useState('');
  const [confirmacion, setConfirmacion] = useState<'aceptar' | 'rechazar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [intento, setIntento] = useState(0);
  const [catalogo, setCatalogo] = useState<RequisitoDocumental[] | null>(null);
  const [entrega, setEntrega] = useState({ folio: '', tipo: '', validar: false });
  const [pestana, setPestana] = useState('documentos');
  const requisito = catalogo?.find((r) => r.tipo === seleccion?.documento_id);
  const filtrosAdicionalesActivos = [filtros.folio, filtros.tipo, filtros.desde].filter(Boolean).length;
  const tiposDocumentales = modoDemo
    ? [...new Map((filas ?? []).map((r) => [r.documento_id, r.documento_nombre] as const))].map(([tipo, nombre]) => ({ tipo, nombre }))
    : catalogo?.filter((r) => r.tipo).map((r) => ({ tipo: r.tipo!, nombre: r.nombre })) ?? [];
  const tabsVisibles = modoDemo ? [tabs[0]!] : tabs;

  useEffect(() => {
    if (!autorizado || modoDemo) return;
    let vigente = true;
    void catalogoRepositorio.listarAdministrativo().then((r) => { if (vigente) setCatalogo(r); })
      .catch(() => { if (vigente) setCatalogo([]); });
    return () => { vigente = false; };
  }, [autorizado, intento, modoDemo]);

  useEffect(() => {
    if (!autorizado || modoDemo) return;
    const controlador = new AbortController();
    setFilas(null);
    setError('');
    void consultar({ ...filtros, offset: String(offset) }, controlador.signal).then((r) => {
      if (controlador.signal.aborted) return;
      setFilas(r.recepciones);
      setHayMas(r.hayMas);
      setSeleccion((actual) => actual && r.recepciones.some((x) => x.id === actual.id) ? actual : null);
    }).catch((e: Error) => { if (!controlador.signal.aborted) setError(e.message); });

    const base = { folio: filtros.folio, tipo: filtros.tipo, desde: filtros.desde, offset: '0' };
    void Promise.all([
      consultar({ ...base, estado: 'recibido' }, controlador.signal),
      consultar({ ...base, estado: 'aceptado' }, controlador.signal),
      consultar({ ...base, estado: 'rechazado' }, controlador.signal),
    ]).then(([pendientes, aceptados, rechazados]) => {
      if (!controlador.signal.aborted) setResumen({ pendientes, aceptados, rechazados });
    }).catch(() => {
      if (!controlador.signal.aborted) setResumen({ pendientes: null, aceptados: null, rechazados: null });
    });
    return () => controlador.abort();
  }, [autorizado, filtros, offset, intento, modoDemo]);

  useEffect(() => {
    if (!seleccion) { setAnterior([]); return; }
    if (modoDemo) {
      setErrorHistorial(false);
      setAnterior(recepcionesDemo.filter((r) => r.folio === seleccion.folio && r.documento_id === seleccion.documento_id));
      return;
    }
    const controlador = new AbortController();
    setAnterior([]);
    setErrorHistorial(false);
    void consultar({ folio: seleccion.folio, tipo: seleccion.documento_id, offset: '0' }, controlador.signal)
      .then((r) => { if (!controlador.signal.aborted) setAnterior(r.recepciones); })
      .catch(() => { if (!controlador.signal.aborted) setErrorHistorial(true); });
    return () => controlador.abort();
  }, [seleccion?.id, intento, modoDemo, recepcionesDemo]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-MX');
    const resultado = (filas ?? []).filter((r) => (!modoDemo ||
      ((!filtros.folio || r.folio.toLocaleLowerCase('es-MX').includes(filtros.folio.toLocaleLowerCase('es-MX'))) &&
        (!filtros.estado || r.estado === filtros.estado) && (!filtros.tipo || r.documento_id === filtros.tipo) &&
        (!filtros.desde || r.creado_en.slice(0, 10) >= filtros.desde))) &&
      (!q || `${r.folio} ${r.documento_nombre} ${r.archivo_nombre} ${r.recibo}`.toLocaleLowerCase('es-MX').includes(q)));
    return orden === 'recientes' ? resultado : [...resultado].reverse();
  }, [filas, busqueda, orden, modoDemo, filtros]);

  function filtrar(e: FormEvent) {
    e.preventDefault();
    setMensaje(''); setSeleccion(null); setOffset(0); setFiltros({ ...campos, folio: campos.folio.trim().toUpperCase() });
  }

  function limpiarFiltros() {
    setCampos(VACIOS); setFiltros(VACIOS); setBusqueda(''); setOffset(0); setSeleccion(null); setMensaje('');
  }

  function filtrarEstado(estado: string) {
    const nuevos = { ...filtros, estado };
    setCampos({ ...campos, estado }); setFiltros(nuevos); setOffset(0); setSeleccion(null); setMensaje('');
    setPestana('documentos');
  }

  async function revisar(decision: Decision) {
    if (modoDemo || !seleccion || ocupado) return;
    if (decision === 'rechazado' && (!causa || !explicacion.trim())) {
      setErrorRechazo('Selecciona una causa y escribe una explicación para el cliente.');
      return;
    }
    setOcupado(true); setError(''); setMensaje(''); setErrorRechazo('');
    try {
      const r = await fetch(RUTA + '/' + seleccion.id, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' },
        body: JSON.stringify({ decision, causa, mensaje: explicacion.trim() }),
      });
      if (r.status === 409) throw new Error(decision === 'aceptado'
        ? 'Para validar el documento, primero registra y valida la entrega física de esta versión.'
        : 'La versión cambió o el requisito necesita una revisión adicional. Actualiza la bandeja e inténtalo de nuevo.');
      if (!r.ok) throw new Error('No se pudo guardar la revisión. Verifica el requisito y vuelve a intentar.');
      setMensaje(decision === 'entregado' ? 'Recepción física registrada.' : decision === 'prevalidado' ? 'Copia digital prevalidada.' :
        decision === 'aceptado' ? 'Documento aceptado y vinculado al expediente.' : decision === 'en_revision' ? 'La recepción quedó en revisión.' :
          'Corrección solicitada. El motivo quedará visible para el cliente en el portal.');
      setConfirmacion(null); setSeleccion(null); setCausa(''); setExplicacion(''); setIntento((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la revisión.');
    } finally { setOcupado(false); }
  }

  async function guardarEntrega(e: FormEvent) {
    e.preventDefault();
    if (modoDemo) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      const r = await fetch('/api/admin/revision/entregas', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' }, body: JSON.stringify(entrega),
      });
      if (!r.ok) throw new Error(r.status === 409 ? 'Revisa el requisito, la recepción previa y si existe una copia digital.' : 'No se pudo registrar la entrega. Revisa el folio y el requisito.');
      setMensaje(entrega.validar ? 'Validación del documento físico registrada.' : 'Entrega física registrada.');
      setEntrega({ folio: '', tipo: '', validar: false }); setIntento((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar la entrega.'); }
    finally { setOcupado(false); }
  }

  if (!autorizado) return <AlertPanel tono="alerta">Tu sesión requiere permiso de revisión documental.</AlertPanel>;

  const conteo = (respuesta: RespuestaRecepciones | null) => cifra(respuesta?.recepciones.length ?? null, respuesta?.hayMas ?? false);

  return <>
    <PageHeader titulo="Bandeja de revisión" migas={[{ etiqueta: 'Panel', to: '/panel' }, { etiqueta: 'Bandeja IDC' }, ...(modoDemo ? [{ etiqueta: 'Demostración' }] : [])]}
      meta="Consulta y gestiona los documentos recibidos de los proyectos."
      acciones={modoDemo ? <StatusBadge tono="alerta" variante="suave" punto>DEMOSTRACIÓN · solo visual</StatusBadge> : import.meta.env.DEV ? <Link className="kv-btn kv-btn--secundario kv-btn--sm" to="/bandeja/demo">Vista previa</Link> : undefined} />
    {modoDemo
      ? <p className="kv-demo"><strong>DEMOSTRACIÓN:</strong> folios y documentos ficticios. Los filtros son locales; no se consultan ni modifican recepciones reales.</p>
      : <p className="kv-revision__contexto">Las recepciones y decisiones de esta bandeja se consultan en el servidor. La demo local está separada y no escribe en Supabase ni Zoho.</p>}

    <Tabs tabs={tabsVisibles} activa={pestana} onCambiar={setPestana} etiqueta="Secciones de Bandeja IDC">
      {pestana === 'citas' ? <CitasIdcPanel /> : <>
        <div className="kv-revision__resumen" aria-label="Resumen de recepciones">
          <button type="button" className="kv-revision__indicador kv-revision__indicador--pendiente" aria-pressed={filtros.estado === 'recibido'} onClick={() => filtrarEstado(filtros.estado === 'recibido' ? '' : 'recibido')}>
            <span>Pendientes</span><strong>{conteo(resumen.pendientes)}</strong><small>Por revisar</small>
          </button>
          <button type="button" className="kv-revision__indicador kv-revision__indicador--aceptado" aria-pressed={filtros.estado === 'aceptado'} onClick={() => filtrarEstado(filtros.estado === 'aceptado' ? '' : 'aceptado')}>
            <span>Aceptados</span><strong>{conteo(resumen.aceptados)}</strong><small>En expediente</small>
          </button>
          <button type="button" className="kv-revision__indicador kv-revision__indicador--rechazado" aria-pressed={filtros.estado === 'rechazado'} onClick={() => filtrarEstado(filtros.estado === 'rechazado' ? '' : 'rechazado')}>
            <span>Rechazados</span><strong>{conteo(resumen.rechazados)}</strong><small>Esperan corrección</small>
          </button>
        </div>
        <details className="kv-revision__entrega">
          <summary>{modoDemo ? 'Registro de entrega física · no disponible en demostración' : 'Registrar entrega física sin copia digital'}</summary>
          {modoDemo ? <p className="kv-revision__ayuda">Las operaciones de entrega y validación están deshabilitadas en esta vista.</p> : <form className="kv-filtros" onSubmit={(e) => void guardarEntrega(e)}>
            <label className="kv-campo">Folio del proyecto<input required value={entrega.folio} onChange={(e) => setEntrega({ ...entrega, folio: e.target.value })} /></label>
            <label className="kv-campo">Requisito entregado<select required value={entrega.tipo} onChange={(e) => setEntrega({ ...entrega, tipo: e.target.value })}>
              <option value="">Selecciona un requisito</option>{catalogo?.filter((r) => r.activo && r.aportaCliente && r.tipo && r.revisionDigital !== 'obligatoria').map((r) => <option key={r.codigo} value={r.tipo!}>{r.nombre}</option>)}
            </select></label>
            <label className="kv-campo">Operación<select value={String(entrega.validar)} onChange={(e) => setEntrega({ ...entrega, validar: e.target.value === 'true' })}>
              <option value="false">Registrar recepción</option><option value="true">Registrar validación</option>
            </select></label>
            <Boton type="submit" disabled={ocupado}>Guardar entrega</Boton>
          </form>}
        </details>

        <section className="kv-revision__seccion" aria-labelledby="recepciones-titulo">
          <header className="kv-revision__seccion-enc">
            <div><h2 id="recepciones-titulo">Documentos recibidos</h2><p>Selecciona un documento para consultar sus detalles y estado.</p></div>
            {filas && <span className="kv-revision__contador">{visibles.length} en esta página{hayMas ? ' · hay más resultados' : ''}</span>}
          </header>

          <form className="kv-revision__filtros" onSubmit={filtrar}>
            <div className="kv-revision__filtros-principales">
              <label className="kv-campo kv-revision__busqueda">Buscar en esta lista<input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Folio, documento, archivo o recibo" /></label>
              <label className="kv-campo">Estado<select value={campos.estado} onChange={(e) => setCampos({ ...campos, estado: e.target.value })}>
                <option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
              </select></label>
              <Boton type="submit" variante="primario">Aplicar filtros</Boton>
            </div>
            <details className="kv-revision__filtros-extra">
              <summary>Más filtros{filtrosAdicionalesActivos > 0 ? ` · ${filtrosAdicionalesActivos} activos` : ''}</summary>
              <div className="kv-revision__filtros-secundarios">
                <label className="kv-campo">Folio<input value={campos.folio} placeholder="KV-AAAA-000" onChange={(e) => setCampos({ ...campos, folio: e.target.value })} /></label>
                <label className="kv-campo">Tipo documental<select value={campos.tipo} onChange={(e) => setCampos({ ...campos, tipo: e.target.value })}>
                  <option value="">Todos los tipos</option>{tiposDocumentales.map((r) => <option key={r.tipo} value={r.tipo}>{r.nombre}</option>)}
                </select></label>
                <label className="kv-campo">Recibido desde<input type="date" value={campos.desde} onChange={(e) => setCampos({ ...campos, desde: e.target.value })} /></label>
                <label className="kv-campo">Ordenar por<select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}><option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select></label>
                <Boton type="button" variante="fantasma" onClick={limpiarFiltros}>Limpiar filtros</Boton>
              </div>
            </details>
          </form>
          {error && <AlertPanel tono="error" acciones={<Boton onClick={() => { setError(''); setIntento((n) => n + 1); }}>Actualizar</Boton>}>{error}</AlertPanel>}
          {mensaje && <p className="kv-revision__mensaje" role="status">{mensaje}</p>}

          {filas === null && !error && <LoadingState etiqueta="Consultando recepciones…" />}
          {filas && filas.length === 0 && <EmptyState titulo="No hay recepciones con estos filtros" descripcion="Prueba con otro folio, estado o tipo documental." />}
          {filas && filas.length > 0 && visibles.length === 0 && <EmptyState compacto titulo="Sin coincidencias en esta página" descripcion="Cambia el texto de búsqueda o consulta otra página." />}

          {!!visibles.length && <div className={`kv-revision__contenido${seleccion ? '' : ' kv-revision__contenido--solo-lista'}`}>
            <section className="kv-revision__lista" aria-label="Lista de recepciones">
              <div className="kv-revision__lista-cab"><span>Recepción</span><span>Estado</span><span>Fecha</span></div>
              {visibles.map((r) => <button key={r.id} type="button" className="kv-revision__fila" aria-pressed={seleccion?.id === r.id} onClick={() => { setSeleccion(r); setCausa(''); setExplicacion(''); setErrorRechazo(''); }}>
                <span className="kv-revision__doc"><strong>{r.documento_nombre}</strong><small>{r.folio} · {r.recibo}{r.sustituye_recepcion_id ? ' · Reenvío' : ''}</small><small className="kv-revision__archivo">{r.archivo_nombre}</small></span>
                <span><StatusBadge tono={ESTADOS[r.estado].tono} variante="suave">{ESTADOS[r.estado].texto}</StatusBadge></span>
                <time dateTime={r.creado_en}>{fecha(r.creado_en)}</time>
              </button>)}
              <div className="kv-revision__paginacion">
                <span>{offset + 1}–{offset + visibles.length}{hayMas ? '+' : ''}</span>
                <div>{offset > 0 && <Boton variante="secundario" tamano="sm" disabled={ocupado} onClick={() => setOffset(Math.max(0, offset - 50))}>Anteriores</Boton>}
                  {hayMas && <Boton variante="secundario" tamano="sm" disabled={ocupado} onClick={() => setOffset(offset + 50)}>Siguientes</Boton>}</div>
              </div>
            </section>

            {seleccion && <section className="kv-revision__detalle" aria-label="Detalle de la recepción seleccionada">
                <div className="kv-revision__detalle-enc"><div><span className="kv-revision__folio">{seleccion.folio}</span><h3>{seleccion.documento_nombre}</h3><p>{seleccion.recibo} · recibido {fecha(seleccion.creado_en)}</p></div><StatusBadge tono={ESTADOS[seleccion.estado].tono} variante="suave">{ESTADOS[seleccion.estado].texto}</StatusBadge></div>
                <dl className="kv-revision__datos"><div><dt>Archivo</dt><dd>{seleccion.archivo_nombre}</dd></div><div><dt>Tipo</dt><dd>{requisito?.codigo ?? seleccion.documento_id}</dd></div></dl>
                {requisito && <details className="kv-revision__requisito"><summary>Guía del requisito</summary><div>
                  {requisito.descripcion && <p>{requisito.descripcion}</p>}{requisito.instruccionesCliente && <p><strong>Instrucciones al cliente:</strong> {requisito.instruccionesCliente}</p>}
                  {requisito.camposEsperados.length > 0 && <ul>{requisito.camposEsperados.map((campo) => <li key={campo}>{campo}</li>)}</ul>}
                  {requisito.requiereVigencia && <p>Revisar la vigencia declarada.</p>}{requisito.validacionIdc === 'pendiente' && <p>La guía está pendiente de validación por IDC.</p>}
                </div></details>}
                {modoDemo ? <figure className="kv-vista kv-revision__vista-demo">
                  <figcaption className="kv-vista__barra"><span className="kv-vista__nombre">{seleccion.archivo_nombre}</span><StatusBadge tono="alerta" variante="suave">Archivo ilustrativo</StatusBadge></figcaption>
                  <div className="kv-vista__lienzo" style={{ minHeight: 230, padding: 14 }}>
                    <div className="kv-revision__documento-demo" aria-label="Representación visual ficticia de un documento">
                      <span>IDC · DOCUMENTO DE EJEMPLO</span><strong>{seleccion.documento_nombre}</strong><small>{seleccion.folio} · {seleccion.recibo}</small>
                      <div aria-hidden="true"><i /><i /><i /><i /><i /></div>
                      <p>Vista ilustrativa. No corresponde a un archivo recibido ni se carga desde ningún servicio.</p>
                    </div>
                  </div>
                </figure> : <DocumentPreview url={'/api/admin/revision/archivos/' + seleccion.id} nombre={seleccion.archivo_nombre} mime={seleccion.mime} altura={240} />}
                {seleccion.estado === 'rechazado' && seleccion.motivo_rechazo && <AlertPanel tono="error" titulo="Motivo comunicado al cliente">{seleccion.motivo_rechazo}</AlertPanel>}
                {errorHistorial && <p role="alert">No se pudo consultar el historial de envíos.</p>}
                {anterior.some((r) => r.id !== seleccion.id) && <details className="kv-revision__historial"><summary>Envíos anteriores ({anterior.filter((r) => r.id !== seleccion.id).length})</summary><ul>
                  {anterior.filter((r) => r.id !== seleccion.id).map((r) => <li key={r.id}>{modoDemo ? <span>{r.recibo} · {fecha(r.creado_en)}</span> : <a href={'/api/admin/revision/archivos/' + r.id} target="_blank" rel="noreferrer">{r.recibo} · {fecha(r.creado_en)}</a>}<StatusBadge tono={ESTADOS[r.estado].tono} variante="suave">{ESTADOS[r.estado].texto}</StatusBadge>{r.motivo_rechazo && <p>{r.motivo_rechazo}</p>}</li>)}
                </ul></details>}
                {(modoDemo || seleccion.estado === 'recibido' || seleccion.estado === 'en_revision') && <div className="kv-revision__decision">
                  <h4>Decisión de IDC</h4>
                  <p>Revisa el archivo y el requisito antes de registrar un estado.</p>
                  <div className="kv-revision__botones">
                    {(modoDemo || seleccion.estado === 'recibido') && <Boton variante="secundario" disabled={ocupado || modoDemo} onClick={() => void revisar('en_revision')}>Iniciar revisión</Boton>}
                    <Boton variante="peligro" disabled={ocupado || modoDemo} onClick={() => { setErrorRechazo(''); setConfirmacion('rechazar'); }}>Solicitar corrección</Boton>
                    <Boton variante="primario" disabled={ocupado || modoDemo} onClick={() => setConfirmacion('aceptar')}>Validar definitivamente</Boton>
                  </div>
                  <details className="kv-revision__otras-acciones">
                    <summary>Más acciones de revisión</summary>
                    <div className="kv-revision__botones"><Boton variante="secundario" disabled={ocupado || modoDemo} onClick={() => void revisar('prevalidado')}>Prevalidar copia</Boton></div>
                  </details>
                  <p className="kv-revision__nota">{modoDemo ? 'Acciones no disponibles en la demostración.' : 'La aceptación exige que la entrega física de esta versión esté registrada y validada.'}</p>
                </div>}
                {(modoDemo || (seleccion.estado !== 'aceptado' && seleccion.estado !== 'rechazado')) && <details className="kv-revision__entrega-doc"><summary>{modoDemo ? 'Registrar entrega física · no disponible' : 'Registrar entrega física de este requisito'}</summary>
                  <p>Úsalo cuando el cliente entregó el documento en IDC y no hay una copia digital que registrar.</p>
                  <div className="kv-revision__botones"><Boton variante="secundario" disabled={ocupado || modoDemo} onClick={() => void revisar('entregado')}>Registrar recepción</Boton></div>
                </details>}
            </section>}
          </div>}
        </section>
      </>}
    </Tabs>

    {!modoDemo && <ConfirmationModal abierto={confirmacion === 'aceptar'} titulo="Validar documento" tono="info" confirmarTexto="Aceptar documento" ocupado={ocupado}
      onCancelar={() => setConfirmacion(null)} onConfirmar={() => void revisar('aceptado')}>
      {seleccion && <>Vas a aceptar <strong>{seleccion.documento_nombre}</strong> del proyecto <strong>{seleccion.folio}</strong>. El archivo quedará vinculado al expediente. La operación requiere entrega física registrada y validada.</>}
    </ConfirmationModal>}
    {!modoDemo && <ConfirmationModal abierto={confirmacion === 'rechazar'} titulo="Solicitar corrección" tono="error" confirmarTexto="Enviar motivo al cliente" ocupado={ocupado}
      onCancelar={() => setConfirmacion(null)} onConfirmar={() => void revisar('rechazado')}>
      {seleccion && <div className="kv-revision__rechazo-form"><p>El motivo quedará visible para el cliente en su portal.</p>
        <label className="kv-campo">Causa<select value={causa} onChange={(e) => setCausa(e.target.value)}>
          <option value="">Selecciona una causa</option>{Object.entries(CAUSAS_CORRECCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label className="kv-campo">Explicación para el cliente<textarea maxLength={500} rows={4} value={explicacion} onChange={(e) => setExplicacion(e.target.value)} placeholder="Describe qué debe corregir o volver a enviar." /></label>
        {errorRechazo && <p role="alert" className="kv-revision__error-form">{errorRechazo}</p>}
      </div>}
    </ConfirmationModal>}
  </>;
}
