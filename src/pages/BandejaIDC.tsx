import { useEffect, useState, type FormEvent } from 'react';
import { CAUSAS_CORRECCION } from '@/application/revision-documental';
import { DocumentPreview } from '@/components/feature/DocumentPreview';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { puede } from '@/domain/usuarios/permisos';
import type { RequisitoDocumental } from '@/domain/checklist/catalogo';
import { catalogoRepositorio } from '@/infrastructure/catalogo';

type Estado = 'recibido' | 'en_revision' | 'prevalidado' | 'aceptado' | 'rechazado';
interface RecepcionIDC {
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

const estados: Record<Estado, string> = { recibido: 'Pendiente de revisión', en_revision: 'En revisión', prevalidado: 'Prevalidado por IDC', aceptado: 'Validado en expediente', rechazado: 'Requiere corrección' };
const ruta = '/api/admin/revision/recepciones';
const inicial = { folio: '', estado: '', tipo: '', desde: '' };

async function consultar(filtros: Record<string, string>, signal?: AbortSignal) {
  const r = await fetch(ruta + '?' + new URLSearchParams(filtros), { signal, cache: 'no-store' });
  if (!r.ok) throw new Error('No se pudieron consultar las recepciones. Revisa el acceso y el estado de Supabase.');
  return await r.json() as { recepciones: RecepcionIDC[]; hayMas: boolean };
}

export function BandejaIDC() {
  const { usuario } = useFuenteDatos();
  const autorizado = puede(usuario?.rol, 'gestionar_validaciones');
  const [campos, setCampos] = useState(inicial);
  const [filtros, setFiltros] = useState(inicial);
  const [offset, setOffset] = useState(0);
  const [filas, setFilas] = useState<RecepcionIDC[] | null>(null);
  const [anterior, setAnterior] = useState<RecepcionIDC[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [seleccion, setSeleccion] = useState<RecepcionIDC | null>(null);
  const [error, setError] = useState('');
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [causa, setCausa] = useState('');
  const [explicacion, setExplicacion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [intento, setIntento] = useState(0);
  const [catalogo, setCatalogo] = useState<RequisitoDocumental[] | null>(null);
  const [entrega, setEntrega] = useState({ folio: '', tipo: '', validar: false });
  const requisito = catalogo?.find((r) => r.tipo === seleccion?.documento_id);

  useEffect(() => {
    if (!autorizado) return;
    let vigente = true;
    void catalogoRepositorio.listarAdministrativo().then((r) => { if (vigente) setCatalogo(r); })
      .catch(() => { if (vigente) setCatalogo([]); });
    return () => { vigente = false; };
  }, [autorizado, intento]);

  useEffect(() => {
    if (!autorizado) return;
    const controlador = new AbortController();
    setFilas(null);
    void consultar({ ...filtros, offset: String(offset) }, controlador.signal).then((r) => {
      if (!controlador.signal.aborted) { setFilas(r.recepciones); setHayMas(r.hayMas); }
    }).catch((e: Error) => { if (!controlador.signal.aborted) setError(e.message); });
    return () => controlador.abort();
  }, [autorizado, filtros, offset, intento]);

  useEffect(() => {
    if (!seleccion) return;
    const controlador = new AbortController();
    setAnterior([]);
    setErrorHistorial(false);
    void consultar({ folio: seleccion.folio, tipo: seleccion.documento_id }, controlador.signal)
      .then((r) => { if (!controlador.signal.aborted) setAnterior(r.recepciones); })
      .catch(() => { if (!controlador.signal.aborted) setErrorHistorial(true); });
    return () => controlador.abort();
  }, [seleccion]);

  function filtrar(e: FormEvent) {
    e.preventDefault();
    setError(''); setSeleccion(null); setOffset(0); setFiltros({ ...campos });
  }

  async function revisar(decision: Estado | 'entregado') {
    if (!seleccion || ocupado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const r = await fetch(ruta + '/' + seleccion.id, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' },
        body: JSON.stringify({ decision, causa, mensaje: explicacion }),
      });
      if (r.status === 409) throw new Error(decision === 'aceptado' ? 'Verifica que la entrega física de esta versión esté registrada.' :
        'La versión cambió o falta completar la revisión obligatoria.');
      if (!r.ok) throw new Error('No se pudo guardar la revisión. Verifica el requisito y vuelve a intentar.');
      setMensaje(decision === 'entregado' ? 'Recepción física registrada.' : decision === 'prevalidado' ? 'Copia digital prevalidada.' :
        decision === 'aceptado' ? 'Documento validado y vinculado al expediente.' :
        decision === 'en_revision' ? 'La recepción quedó en revisión.' : 'Corrección solicitada al cliente.');
      setSeleccion(null);
      setIntento(intento + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la revisión.');
    } finally { setOcupado(false); }
  }

  async function guardarEntrega(e: FormEvent) {
    e.preventDefault();
    setOcupado(true); setError(''); setMensaje('');
    try {
      const r = await fetch('/api/admin/revision/entregas', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' },
        body: JSON.stringify(entrega),
      });
      if (!r.ok) throw new Error(r.status === 409 ? 'Revisa el requisito, la recepción previa y si existe una copia digital.' :
        'No se pudo registrar la entrega. Revisa el folio y el requisito.');
      setMensaje(entrega.validar ? 'Validación del documento físico registrada.' : 'Entrega física registrada.');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo registrar.'); }
    finally { setOcupado(false); }
  }

  if (!autorizado) return <AlertPanel tono="alerta">Tu sesión requiere permiso de revisión documental.</AlertPanel>;

  return <>
    <PageHeader titulo="Bandeja IDC" />
    <details>
      <summary>Registrar entrega física sin copia digital</summary>
      <form className="kv-filtros" onSubmit={(e) => void guardarEntrega(e)}>
        <label>Folio de entrega <input required value={entrega.folio} onChange={(e) => setEntrega({ ...entrega, folio: e.target.value })} /></label>
        <label>Requisito entregado <select required value={entrega.tipo} onChange={(e) => setEntrega({ ...entrega, tipo: e.target.value })}>
          <option value="">Selecciona</option>{catalogo?.filter((r) => r.activo && r.aportaCliente && r.tipo && r.revisionDigital !== 'obligatoria')
            .map((r) => <option key={r.codigo} value={r.tipo!}>{r.nombre}</option>)}
        </select></label>
        <label>Operación <select value={String(entrega.validar)} onChange={(e) => setEntrega({ ...entrega, validar: e.target.value === 'true' })}>
          <option value="false">Registrar recepción</option><option value="true">Registrar validación</option>
        </select></label>
        <Boton type="submit" disabled={ocupado}>Guardar entrega</Boton>
      </form>
    </details>
    <form className="kv-filtros" onSubmit={filtrar}>
      <label>Folio <input value={campos.folio} placeholder="KV-AAAA-000" onChange={(e) => setCampos({ ...campos, folio: e.target.value })} /></label>
      <label>Requisito <input value={campos.tipo} placeholder="recibo_cfe" onChange={(e) => setCampos({ ...campos, tipo: e.target.value })} /></label>
      <label>Estado <select value={campos.estado} onChange={(e) => setCampos({ ...campos, estado: e.target.value })}>
        <option value="">Todos</option>{Object.entries(estados).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
      <label>Desde <input type="date" value={campos.desde} onChange={(e) => setCampos({ ...campos, desde: e.target.value })} /></label>
      <Boton type="submit" disabled={ocupado}>Filtrar</Boton>
    </form>
    {error && <AlertPanel tono="error" acciones={<Boton onClick={() => { setError(''); setSeleccion(null); setIntento(intento + 1); }}>Actualizar</Boton>}>{error}</AlertPanel>}
    {mensaje && <p role="status">{mensaje}</p>}
    <div className="kv-bandeja">
      <section aria-label="Recepciones">
        {!filas && !error && <p role="status">Consultando recepciones…</p>}
        {filas?.length === 0 && <p>No hay recepciones con estos filtros.</p>}
        {!!filas?.length && <div className="kv-tabla-scroll"><table className="kv-tabla">
          <thead><tr><th>Recepción</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>{filas.map((r) => <tr key={r.id}>
            <td><button type="button" className="kv-btn kv-btn--secundario kv-btn--sm" aria-pressed={seleccion?.id === r.id}
              disabled={ocupado} onClick={() => { setSeleccion(r); setCausa(''); setExplicacion(''); }}>
              {r.documento_nombre}</button><div>{r.folio} · {r.recibo}</div></td>
            <td>{estados[r.estado]}{r.sustituye_recepcion_id && <div>Reenvío</div>}</td>
            <td><time dateTime={r.creado_en}>{r.creado_en.slice(0, 10)}</time></td>
          </tr>)}</tbody>
        </table></div>}
        <div className="kv-filtros">
          {offset > 0 && <Boton disabled={ocupado} onClick={() => setOffset(Math.max(0, offset - 50))}>Anteriores</Boton>}
          {filas && hayMas && <Boton disabled={ocupado} onClick={() => setOffset(offset + 50)}>Siguientes</Boton>}
        </div>
      </section>
      <section aria-label="Detalle de recepción">
        {!seleccion && <p>Selecciona una recepción para consultar el archivo y su revisión.</p>}
        {seleccion && <>
          <h2>{seleccion.documento_nombre}</h2>
          <p>{seleccion.folio} · {seleccion.recibo} · {estados[seleccion.estado]}</p>
          {requisito ? <details>
            <summary>Consultar requisito · {requisito.codigo}</summary>
            {requisito.descripcion && <p>{requisito.descripcion}</p>}
            {requisito.instruccionesCliente && <p>{requisito.instruccionesCliente}</p>}
            {requisito.camposEsperados.length > 0 && <ul>{requisito.camposEsperados.map((campo) => <li key={campo}>{campo}</li>)}</ul>}
            {requisito.requiereVigencia && <p>Revisar la vigencia declarada.</p>}
            {requisito.validacionIdc === 'pendiente' && <p>Guía pendiente de validación por IDC.</p>}
          </details> : <p className="kv-suave">{catalogo ? 'No se encontró el requisito en el catálogo disponible.' : 'Consultando requisito…'}</p>}
          <DocumentPreview url={'/api/admin/revision/archivos/' + seleccion.id} nombre={seleccion.archivo_nombre} mime={seleccion.mime} altura={380} />
          {seleccion.motivo_rechazo && <p>{seleccion.motivo_rechazo}</p>}
          {errorHistorial && <p role="alert">No se pudo consultar el historial de versiones.</p>}
          {anterior.some((r) => r.id !== seleccion.id) && <details><summary>Historial de envíos</summary><ul>
            {anterior.filter((r) => r.id !== seleccion.id).map((r) => <li key={r.id}>
              <a href={'/api/admin/revision/archivos/' + r.id} target="_blank" rel="noreferrer">{r.recibo} · {r.creado_en.slice(0, 10)}</a> · {estados[r.estado]}
            </li>)}
          </ul></details>}
          {(seleccion.estado === 'recibido' || seleccion.estado === 'en_revision') && <form onSubmit={(e) => { e.preventDefault(); void revisar('rechazado'); }}>
            <fieldset disabled={ocupado}>
              <legend>Decisión de IDC</legend>
              {seleccion.estado === 'recibido' && <Boton type="button" onClick={() => void revisar('en_revision')}>Iniciar revisión</Boton>}
              <Boton type="button" onClick={() => void revisar('prevalidado')}>Prevalidar copia</Boton>
              <label>Causa de corrección<select required value={causa} onChange={(e) => setCausa(e.target.value)}>
                <option value="">Selecciona una causa</option>
                {Object.entries(CAUSAS_CORRECCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
              <label>Explicación para el cliente<textarea required maxLength={500} value={explicacion} onChange={(e) => setExplicacion(e.target.value)} /></label>
              <Boton type="submit">Solicitar corrección</Boton>
            </fieldset>
          </form>}
          {seleccion.estado !== 'aceptado' && seleccion.estado !== 'rechazado' && <div className="kv-filtros">
            <Boton disabled={ocupado} onClick={() => void revisar('entregado')}>Registrar recepción física</Boton>
            <Boton disabled={ocupado} variante="primario" onClick={() => void revisar('aceptado')}>Validar definitivamente</Boton>
          </div>}
        </>}
      </section>
    </div>
  </>;
}
