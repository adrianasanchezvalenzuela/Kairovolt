import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, CircleAlert, Clock3, Download, FileText, Landmark, Maximize2, Printer, ShieldCheck, UserRound, Users, Wrench,
} from 'lucide-react';
import { PortadaPortal } from '@/components/portal/DisenoPortal';
import { CartaDemoPortal } from '@/components/portal/CartaDemoPortal';
import { GuiaSolicitud, useDatosSolicitudDemo } from '@/components/portal/GuiaSolicitud';
import { GuiaVisualDocumento } from '@/components/portal/GuiasVisuales';
import { IlustracionCroquis } from '@/components/portal/DisenoPortal';
import { Dialogo } from '@/components/ui/Dialogo';
import {
  accionesDemo, DOCUMENTOS_DEMO, definicion, esFavorable, LEYENDA_DEMO, textoEstado, useExpedienteDemo,
  type DefDocumento, type DocEstado, type EstadoDemo, type Grupo, type VersionDemo,
} from '@/demo/expediente-demo';
import { VisorDocumento, VistaArchivo } from '@/components/portal/VisorDocumento';
import { ADJUNTOS_CARTA, archivoDeVersion, registrarArchivoSubido } from '@/demo/archivos-demo';
import { useVistaPortal } from '@/hooks/PortalContexto';
import { esFolioTramite, useTramiteDemo } from '@/demo/tramite-demo';
import { documentosExpedienteFinal, type DocFinal } from '@/demo/pdf-tramite';

const GRUPOS: { id: Grupo; titulo: string; subtitulo: string; Icono: typeof UserRound }[] = [
  { id: 'cliente', titulo: 'Tus documentos', subtitulo: 'Prepara tus documentos personales. Te acompañamos en cada paso.', Icono: UserRound },
  { id: 'conjunto', titulo: 'Lo hacemos juntos', subtitulo: 'Nosotros preparamos tu solicitud. Tú confirmas que todo esté correcto.', Icono: Users },
  { id: 'idc', titulo: 'IDC se encarga', subtitulo: 'Nuestro equipo prepara la documentación técnica de tu proyecto. Aquí puedes consultar su avance.', Icono: Wrench },
];

export const fecha = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Hermosillo' }).format(new Date(iso));

function tonoDe(e: EstadoDemo): 'ok' | 'info' | 'alerta' | 'neutro' {
  if (esFavorable(e)) return 'ok';
  if (e === 'por_corregir' || e === 'lista_para_firmar') return 'alerta';
  if (e === 'en_revision' || e === 'en_revision_tecnica') return 'info';
  return 'neutro';
}
export const Pastilla = ({ id, estado }: { id: string; estado: EstadoDemo }) => <span className={'kv-gr-pill kv-gr-pill--' + tonoDe(estado)}>{textoEstado(id, estado)}</span>;

/** Una sola acción principal por documento, según su estado. */
function accionPrincipal(def: DefDocumento, e: EstadoDemo): string {
  if (def.grupo === 'cliente') return e === 'pendiente' ? 'Preparar y subir' : e === 'por_corregir' ? 'Enviar versión corregida' : e === 'en_revision' ? 'Ver mi envío' : 'Ver documento';
  if (def.grupo === 'conjunto') return e === 'lista_para_firmar' ? 'Revisar mi solicitud' : e === 'en_preparacion' ? 'Ver avance' : e === 'en_revision' ? 'Ver mi envío' : 'Ver solicitud';
  return e === 'disponible' ? 'Consultar documento' : 'Ver avance';
}
function lineaEstado(def: DefDocumento, doc: DocEstado): string {
  const e = doc.estado;
  if (e === 'por_corregir') return 'IDC dejó un comentario para corregir este documento.';
  if (e === 'lista_para_firmar') return 'IDC la preparó con tus datos. Revísala, fírmala y súbela.';
  if (e === 'en_revision') return 'IDC está revisando tu versión.';
  if (e === 'en_preparacion') return def.grupo === 'idc' ? 'IDC todavía lo está preparando.' : 'IDC está preparando tu solicitud.';
  if (e === 'en_revision_tecnica') return 'IDC lo está revisando antes de dejarlo disponible.';
  if (e === 'prevalidado' || e === 'prevalidada') return 'Revisión digital favorable. La entrega física se registra aparte.';
  if (e === 'disponible') return 'Disponible para consultar y descargar.';
  return def.sirve;
}

