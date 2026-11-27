import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ClipboardCheck, ExternalLink, FileSearch, Mail, MessageSquareWarning, RotateCcw, Send, ShieldCheck, Upload } from 'lucide-react';
import { Cargador, fecha, Pastilla, VisorArchivo, Versiones } from '@/components/portal/DocumentosPorResponsable';
import { Dialogo } from '@/components/ui/Dialogo';
import { registrarArchivoSubido } from '@/demo/archivos-demo';
import {
  accionesDemo, DOCUMENTOS_DEMO, definicion, esFavorable, esFolioDocumentalDemo, FOLIO_DEMO_ENTREGA, FOLIO_DEMO_PREPARACION,
  LEYENDA_DEMO, textoEstado, useExpedienteDemo, type DefDocumento, type DocEstado, type Grupo,
} from '@/demo/expediente-demo';
import '@/styles/idc-demo.css';

const FOLIOS = [
  { folio: FOLIO_DEMO_PREPARACION, nombre: 'Demo 2 · Preparación documental' },
  { folio: FOLIO_DEMO_ENTREGA, nombre: 'Demo 3 · Listo para entrega física' },
];
const SECCIONES: { id: Grupo; titulo: string; nota: string }[] = [
  { id: 'cliente', titulo: 'Documentos del cliente', nota: 'El cliente los sube; IDC los revisa y prevalida.' },
  { id: 'conjunto', titulo: 'Solicitud compartida', nota: 'IDC la prepara con los datos del cliente; el cliente la firma y la devuelve.' },
  { id: 'idc', titulo: 'Documentación técnica de IDC', nota: 'Solo IDC la carga y la sustituye. El cliente únicamente la consulta.' },
];
const FRASES = ['Falta firma o sello.', 'El archivo está borroso o cortado.', 'Los datos no coinciden con el recibo CFE.'];

export function IdcDemo() {
  const { folio = FOLIO_DEMO_PREPARACION } = useParams();
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  if (!esFolioDocumentalDemo(folio)) return <Navigate to={'/idc/' + FOLIO_DEMO_PREPARACION} replace />;
  return <Panel key={folio} folio={folio} />;
}

