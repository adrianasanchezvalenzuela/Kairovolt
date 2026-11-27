import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FilePenLine, FileText, Maximize2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { AVISO_SOLICITUD_DEMO, descargarSolicitudDemo, RUTA_FORMATO_SOLICITUD } from '@/application/solicitud-demo';
import { solicitudInicial, type DatosSolicitud, type DomicilioSolicitud } from '@/data/solicitud-demo';
import { datosPortal } from '@/infrastructure/portal-http';

const RUTA_EJEMPLO = '/guias/solicitud-ejemplo-anonimizado.pdf';

const SECCIONES_EJEMPLO = [
  ['I y II · Solicitante y contacto', 'Quién es el titular del proyecto y con quién se comunicará CFE.'],
  ['III y IV · Modalidad y uso de la energía', 'Se marca el nivel de tensión y si la energía es para consumo propio, excedentes o venta.'],
  ['V · Servicio de suministro actual', 'El RPU y el nivel de tensión salen de tu recibo CFE.'],
  ['VI · Central eléctrica', 'Fecha estimada de operación, capacidad instalada y generación mensual estimada.'],
  ['VII · Información técnica', 'Tecnología (solar), número de unidades y coordenadas UTM de la central.'],
  ['Firmas', 'Un recuadro es para quien solicita; el de sello lo llena el Centro de Atención. No los llenes tú.'],
] as const;