const RESPONSABLE: Record<Grupo, string> = { cliente: 'Cliente', conjunto: 'IDC prepara · el cliente firma', idc: 'IDC' };

/** Vista previa real del archivo de demostración de la versión, con acceso al visor completo. */
export function VisorArchivo({ def, version, doc, folio }: { def: DefDocumento; version: VersionDemo; doc: DocEstado; folio: string }) {
  const [abierto, setAbierto] = useState(false);
  const archivo = archivoDeVersion(folio, def.id, version);
  const archivos = def.id === 'carta_poder' ? [archivo, ...ADJUNTOS_CARTA] : [archivo];
  return <div className="kv-gr-visor">
    <VistaArchivo archivo={archivo} alto={320} />
    <div className="kv-gr-visor__pie">
      <span>v{version.n} · {archivo.etiqueta}</span>
      <span className="kv-gr-visor__botones">
        <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setAbierto(true)}><Maximize2 size={16} aria-hidden="true" /> Ver documento</button>
        <a className="kvp-boton kvp-boton--suave" href={archivo.ruta} download={archivo.ruta.split('/').pop()}><Download size={16} aria-hidden="true" /> Descargar</a>
      </span>
    </div>
    {def.id === 'carta_poder' && <small className="kv-suave">Incluye las identificaciones del representante y de los testigos (abre «Ver documento»).</small>}
    <small className="kv-suave">{LEYENDA_DEMO}.</small>
    {abierto && <VisorDocumento onCerrar={() => setAbierto(false)} datos={{
      titulo: def.nombre, estado: textoEstado(def.id, doc.estado), responsable: RESPONSABLE[def.grupo], version: version.n, cargadoEn: version.fecha,
      validadoEn: esFavorable(doc.estado) ? doc.revisadoEn ?? version.fecha : undefined, archivos,
    }} />}
  </div>;
}

export function Cargador({ etiqueta, boton, onEnviar }: { etiqueta: string; boton: string; onEnviar: (archivo: string, file?: File) => void }) {
  const [nombre, setNombre] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [sobre, setSobre] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  return <div className={'kv-gr-carga' + (sobre ? ' kv-gr-carga--sobre' : '')}
    onDragOver={(ev) => { ev.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
    onDrop={(ev) => { ev.preventDefault(); setSobre(false); const f = ev.dataTransfer.files[0]; if (f) { setNombre(f.name); setFile(f); } }}>
    <strong>{etiqueta}</strong>
    {nombre ? <p className="kv-gr-carga__archivo"><FileText size={16} aria-hidden="true" /> {nombre}</p> : <p className="kv-suave">Arrastra un archivo aquí o elígelo (PDF, JPG o PNG). En la demo no sale de tu equipo.</p>}
    <div className="kv-gr-carga__botones">
      <input ref={entrada} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) { setNombre(f.name); setFile(f); } ev.target.value = ''; }} />
      <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => entrada.current?.click()}>Elegir archivo</button>
      <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => { setNombre('archivo-de-ejemplo.pdf'); setFile(undefined); }}>Usar archivo de ejemplo</button>
      <button type="button" className="kvp-boton" disabled={!nombre} onClick={() => onEnviar(nombre, file)}>{boton}</button>
    </div>
  </div>;
}

function Acordeon({ titulo, children, abierto = false }: { titulo: string; children: ReactNode; abierto?: boolean }) {
  return <details className="kv-gr-acordeon" open={abierto}><summary>{titulo}</summary><div>{children}</div></details>;
}

function Aviso({ tono, titulo, children }: { tono: 'ok' | 'info' | 'alerta'; titulo: string; children: ReactNode }) {
  const I = tono === 'ok' ? Check : tono === 'alerta' ? CircleAlert : Clock3;
  return <div className={'kv-gr-aviso kv-gr-aviso--' + tono}><I size={19} aria-hidden="true" /><div><strong>{titulo}</strong><p>{children}</p></div></div>;
}