function Panel({ folio }: { folio: string }) {
  const e = useExpedienteDemo(folio);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const def = abierto ? definicion(abierto) : undefined;
  const listos = DOCUMENTOS_DEMO.filter((d) => esFavorable(e.docs[d.id]?.estado ?? 'pendiente')).length;
  const porRevisar = DOCUMENTOS_DEMO.filter((d) => e.docs[d.id]?.estado === 'en_revision').length;
  const reportes = DOCUMENTOS_DEMO.reduce((n, d) => n + (e.docs[d.id]?.reportes.length ?? 0), 0);
  const flash = (t: string) => { setAviso(t); setTimeout(() => setAviso(''), 5000); };
  const get = (id: string): DocEstado => e.docs[id] ?? { estado: 'pendiente', versiones: [], reportes: [] };

  return <div className="kvp kv-idc">
    <header className="kv-idc__barra">
      <Link to="/" className="kv-idc__marca"><img src="/brand/kairovolt-logo.svg" alt="" width="38" height="38" /><span><strong>KairóVolt</strong><small>Panel IDC · demostración</small></span></Link>
      <nav aria-label="Expediente de demostración">{FOLIOS.map((f) => <Link key={f.folio} to={'/idc/' + f.folio} aria-current={f.folio === folio ? 'page' : undefined}>{f.nombre}</Link>)}</nav>
      <Link className="kv-idc__ver" to="/portal/demos"><ExternalLink size={15} aria-hidden="true" /> Ver como cliente</Link>
    </header>

    <main className="kv-idc__contenido">
      <section className="kv-idc__titulo">
        <span className="kv-cliente-etiqueta">Expediente {folio}</span>
        <h1>Documentos del expediente</h1>
        <p>Lo que hagas aquí se refleja al instante en el portal del cliente. Datos ficticios; no se envían correos ni se escribe en Supabase o Zoho.</p>
        <div className="kv-idc__cifras">
          <div><strong>{listos}<small>/ {DOCUMENTOS_DEMO.length}</small></strong><span>prevalidados o disponibles</span></div>
          <div><strong>{porRevisar}</strong><span>por revisar</span></div>
          <div><strong>{reportes}</strong><span>reportes del cliente</span></div>
          <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => { accionesDemo.reiniciar(folio); flash('Expediente reiniciado.'); }}><RotateCcw size={15} aria-hidden="true" /> Reiniciar este folio</button>
        </div>
      </section>
      {aviso && <div className="kv-gr-toast" role="status"><Check size={18} aria-hidden="true" /> {aviso}</div>}

      {SECCIONES.map((s) => <section key={s.id} className={'kv-idc__grupo kv-idc__grupo--' + s.id}>
        <header><h2>{s.titulo}</h2><p>{s.nota}</p></header>
        <ul>{DOCUMENTOS_DEMO.filter((d) => d.grupo === s.id).map((d) => {
          const doc = get(d.id);
          const rev = doc.estado === 'en_revision';
          return <li key={d.id}>
            <div><strong>{d.nombre}</strong>
              <small>{doc.versiones.length ? `v${doc.versiones.length} · ${doc.versiones.at(-1)!.autor === 'idc' ? 'cargada por IDC' : 'enviada por el cliente'} · ${fecha(doc.versiones.at(-1)!.fecha)}` : 'Sin archivo'}
                {doc.reportes.length > 0 && <b className="kv-idc__reporte"> · {doc.reportes.length} reporte(s) del cliente</b>}</small></div>
            <Pastilla id={d.id} estado={doc.estado} />
            <button type="button" className={'kvp-boton' + (rev || (d.grupo === 'idc' && doc.estado !== 'disponible') ? '' : ' kvp-boton--suave')} onClick={() => setAbierto(d.id)}>
              {rev ? <><FileSearch size={16} aria-hidden="true" /> Revisar</> : d.grupo === 'idc' ? <><Upload size={16} aria-hidden="true" /> Gestionar</> : d.id === 'solicitud' && doc.estado === 'en_preparacion' ? <><ClipboardCheck size={16} aria-hidden="true" /> Preparar</> : <>Abrir <ArrowRight size={15} aria-hidden="true" /></>}
            </button>
          </li>;
        })}</ul>
      </section>)}

      <section className="kv-idc__correos">
        <h2><Mail size={18} aria-hidden="true" /> Correos simulados al cliente</h2>
        {e.avisos.length === 0 ? <p className="kv-suave">Aún no se ha generado ninguno en este recorrido.</p> :
          <ul>{e.avisos.slice(0, 6).map((a) => <li key={a.id}><strong>{a.correo.asunto}</strong><small>Para {a.correo.para} · {fecha(a.fecha)} · simulado, sin envío real</small></li>)}</ul>}
      </section>
      <p className="kv-cliente-legal">{LEYENDA_DEMO}.</p>
    </main>

    <Dialogo abierto={!!def} titulo={def?.nombre ?? ''} onCerrar={() => setAbierto(null)} posicion="derecha">
      {def && <Gestion def={def} doc={get(def.id)} folio={folio} onListo={(m) => { flash(m); setAbierto(null); }} />}
    </Dialogo>
  </div>;
}