function Lightbox({ src, titulo, onClose }: { src: string; titulo: string; onClose: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return <div className="kv-lightbox" role="dialog" aria-modal="true" aria-label={titulo} onClick={onClose}>
    <button type="button" className="kv-lightbox__cerrar" onClick={onClose} aria-label="Cerrar vista previa"><X size={22} /></button>
    <img src={src} alt={titulo} onClick={(e) => e.stopPropagation()} />
  </div>;
}

type CampoDom = keyof DomicilioSolicitud;
const CAMPOS_DOM: [CampoDom, string][] = [['calle', 'Calle'], ['numExt', 'Número exterior'], ['numInt', 'Número interior'], ['cp', 'Código postal'], ['colonia', 'Colonia'], ['municipio', 'Municipio'], ['estado', 'Estado'], ['telefono', 'Teléfono'], ['correo', 'Correo electrónico']];

export function GuiaSolicitud() {
  const [datos, setDatos] = useState<DatosSolicitud>(() => solicitudInicial());
  const [revisando, setRevisando] = useState(false);
  const [ampliada, setAmpliada] = useState<{ src: string; titulo: string } | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [desdeMisDatos, setDesdeMisDatos] = useState(false);

  useEffect(() => {
    let vigente = true;
    void datosPortal().then((v) => {
      const d = v?.datos;
      if (!vigente || !d?.titular) return;
      const persona = d.tramita === 'apoderado' ? d.apoderado : d.tramita === 'representante' ? d.representante : d.titular;
      setDatos(solicitudInicial({ titular: d.titular, contacto: persona, puesto: d.tramita === 'apoderado' ? 'Apoderado' : d.tramita === 'representante' ? 'Representante legal' : 'Titular' }));
      setDesdeMisDatos(true);
    }).catch(() => undefined);
    return () => { vigente = false; };
  }, []);

  const editarDom = (quien: 'solicitante' | 'contacto', c: CampoDom, valor: string) =>
    setDatos((d) => ({ ...d, [quien]: { ...d[quien], [c]: valor } }));

  async function descargar() {
    setGenerando(true); setError(''); setOk(false);
    try { await descargarSolicitudDemo(datos); setOk(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar la solicitud.'); }
    finally { setGenerando(false); }
  }

  return <section className="kv-gs" aria-labelledby="gs-titulo">
    <header className="kv-gs__cab">
      <span className="kv-cliente-etiqueta">Guía visual · Formato de solicitud para interconexión</span>
      <h2 id="gs-titulo">Tu solicitud de interconexión.</h2>
      <p>Prepara el documento con el que iniciarás formalmente tu trámite.</p>
    </header>

    <div className="kv-gs__destacada">
      <span className="kv-gs__chispa"><Sparkles size={26} aria-hidden="true" /></span>
      <div>
        <h3>No empieces desde cero.</h3>
        <p>Utiliza los datos que ya registraste en KairóVolt para preparar tu solicitud.</p>
        {desdeMisDatos && <small>Titular y contacto tomados de Mis datos.</small>}
      </div>
      <button type="button" className="kvp-boton" onClick={() => setRevisando((v) => !v)} aria-expanded={revisando}>
        <FilePenLine size={17} aria-hidden="true" /> {revisando ? 'Ocultar revisión' : 'Generar mi solicitud'}
      </button>
    </div>

    {revisando && <div className="kv-gs__revision">
      <h3>Revisa tus datos antes de descargar</h3>
      <p className="kv-suave">Los datos técnicos son ficticios y fijos para esta demostración. Número de solicitud, firmas y sello quedan en blanco.</p>
      <label className="kv-gs__campo">Nombre, denominación o razón social
        <input value={datos.solicitante.nombre} onChange={(e) => setDatos((d) => ({ ...d, solicitante: { ...d.solicitante, nombre: e.target.value } }))} />
      </label>
      <details open><summary>I. Datos del solicitante</summary><div className="kv-gs__rejilla">
        {CAMPOS_DOM.map(([c, t]) => <label key={c} className="kv-gs__campo">{t}<input value={datos.solicitante[c]} onChange={(e) => editarDom('solicitante', c, e.target.value)} /></label>)}
      </div></details>
      <details><summary>II. Datos de contacto</summary><div className="kv-gs__rejilla">
        <label className="kv-gs__campo">Nombre<input value={datos.contacto.nombre} onChange={(e) => setDatos((d) => ({ ...d, contacto: { ...d.contacto, nombre: e.target.value } }))} /></label>
        <label className="kv-gs__campo">Puesto<input value={datos.contacto.puesto} onChange={(e) => setDatos((d) => ({ ...d, contacto: { ...d.contacto, puesto: e.target.value } }))} /></label>
        {CAMPOS_DOM.map(([c, t]) => <label key={c} className="kv-gs__campo">{t}<input value={datos.contacto[c]} onChange={(e) => editarDom('contacto', c, e.target.value)} /></label>)}
      </div></details>
      <details open><summary>III–VII. Solicitud, servicio y central eléctrica</summary>
        <dl className="kv-gs__resumen">
          <dt>Modalidad</dt><dd>Media tensión</dd>
          <dt>Utilización de la energía</dt><dd>Consumo de centros de carga</dd>
          <dt>RPU</dt><dd>{datos.rpu} <em>(ficticio)</em></dd>
          <dt>Nivel de tensión</dt><dd>{datos.nivelTension}</dd>
          <dt>Fecha estimada de operación</dt><dd>{datos.central.fechaOperacion}</dd>
          <dt>Capacidad bruta instalada</dt><dd>{datos.central.capacidadBruta} kW</dd>
          <dt>Generación promedio mensual</dt><dd>{datos.central.generacionMensual} kWh/mes</dd>
          <dt>Tecnología / unidades</dt><dd>Solar · {datos.unidades}</dd>
          <dt>Coordenadas UTM (ficticias)</dt><dd>X {datos.utmX} · Y {datos.utmY}</dd>
        </dl>
      </details>
      <p className="kv-gs__aviso"><ShieldAlert size={16} aria-hidden="true" /> {AVISO_SOLICITUD_DEMO}</p>
      <div className="kv-gs__acciones">
        <button type="button" className="kvp-boton" disabled={generando} onClick={() => void descargar()}>
          <Download size={17} aria-hidden="true" /> {generando ? 'Generando…' : 'Descargar solicitud prellenada'}
        </button>
        <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setDatos(solicitudInicial())}>Restablecer datos</button>
      </div>
      {ok && <AlertPanel tono="ok">Solicitud de demostración descargada. Revísala con IDC antes de firmarla.</AlertPanel>}
      {error && <AlertPanel tono="error">{error}</AlertPanel>}
    </div>}

    <div className="kv-gs__pdfs">
      <article className="kv-gs__pdf">
        <button type="button" className="kv-gs__miniatura" onClick={() => setAmpliada({ src: '/guias/formato-grande.jpg', titulo: 'Formato en blanco de la solicitud de interconexión' })} aria-label="Ampliar vista previa del formato en blanco">
          <img src="/guias/formato-miniatura.jpg" alt="Miniatura del formato en blanco" loading="lazy" />
          <span><Maximize2 size={16} aria-hidden="true" /> Vista previa</span>
        </button>
        <div>
          <h3>Formato en blanco</h3>
          <p>El formato tal como se presenta, sin datos.</p>
          <div className="kv-gs__botones">
            <a className="kvp-boton kvp-boton--suave" href={RUTA_FORMATO_SOLICITUD} download="solicitud-interconexion-formato.pdf"><Download size={16} aria-hidden="true" /> Descargar formato</a>
            <a className="kvp-boton kvp-boton--suave" href={RUTA_FORMATO_SOLICITUD} target="_blank" rel="noreferrer"><FileText size={16} aria-hidden="true" /> Completar manualmente</a>
          </div>
        </div>
      </article>

      <article className="kv-gs__pdf">
        <button type="button" className="kv-gs__miniatura" onClick={() => setAmpliada({ src: '/guias/ejemplo-grande.jpg', titulo: 'Ejemplo anonimizado de una solicitud completada' })} aria-label="Ampliar vista previa del ejemplo completado">
          <img src="/guias/ejemplo-miniatura.jpg" alt="Miniatura del ejemplo completado y anonimizado" loading="lazy" />
          <span><Maximize2 size={16} aria-hidden="true" /> Ampliar</span>
        </button>
        <div>
          <h3>Ejemplo completado</h3>
          <p>Una solicitud real de otro proyecto, anonimizada, para que veas cómo luce llena.</p>
          <div className="kv-gs__botones">
            <a className="kvp-boton kvp-boton--suave" href={RUTA_EJEMPLO} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> Consultar ejemplo anonimizado</a>
          </div>
        </div>
      </article>
    </div>

    <aside className="kv-gs__explica">
      <h3>Qué mirar en el ejemplo</h3>
      <ol>{SECCIONES_EJEMPLO.map(([t, d]) => <li key={t}><strong>{t}</strong><span>{d}</span></li>)}</ol>
      <p className="kv-gs__aviso"><ShieldAlert size={16} aria-hidden="true" /> El sello «Recibido» y los datos del ejemplo pertenecen a otro proyecto. No son una recepción de tu solicitud ni valores validados para tu expediente.</p>
      <Link to="/portal/mis-datos" className="kv-cliente-enlace">Revisar Mis datos</Link>
    </aside>
    {ampliada && <Lightbox {...ampliada} onClose={() => setAmpliada(null)} />}
  </section>;
}