function Reporte({ folio, def, doc, etiqueta }: { folio: string; def: DefDocumento; doc: DocEstado; etiqueta: string }) {
  const [texto, setTexto] = useState('');
  const [ok, setOk] = useState(false);
  return <div className="kv-gr-reporte">
    <h4>{etiqueta}</h4>
    <label>Cuéntanos qué dato parece incorrecto
      <textarea rows={3} maxLength={400} value={texto} onChange={(ev) => { setTexto(ev.target.value); setOk(false); }} placeholder="Ej. El nombre del titular tiene un error." />
    </label>
    <button type="button" className="kvp-boton kvp-boton--suave" disabled={!texto.trim()} onClick={() => { accionesDemo.reportar(folio, def.id, texto.trim()); setTexto(''); setOk(true); }}>Enviar reporte a IDC</button>
    {ok && <p role="status" className="kv-gr-ok"><Check size={15} aria-hidden="true" /> Reporte enviado. IDC lo revisará; tú no necesitas hacer nada más.</p>}
    {doc.reportes.length > 0 && <ul className="kv-gr-reportes">{doc.reportes.map((r) => <li key={r.fecha}><time>{fecha(r.fecha)}</time> {r.texto}</li>)}</ul>}
  </div>;
}

export function Versiones({ def, doc, onVer, activa }: { def: DefDocumento; doc: DocEstado; onVer: (n: number) => void; activa: number }) {
  if (doc.versiones.length === 0) return <p className="kv-suave">Aún no hay versiones.</p>;
  return <ol className="kv-gr-versiones">{[...doc.versiones].reverse().map((x) => <li key={x.n} data-activa={x.n === activa || undefined}>
    <b>v{x.n}</b><span>{x.archivo}<small>{x.autor === 'idc' ? 'Cargada por IDC' : 'Enviada por ti'} · {fecha(x.fecha)}</small></span>
    <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => onVer(x.n)} aria-label={`Ver versión ${x.n} de ${def.corto}`}>Ver</button>
  </li>)}</ol>;
}

function GuiaCliente({ def, folioVista }: { def: DefDocumento; folioVista: ReturnType<typeof useVistaPortal> }) {
  const g = folioVista.guiaDocumental?.find((x) => x.id === def.id)?.guiaPreparacion;
  return <Acordeon titulo="Guía personalizada y ejemplos" abierto={false}>
    <p>{def.sirve}</p>
    {g?.queEs && <p>{g.queEs}</p>}
    {!!g?.pasos?.length && <ol className="kv-gr-pasos">{g.pasos.map((p) => <li key={p}>{p}</li>)}</ol>}
    {g?.dondeConseguir && <p><strong>Dónde conseguirlo:</strong> {g.dondeConseguir}</p>}
    <GuiaVisualDocumento id={def.id} />
  </Acordeon>;
}