function Gestion({ def, doc, folio, onListo }: { def: DefDocumento; doc: DocEstado; folio: string; onListo: (m: string) => void }) {
  const [texto, setTexto] = useState('');
  const ultima = doc.versiones.at(-1);
  const [ver, setVer] = useState(ultima?.n ?? 0);
  const version = doc.versiones.find((x) => x.n === ver) ?? ultima;
  const e = doc.estado;
  const clienteSube = def.grupo === 'cliente' || (def.grupo === 'conjunto' && doc.versiones.some((v) => v.autor === 'cliente'));

  return <div className="kv-gr-detalle kv-idc__gestion">
    <p><Pastilla id={def.id} estado={e} /> <span className="kv-suave">{textoEstado(def.id, e)}</span></p>

    {version && <VisorArchivo def={def} version={version} doc={doc} folio={folio} />}

    {def.grupo === 'cliente' && e === 'pendiente' && <p className="kv-suave">Esperando que el cliente suba este documento.</p>}
    {def.grupo === 'cliente' && e === 'por_corregir' && <p className="kv-suave">Esperando la versión corregida del cliente. Comentario enviado: «{doc.observacion?.texto}»</p>}

    {(e === 'en_revision' && clienteSube) && <section className="kv-idc__decision">
      <h3>Decisión de revisión</h3>
      <div className="kv-chips">{FRASES.map((f) => <button key={f} type="button" onClick={() => setTexto((t) => (t ? t + ' ' : '') + f)}>{f}</button>)}</div>
      <label>Comentario visible para el cliente
        <textarea rows={4} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Explica con claridad qué debe corregir." />
      </label>
      <div className="kv-idc__botones">
        <button type="button" className="kvp-boton" onClick={() => { accionesDemo.prevalidar(folio, def.id); onListo(`${def.corto} prevalidado. El cliente ya lo ve y recibió un correo simulado.`); }}><ShieldCheck size={16} aria-hidden="true" /> Prevalidar</button>
        <button type="button" className="kvp-boton kvp-boton--suave" disabled={!texto.trim()} onClick={() => { accionesDemo.solicitarCorreccion(folio, def.id, texto.trim()); onListo('Corrección solicitada. Aparece en Avisos del cliente y en su correo simulado.'); }}><MessageSquareWarning size={16} aria-hidden="true" /> Solicitar corrección</button>
      </div>
      <small className="kv-suave">La prevalidación es digital: no equivale a la recepción física ni a la aceptación de CFE.</small>
    </section>}

    {def.id === 'solicitud' && e === 'en_preparacion' && <section className="kv-idc__decision">
      <h3>Preparar la solicitud</h3>
      <p>IDC genera la solicitud con los datos del cliente y del proyecto (datos ficticios). El cliente recibirá un aviso para revisarla y firmarla.</p>
      <button type="button" className="kvp-boton" onClick={() => { accionesDemo.prepararSolicitud(folio); onListo('Solicitud preparada y enviada al cliente para revisión y firma.'); }}><Send size={16} aria-hidden="true" /> Generar y enviar al cliente</button>
    </section>}
    {def.id === 'solicitud' && e === 'lista_para_firmar' && <p className="kv-suave">Esperando que el cliente revise, firme y suba la solicitud.</p>}

    {def.grupo === 'idc' && <section className="kv-idc__decision">
      <h3>{doc.versiones.length ? 'Sustituir archivo' : 'Cargar archivo'}</h3>
      <Cargador etiqueta={doc.versiones.length ? 'Sube una nueva versión (se conserva el historial)' : 'Sube el archivo técnico'} boton="Cargar" onEnviar={(a, f) => { accionesDemo.cargarTecnico(folio, def.id, a); if (f) registrarArchivoSubido(folio, def.id, doc.versiones.length + 1, f); onListo(`${def.corto}: archivo cargado (en revisión técnica). Márcalo disponible para que el cliente lo vea.`); }} />
      <div className="kv-idc__botones">
        {e === 'en_revision_tecnica' && <button type="button" className="kvp-boton" onClick={() => { accionesDemo.marcarDisponible(folio, def.id); onListo(`${def.corto} disponible. El cliente recibió un aviso y un correo simulado.`); }}><Check size={16} aria-hidden="true" /> Marcar como disponible</button>}
        {e === 'disponible' && <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => { accionesDemo.marcarEnPreparacion(folio, def.id); onListo(`${def.corto} volvió a preparación.`); }}>Volver a preparación</button>}
      </div>
    </section>}

    {doc.reportes.length > 0 && <section className="kv-idc__reportes"><h3>Reportes del cliente</h3>
      <ul>{doc.reportes.map((r) => <li key={r.fecha}><time>{fecha(r.fecha)}</time> {r.texto}</li>)}</ul></section>}

    <details className="kv-gr-acordeon"><summary>Historial de versiones</summary><div><Versiones def={def} doc={doc} onVer={setVer} activa={ver} /></div></details>
  </div>;
}