function Detalle({ def, doc, folio, onCerrar, onEnviado }: { def: DefDocumento; doc: DocEstado; folio: string; onCerrar: () => void; onEnviado: (msg: string) => void }) {
  const v = useVistaPortal();
  const { datos, desdeMisDatos } = useDatosSolicitudDemo();
  const ultima = doc.versiones.at(-1);
  const [ver, setVer] = useState(ultima?.n ?? 0);
  useEffect(() => { setVer(doc.versiones.at(-1)?.n ?? 0); }, [doc.versiones.length]);
  const version = doc.versiones.find((x) => x.n === ver) ?? ultima;
  const e = doc.estado;
  const enviar = (archivo: string, msg: string, file?: File) => { accionesDemo.subirCliente(folio, def.id, archivo); if (file) registrarArchivoSubido(folio, def.id, doc.versiones.length + 1, file); onEnviado(msg); onCerrar(); };

  // ── Grupo 1: documentos personales ──
  if (def.grupo === 'cliente') return <div className="kv-gr-detalle">
    <p className="kv-gr-sirve">{def.sirve}</p>
    {e === 'por_corregir' && <section className="kv-gr-correccion">
      <Aviso tono="alerta" titulo="Por corregir">IDC revisó tu documento y necesita un pequeño ajuste.</Aviso>
      <dl>
        <dt>Documento enviado</dt><dd>{ultima?.archivo} · v{ultima?.n}</dd>
        <dt>Fecha de revisión</dt><dd>{doc.observacion ? fecha(doc.observacion.fecha) : '—'}</dd>
        <dt>Comentario de IDC</dt><dd className="kv-gr-comentario">«{doc.observacion?.texto}»</dd>
      </dl>
    </section>}
    {e === 'en_revision' && <Aviso tono="info" titulo="En revisión por IDC">Recibimos tu envío (v{ultima?.n}). Te avisaremos aquí y por correo cuando termine.</Aviso>}
    {e === 'prevalidado' && <Aviso tono="ok" titulo="Prevalidado por IDC">Revisión digital favorable{doc.revisadoEn ? ` el ${fecha(doc.revisadoEn)}` : ''}. Esto no sustituye la entrega física ni equivale a la aceptación de CFE.</Aviso>}
    {(e === 'pendiente' || e === 'por_corregir') && <Cargador
      etiqueta={e === 'por_corregir' ? 'Sube la versión corregida' : 'Sube tu documento para que IDC lo revise'}
      boton={e === 'por_corregir' ? 'Enviar versión corregida' : 'Enviar a revisión'}
      onEnviar={(a, f) => enviar(a, e === 'por_corregir' ? `Versión corregida enviada: ${def.corto} pasó a la versión ${doc.versiones.length + 1}.` : `${def.corto} enviado. IDC lo revisará pronto.`, f)} />}
    {def.id === 'carta_poder' && (e === 'pendiente' || e === 'por_corregir') && <Acordeon titulo="Genera tu carta poder de demostración"><CartaDemoPortal /></Acordeon>}
    {version && <VisorArchivo def={def} version={version} doc={doc} folio={folio} />}
    <GuiaCliente def={def} folioVista={v} />
    <Acordeon titulo="Historial de versiones"><Versiones def={def} doc={doc} onVer={setVer} activa={ver} /></Acordeon>
  </div>;

  // ── Grupo 2: solicitud compartida ──
  if (def.grupo === 'conjunto') return <div className="kv-gr-detalle">
    <p className="kv-gr-sirve">{def.sirve}</p>
    {e === 'en_preparacion' && <Aviso tono="info" titulo="En preparación">IDC está preparando tu solicitud con los datos de tu proyecto. Te avisaremos cuando esté lista.</Aviso>}
    {e === 'lista_para_firmar' && <Aviso tono="alerta" titulo="Lista para revisar y firmar">{doc.observacion ? `IDC pidió un ajuste: «${doc.observacion.texto}»` : 'Revisa que tus datos sean correctos, imprímela, fírmala y súbela de nuevo.'}</Aviso>}
    {e === 'en_revision' && <Aviso tono="info" titulo="En revisión por IDC">Recibimos tu solicitud firmada. IDC la está revisando.</Aviso>}
    {e === 'prevalidada' && <Aviso tono="ok" titulo="Prevalidada por IDC">Revisión digital favorable. Recuerda llevar la solicitud firmada en tu carpeta física; la recepción física se registra aparte.</Aviso>}
    {e !== 'en_preparacion' && version && <>
      <VisorArchivo def={def} version={version} doc={doc} folio={folio} />
      <Acordeon titulo="Revisa tus datos en la solicitud" abierto={e === 'lista_para_firmar'}>
        <dl className="kv-gr-datos">
          <dt>Solicitante</dt><dd>{datos.solicitante.nombre}</dd>
          <dt>Contacto</dt><dd>{datos.contacto.nombre} · {datos.contacto.puesto}</dd>
          <dt>Modalidad</dt><dd>Media tensión</dd>
          <dt>Capacidad bruta</dt><dd>{datos.central.capacidadBruta} kW</dd>
          <dt>Generación mensual estimada</dt><dd>{datos.central.generacionMensual} kWh/mes</dd>
          <dt>Tecnología</dt><dd>Solar · {datos.unidades}</dd>
        </dl>
        <small className="kv-suave">{desdeMisDatos ? 'Titular y contacto tomados de Mis datos. ' : ''}Los datos técnicos son ficticios de demostración.</small>
        <Reporte folio={folio} def={def} doc={doc} etiqueta="¿Algún dato es incorrecto?" />
      </Acordeon>
      <Acordeon titulo="Cómo imprimirla y firmarla" abierto={e === 'lista_para_firmar'}>
        <ol className="kv-gr-pasos">
          <li>Descarga e imprime la solicitud.</li>
          <li>Revisa que cada dato sea correcto.</li>
          <li>Fírmala en el recuadro «Firma de conformidad — Solicitante».</li>
          <li>No llenes el recuadro «sello y firma — Centro de Atención»: es de CFE.</li>
          <li>Sube una foto o escaneo de la versión firmada.</li>
        </ol>
        <a className="kvp-boton kvp-boton--suave" href={archivoDeVersion(folio, def.id, doc.versiones.find((x) => x.autor === 'idc') ?? version).ruta} download="solicitud-para-imprimir.pdf"><Printer size={16} aria-hidden="true" /> Descargar para imprimir</a>
      </Acordeon>
    </>}
    {e === 'lista_para_firmar' && <Cargador etiqueta="Carga tu solicitud firmada" boton="Enviar solicitud firmada" onEnviar={(a, f) => enviar(a, 'Solicitud firmada enviada a revisión de IDC.', f)} />}
    <Acordeon titulo="Formato de referencia y ejemplo anonimizado"><GuiaSolicitud soloReferencias /></Acordeon>
    <Acordeon titulo="Historial de versiones"><Versiones def={def} doc={doc} onVer={setVer} activa={ver} /></Acordeon>
  </div>;

  // ── Grupo 3: documentación técnica de IDC ──
  const disponible = e === 'disponible';
  return <div className="kv-gr-detalle">
    <p className="kv-gr-sirve">{def.sirve}</p>
    {def.id === 'dictamen_uvie' && <Aviso tono="info" titulo="Lo emite la unidad correspondiente">Este dictamen lo emite una Unidad de Verificación de Instalaciones Eléctricas y lo gestiona IDC. KairóVolt no lo genera.</Aviso>}
    {e === 'en_preparacion' && <Aviso tono="info" titulo="En preparación por IDC">Nuestro equipo todavía lo está preparando. No tienes que hacer nada.</Aviso>}
    {e === 'en_revision_tecnica' && <Aviso tono="info" titulo="En revisión técnica">IDC lo está revisando antes de dejarlo disponible para ti.</Aviso>}
    {disponible && <Aviso tono="ok" titulo="Disponible para consultar">Puedes verlo y descargarlo. Si notas un dato incorrecto, repórtalo abajo.</Aviso>}
    {disponible && ultima && <VisorArchivo def={def} version={ultima} doc={doc} folio={folio} />}
    {def.id === 'croquis' && <Acordeon titulo="Cómo se ve un croquis (ejemplo)"><IlustracionCroquis /></Acordeon>}
    {def.id !== 'croquis' && <Acordeon titulo="Cómo se ve un ejemplo"><GuiaVisualDocumento id={def.id} /></Acordeon>}
    {(disponible || doc.reportes.length > 0) && <Reporte folio={folio} def={def} doc={doc} etiqueta="Reportar un posible error" />}
    <p className="kv-suave kv-gr-solo">Estos archivos los carga y actualiza únicamente IDC.</p>
  </div>;
}

/** Documentos del trámite ante CFE (demos 4–6): aparecen a medida que se registra cada hito. */
function GrupoCfe({ folio }: { folio: string }) {
  const t = useTramiteDemo(folio);
  const [docs, setDocs] = useState<DocFinal[]>([]);
  const [visor, setVisor] = useState<DocFinal | null>(null);
  useEffect(() => { let vivo = true; void documentosExpedienteFinal(folio, t).then((d) => { if (vivo) setDocs(d.filter((x) => x.id !== 'inicial' && x.disponible)); }); return () => { vivo = false; }; }, [folio, t]);
  if (docs.length === 0) return null;
  return <section className="kv-gr kv-gr--cfe" aria-labelledby="gr-cfe">
    <header><span className="kv-gr__ico"><Landmark size={22} aria-hidden="true" /></span><div><h2 id="gr-cfe">Respuesta de CFE y contratos</h2><p>Documentos del trámite. Tu expediente inicial sigue arriba, ya validado.</p></div></header>
    <ul>{docs.map((d) => <li key={d.id}><div className="kv-gr__info"><h3>{d.titulo}</h3><p>{d.detalle}</p></div><span className="kv-gr-pill kv-gr-pill--ok">Disponible</span>
      <button type="button" className="kv-gr__accion" onClick={() => setVisor(d)}>Ver documento <ArrowRight size={16} aria-hidden="true" /></button></li>)}</ul>
    {visor && <VisorDocumento onCerrar={() => setVisor(null)} datos={{ titulo: visor.titulo, estado: 'Disponible', responsable: 'CFE · registrado por IDC', cargadoEn: t.resolucion?.fecha, archivos: visor.archivos }} />}
  </section>;
}

export function DocumentosPorResponsable() {
  const v = useVistaPortal();
  const e = useExpedienteDemo(v.folio);
  const [params, setParams] = useSearchParams();
  const abierto = params.get('documento');
  const def = abierto ? definicion(abierto) : undefined;
  const [aviso, setAviso] = useState('');
  const listos = DOCUMENTOS_DEMO.filter((d) => esFavorable(e.docs[d.id]?.estado ?? 'pendiente')).length;
  const cerrar = () => setParams({}, { replace: true });
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 6000); return () => clearTimeout(t); }, [aviso]);

  return <>
    <PortadaPortal titulo="Tu expediente, en tres frentes.">
      Unos documentos los preparas tú, uno lo armamos juntos y el resto lo prepara IDC. Todo se actualiza aquí.
    </PortadaPortal>
    <div className="kv-gr-resumen"><ShieldCheck size={18} aria-hidden="true" /> <strong>{listos} de {DOCUMENTOS_DEMO.length}</strong> con revisión digital favorable o disponibles
      <small>La prevalidación digital no sustituye la entrega física ni equivale a la aceptación de CFE.</small></div>
    {aviso && <div className="kv-gr-toast" role="status"><Check size={18} aria-hidden="true" /> {aviso}</div>}

    {GRUPOS.map((g) => <section key={g.id} className={'kv-gr kv-gr--' + g.id} aria-labelledby={'gr-' + g.id}>
      <header><span className="kv-gr__ico"><g.Icono size={22} aria-hidden="true" /></span><div><h2 id={'gr-' + g.id}>{g.titulo}</h2><p>{g.subtitulo}</p></div></header>
      <ul>{DOCUMENTOS_DEMO.filter((d) => d.grupo === g.id).map((d) => {
        const doc = e.docs[d.id] ?? { estado: 'pendiente' as EstadoDemo, versiones: [], reportes: [] };
        return <li key={d.id} data-estado={doc.estado}>
          <div className="kv-gr__info"><h3>{d.nombre}</h3><p>{lineaEstado(d, doc)}</p></div>
          <Pastilla id={d.id} estado={doc.estado} />
          <button type="button" className={'kv-gr__accion' + (doc.estado === 'por_corregir' || doc.estado === 'lista_para_firmar' || doc.estado === 'pendiente' && g.id === 'cliente' ? ' kv-gr__accion--primaria' : '')}
            onClick={() => setParams({ documento: d.id }, { replace: true })}>{accionPrincipal(d, doc.estado)} <ArrowRight size={16} aria-hidden="true" /></button>
        </li>;
      })}</ul>
    </section>)}

    {esFolioTramite(v.folio) && <GrupoCfe folio={v.folio} />}

    <p className="kv-cliente-legal"><Landmark size={16} aria-hidden="true" /> {LEYENDA_DEMO}. Los archivos y comentarios de esta pantalla son ficticios.</p>

    <Dialogo abierto={!!def} titulo={def?.nombre ?? 'Documento'} onCerrar={cerrar} posicion="derecha">
      {def && <Detalle key={def.id} def={def} doc={e.docs[def.id] ?? { estado: 'pendiente', versiones: [], reportes: [] }} folio={v.folio} onCerrar={cerrar} onEnviado={setAviso} />}
    </Dialogo>
  </>;
}
