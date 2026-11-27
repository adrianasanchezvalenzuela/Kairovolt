import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, Check, ClipboardList, Clock3, Compass, Factory, FileCheck2, FileText, House, Image as ImagenIcono, Info, Lock, Mail, MapPin,
  MessageCircle, MessagesSquare, Paperclip, Phone, Send, Store, Sun, Trash2, Video,
} from 'lucide-react';
import { MarcaPortal } from '@/components/portal/DisenoPortal';
import { confirmarSalida, marcarFormularioSucio } from '@/hooks/salida';
import { IlusEntrada, IlusExito } from '@/components/portal/IlustracionesHero';
import { NavegacionDemos } from '@/components/portal/NavegacionDemos';
import { diasHabiles, HORAS, ocupado } from '@/prototipo/agenda';
import { EMPRESA_DEMO, TELEFONO_DEMO, TITULAR_DEMO } from '@/data/personas-demo';
import {
  accederSeguimiento, accionesConsulta, borradorVacio, leerConsulta, MAX_ARCHIVO, ORDEN_ESTADOS, quitarArchivo, registrarArchivo, tamanoLegible, TEXTO_ESTADO, TIPOS_ARCHIVO,
  URL_ADJUNTO, useConsultas, type AdjuntoRef, type BorradorConsulta, type CategoriaAdjunto, type ConsultaPreliminar, type EstadoConsulta, type MotivoConsulta, type TipoAsesoria,
} from '@/demo/consulta-demo';

const fechaLarga = (iso: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Hermosillo' }).format(new Date(iso.length === 10 ? iso + 'T12:00:00-07:00' : iso));
const fechaHora = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Hermosillo' }).format(new Date(iso));

// ───────────────────────── Marco público ─────────────────────────
export function ConsultaLayout() {
  const { pathname } = useLocation();
  const demo = import.meta.env.DEV && window.location.pathname.startsWith('/demo/portal') && pathname.includes('/portal/consulta');
  return <div className="kvp kv-co">
    <header className="kv-co__barra"><MarcaPortal />
      {demo ? <NavegacionDemos /> : <a href="/" className="kv-co-inicio" onClick={(e) => { if (!confirmarSalida()) e.preventDefault(); }}>Volver al inicio</a>}</header>
    <main className="kv-co__contenido" id="contenido"><Outlet /></main>
    <footer className="kv-co__pie">Demostración con datos ficticios. No se envía información real ni se crea un folio formal.</footer>
  </div>;
}

// ───────────────────────── Entrada pública ─────────────────────────
export function PortalEntrada() {
  const demo = import.meta.env.DEV && window.location.pathname.startsWith('/demo/portal');
  return <>
    <section className="kv-co-hero">
      <div className="kv-co-hero__texto">
        <span className="kv-co-etiqueta">KairóVolt · IDC Sistemas Eléctricos</span>
        <h1>Tu energía, un paso más adelante.</h1>
        <p>Desde tu primera consulta hasta tu conexión con la red. Estamos contigo en cada etapa.</p>
      </div>
      <IlusEntrada className="kv-co-hero__ilus" tono="oscuro" />
    </section>
    <div className="kv-co-caminos">
      <article className="kv-co-camino kv-co-camino--proyecto">
        <span className="kv-co-camino__ico"><ClipboardList size={26} aria-hidden="true" /></span>
        <h2>Ya tengo un proyecto</h2>
        <p>Consulta el avance de tu interconexión. Accede a tus documentos, citas y avisos.</p>
        <Link to="/portal/acceso" className="kvp-boton">Entrar a mi expediente <ArrowRight size={18} aria-hidden="true" /></Link>
      </article>
      <article className="kv-co-camino kv-co-camino--nuevo">
        <span className="kv-co-camino__ico"><Compass size={26} aria-hidden="true" /></span>
        <h2>Quiero iniciar un proyecto</h2>
        <p>Cuéntanos qué necesitas y recibe orientación inicial de IDC.</p>
        <Link to="/portal/consulta" className="kvp-boton">Consultar mi proyecto <ArrowRight size={18} aria-hidden="true" /></Link>
      </article>
    </div>
    <p className="kv-co-nota"><Info size={15} aria-hidden="true" /> La consulta es una conversación inicial: no es un trámite ni genera un folio de proyecto.</p>
    {demo && <p className="kv-co-nota"><Link to="/portal/demos">Explorar los escenarios de demostración <ArrowRight size={14} aria-hidden="true" /></Link></p>}
  </>;
}

// ───────────────────────── Asistente (4 pasos) ─────────────────────────
const PASOS = ['Tu idea', 'Tu instalación', 'Tu etapa', 'Tus datos'];
const MOTIVOS: { id: MotivoConsulta; titulo: string; texto: string; Icono: typeof Sun }[] = [
  { id: 'interconectar', titulo: 'Interconectar un sistema solar', texto: 'Quiero conectar mis paneles a la red de CFE.', Icono: Sun },
  { id: 'regularizar', titulo: 'Regularizar una instalación existente', texto: 'Ya tengo un sistema y quiero ponerlo en orden.', Icono: FileCheck2 },
  { id: 'asesoria', titulo: 'Necesito asesoría', texto: 'Aún no sé por dónde empezar.', Icono: MessagesSquare },
];
const INMUEBLES = [{ id: 'residencial', t: 'Residencial', Icono: House }, { id: 'comercial', t: 'Comercial', Icono: Store }, { id: 'industrial', t: 'Industrial', Icono: Factory }, { id: 'otro', t: 'Otro', Icono: Building2 }] as const;
const ETAPAS = [
  { id: 'explorando', t: 'Estoy explorando opciones', s: 'Todavía estoy informándome.' }, { id: 'propuesta', t: 'Ya tengo una propuesta o cotización', s: 'Quiero revisar mis siguientes pasos.' },
  { id: 'instalacion', t: 'Mi sistema está en proceso de instalación', s: 'Se está instalando ahora.' }, { id: 'instalado', t: 'Mi sistema ya está instalado', s: 'Ya está en mi inmueble.' },
] as const;
const HORARIOS = ['Mañana (9:00 – 13:00)', 'Tarde (13:00 – 17:00)', 'Cualquier horario hábil'];
const ADJUNTOS_CAT: { id: Exclude<CategoriaAdjunto, 'respuesta'>; t: string; Icono: typeof FileText }[] = [
  { id: 'recibo_cfe', t: 'Recibo de CFE', Icono: FileText }, { id: 'fotos', t: 'Fotografías de la instalación', Icono: ImagenIcono }, { id: 'cotizacion', t: 'Cotización o propuesta técnica', Icono: Paperclip },
];

function Ayuda({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <details className="kv-co-ayuda"><summary><Info size={15} aria-hidden="true" /> {titulo}</summary><div>{children}</div></details>;
}

/** Selector de archivos en memoria: nombre, tamaño, vista previa y eliminación. */
export function Adjuntos({ categoria, titulo, Icono, valor, onCambio, multiple = true }: { categoria: CategoriaAdjunto; titulo: string; Icono: typeof FileText; valor: AdjuntoRef[]; onCambio: (a: AdjuntoRef[]) => void; multiple?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const propios = valor.filter((a) => a.categoria === categoria);
  function agregar(lista: FileList | null) {
    if (!lista) return; setError('');
    const nuevos: AdjuntoRef[] = [];
    for (const f of Array.from(lista)) {
      if (!TIPOS_ARCHIVO.includes(f.type)) { setError(`«${f.name}» no es PDF, JPG, PNG o WEBP.`); continue; }
      if (f.size > MAX_ARCHIVO) { setError(`«${f.name}» pesa más de 10 MB.`); continue; }
      nuevos.push(registrarArchivo(categoria, f));
    }
    onCambio([...valor, ...nuevos]);
  }
  return <div className="kv-co-adj">
    <div className="kv-co-adj__cab"><span className="kv-co-adj__ico"><Icono size={18} aria-hidden="true" /></span><strong>{titulo}</strong>
      <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => entrada.current?.click()}>Elegir archivo</button>
      <input ref={entrada} type="file" hidden multiple={multiple} accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} /></div>
    {error && <p className="kv-co-error" role="alert">{error}</p>}
    {propios.length > 0 && <ul>{propios.map((a) => <li key={a.id}>
      {a.tipo.startsWith('image/') && URL_ADJUNTO(a.id) ? <img src={URL_ADJUNTO(a.id)} alt={`Vista previa de ${a.nombre}`} /> : <span className="kv-co-adj__pdf"><FileText size={20} aria-hidden="true" /></span>}
      <div><strong>{a.nombre}</strong><small>{tamanoLegible(a.tamano)}{a.tipo === 'application/pdf' && URL_ADJUNTO(a.id) ? ' · ' : ''}{a.tipo === 'application/pdf' && URL_ADJUNTO(a.id) && <a href={URL_ADJUNTO(a.id)} target="_blank" rel="noreferrer">Vista previa</a>}</small></div>
      <button type="button" className="kv-co-adj__quitar" aria-label={`Eliminar ${a.nombre}`} onClick={() => { quitarArchivo(a.id); onCambio(valor.filter((x) => x.id !== a.id)); }}><Trash2 size={16} aria-hidden="true" /></button></li>)}</ul>}
  </div>;
}

/** Datos de ejemplo (solo modo demostración): cumplen las validaciones, son editables y NO aceptan el consentimiento por el usuario. */
const ejemploConsulta = (): BorradorConsulta => ({
  ...borradorVacio(), motivo: 'interconectar', tipoInmueble: 'industrial', ubicacion: 'Hermosillo, Sonora', potencia: '40', nivelTension: 'media', etapa: 'propuesta',
  descripcion: `Interconexión fotovoltaica de 40 kW en media tensión para ${EMPRESA_DEMO}.`, nombre: TITULAR_DEMO.nombre, correo: TITULAR_DEMO.correo, telefono: TELEFONO_DEMO,
});
const enModoDemo = () => import.meta.env.DEV && window.location.pathname.startsWith('/demo/portal');

export function ConsultaAsistente() {
  const navegar = useNavigate();
  const [paso, setPaso] = useState(0);
  const [b, setB] = useState<BorradorConsulta>(() => enModoDemo() ? ejemploConsulta() : borradorVacio());
  const [ejemplo, setEjemplo] = useState(enModoDemo);
  const base = useRef(JSON.stringify({ ...b, adjuntos: [] }));
  const [intento, setIntento] = useState(false);
  const set = <K extends keyof BorradorConsulta>(k: K, v: BorradorConsulta[K]) => setB((x) => ({ ...x, [k]: v }));
  useEffect(() => { window.scrollTo({ top: 0 }); }, [paso]);
  useEffect(() => { marcarFormularioSucio(JSON.stringify({ ...b, adjuntos: [] }) !== base.current || b.adjuntos.length > 0); }, [b]);
  useEffect(() => () => marcarFormularioSucio(false), []);

  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.correo.trim());
  const errores = useMemo(() => [
    b.motivo ? '' : 'Elige una opción para continuar.',
    b.ubicacion.trim() ? '' : 'Indica una ciudad o ubicación aproximada.',
    b.etapa ? '' : 'Elige la etapa en la que te encuentras.',
    !b.nombre.trim() ? 'Escribe tu nombre.' : !correoOk ? 'Escribe un correo válido.' : !b.consentimientoContacto ? 'Necesitamos tu consentimiento para contactarte.' : '',
  ], [b, correoOk]);

  function siguiente() { setIntento(true); if (errores[paso]) return; setIntento(false); if (paso < 3) setPaso(paso + 1); else { accionesConsulta.enviar(b); marcarFormularioSucio(false); navegar('/portal/consulta/enviada'); } }
  const err = intento && errores[paso];

  return <div className="kv-co-asistente">
    <Link to="/" className="kv-co-volver" onClick={(e) => { if (!confirmarSalida()) e.preventDefault(); }}><ArrowLeft size={16} aria-hidden="true" /> Volver al inicio</Link>
    {enModoDemo() && <div className="kv-ejemplo">{ejemplo && <span className="kv-ejemplo__etiqueta">Datos de ejemplo precargados</span>}
      <button type="button" onClick={() => { setB(ejemploConsulta()); setEjemplo(true); setIntento(false); }}>Restablecer datos de ejemplo</button>
      <button type="button" onClick={() => { setB(borradorVacio()); setEjemplo(false); setIntento(false); }}>Limpiar formulario</button></div>}
    <ol className="kv-co-pasos" aria-label="Progreso">{PASOS.map((p, i) => <li key={p} data-estado={i < paso ? 'hecho' : i === paso ? 'actual' : 'pendiente'} aria-current={i === paso ? 'step' : undefined}><span>{i < paso ? <Check size={14} aria-hidden="true" /> : i + 1}</span><b>{p}</b></li>)}</ol>

    {paso === 0 && <section className="kv-co-paso"><h1>¿Qué tienes en mente?</h1><p className="kv-co-sub">Elige lo que más se parezca a tu situación. Es solo un motivo de consulta: después lo platicamos.</p>
      <div className="kv-co-opciones" role="radiogroup" aria-label="Motivo de consulta">{MOTIVOS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={b.motivo === m.id} className={'kv-co-opcion' + (b.motivo === m.id ? ' on' : '')} onClick={() => set('motivo', m.id)}>
        <span className="kv-co-opcion__ico"><m.Icono size={26} aria-hidden="true" /></span><strong>{m.titulo}</strong><small>{m.texto}</small></button>)}</div></section>}

    {paso === 1 && <section className="kv-co-paso"><h1>Conozcamos tu instalación</h1><p className="kv-co-sub">Lo que no sepas, déjalo en blanco: IDC te ayuda a completarlo.</p>
      <fieldset className="kv-co-campo"><legend>Tipo de inmueble</legend><div className="kv-co-chips4">{INMUEBLES.map((i) => <button key={i.id} type="button" role="radio" aria-checked={b.tipoInmueble === i.id} className={'kv-co-mini' + (b.tipoInmueble === i.id ? ' on' : '')} onClick={() => set('tipoInmueble', i.id)}><i.Icono size={22} aria-hidden="true" />{i.t}</button>)}</div></fieldset>
      <label className="kv-co-campo">Ciudad o ubicación aproximada<input value={b.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Ej. Hermosillo, Sonora" autoComplete="address-level2" /></label>
      <label className="kv-co-campo">Potencia estimada en kW <span>(opcional)</span><input value={b.potencia} inputMode="decimal" onChange={(e) => set('potencia', e.target.value)} placeholder="Ej. 40" /></label>
      <Ayuda titulo="¿No conozco la potencia?">Es normal. La potencia suele aparecer en la cotización de tus paneles. Si no la tienes, déjala vacía y te orientamos.</Ayuda>
      <fieldset className="kv-co-campo"><legend>Nivel de tensión</legend><div className="kv-co-chips3">{([['baja', 'Baja tensión'], ['media', 'Media tensión'], ['no_se', 'No lo sé']] as const).map(([id, t]) => <button key={id} type="button" role="radio" aria-checked={b.nivelTension === id} className={'kv-co-mini kv-co-mini--txt' + (b.nivelTension === id ? ' on' : '')} onClick={() => set('nivelTension', id)}>{t}</button>)}</div></fieldset>
      <Ayuda titulo="¿Qué es el nivel de tensión?">Describe cómo recibe electricidad tu inmueble. Si no estás seguro, elige «No lo sé»: no necesitas saberlo para continuar y IDC lo revisa contigo.</Ayuda>
      <label className="kv-co-campo">Cuéntanos brevemente tu proyecto <span>(opcional)</span><textarea rows={3} value={b.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Ej. Tengo una nave y quiero saber cómo conectar mis paneles." /></label></section>}

    {paso === 2 && <section className="kv-co-paso"><h1>¿En qué etapa te encuentras?</h1><p className="kv-co-sub">Así sabemos cómo acompañarte mejor.</p>
      <div className="kv-co-etapas" role="radiogroup" aria-label="Etapa del proyecto">{ETAPAS.map((e) => <button key={e.id} type="button" role="radio" aria-checked={b.etapa === e.id} className={'kv-co-opcion kv-co-opcion--fila' + (b.etapa === e.id ? ' on' : '')} onClick={() => set('etapa', e.id)}><strong>{e.t}</strong><small>{e.s}</small></button>)}</div>
      <section className="kv-co-adjuntos"><h2>Adjuntar información <span>(opcional)</span></h2>
        <p className="kv-co-sub">Si tienes alguno de estos archivos, nos ayuda a orientarte. En esta etapa no pedimos identificaciones, constancia fiscal ni documentos legales. Los archivos se quedan solo en tu navegador durante la demostración.</p>
        {ADJUNTOS_CAT.map((c) => <Adjuntos key={c.id} categoria={c.id} titulo={c.t} Icono={c.Icono} valor={b.adjuntos} onCambio={(a) => set('adjuntos', a)} />)}</section></section>}

    {paso === 3 && <section className="kv-co-paso"><h1>Hablemos de tu proyecto</h1><p className="kv-co-sub">Solo usaremos estos datos para orientarte.</p>
      <div className="kv-co-dos">
        <label className="kv-co-campo">Nombre completo<input value={b.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="name" /></label>
        <label className="kv-co-campo">Correo electrónico<input type="email" value={b.correo} onChange={(e) => set('correo', e.target.value)} autoComplete="email" /></label>
        <label className="kv-co-campo">Teléfono o WhatsApp <span>(opcional)</span><input type="tel" value={b.telefono} onChange={(e) => set('telefono', e.target.value)} autoComplete="tel" /></label>
        <label className="kv-co-campo">Horario preferido<select value={b.horarioContacto} onChange={(e) => set('horarioContacto', e.target.value)}>{HORARIOS.map((h) => <option key={h}>{h}</option>)}</select></label></div>
      <fieldset className="kv-co-campo"><legend>¿Cómo prefieres que te contactemos?</legend><div className="kv-co-chips3">{([['correo', 'Correo', Mail], ['telefono', 'Llamada', Phone], ['whatsapp', 'WhatsApp', MessageCircle]] as const).map(([id, t, I]) => <button key={id} type="button" role="radio" aria-checked={b.medioContacto === id} className={'kv-co-mini kv-co-mini--txt' + (b.medioContacto === id ? ' on' : '')} onClick={() => set('medioContacto', id)}><I size={17} aria-hidden="true" /> {t}</button>)}</div></fieldset>
      <section className="kv-co-resumen" aria-label="Resumen de tu consulta"><h2>Resumen <span>(puedes editarlo)</span></h2>
        <dl>
          <dt>Motivo</dt><dd>{MOTIVOS.find((m) => m.id === b.motivo)?.titulo}<button type="button" onClick={() => setPaso(0)}>Editar</button></dd>
          <dt>Inmueble</dt><dd>{INMUEBLES.find((i) => i.id === b.tipoInmueble)?.t} · {b.ubicacion}{b.potencia ? ` · ${b.potencia} kW` : ''} · {b.nivelTension === 'no_se' ? 'tensión: no lo sé' : b.nivelTension === 'baja' ? 'baja tensión' : 'media tensión'}<button type="button" onClick={() => setPaso(1)}>Editar</button></dd>
          <dt>Etapa</dt><dd>{ETAPAS.find((e) => e.id === b.etapa)?.t}<button type="button" onClick={() => setPaso(2)}>Editar</button></dd>
          <dt>Archivos</dt><dd>{b.adjuntos.length ? `${b.adjuntos.length} adjunto(s)` : 'Ninguno'}<button type="button" onClick={() => setPaso(2)}>Editar</button></dd></dl></section>
      <label className="kv-co-consent"><input type="checkbox" checked={b.consentimientoContacto} onChange={(e) => set('consentimientoContacto', e.target.checked)} /><span>Acepto que el equipo de IDC me contacte para orientarme sobre mi proyecto. <small>(En esta demostración no se envía nada real.)</small></span></label></section>}

    {err && <p className="kv-co-error" role="alert">{err}</p>}
    <div className="kv-co-nav">
      <button type="button" className="kvp-boton kvp-boton--suave" disabled={paso === 0} onClick={() => setPaso(paso - 1)}><ArrowLeft size={16} aria-hidden="true" /> Anterior</button>
      <button type="button" className="kvp-boton kvp-boton--grande" onClick={siguiente}>{paso === 3 ? <>Enviar mi consulta <Send size={17} aria-hidden="true" /></> : <>Siguiente <ArrowRight size={17} aria-hidden="true" /></>}</button></div>
  </div>;
}

// ───────────────────────── Confirmación ─────────────────────────
export function ConsultaEnviada() {
  const { consultas, ultimo } = useConsultas();
  const navegar = useNavigate();
  const c = ultimo ? consultas[ultimo] : undefined;
  useEffect(() => { if (!c) navegar('/portal/consulta', { replace: true }); }, [c, navegar]);
  if (!c) return null;
  const recorrido = ['Consulta recibida', 'Revisión inicial de IDC', 'Contacto y orientación', 'Inicio del proyecto, si procede'];
  return <div className="kv-co-exito">
    <section className="kv-co-hero kv-co-hero--exito"><div className="kv-co-hero__texto"><span className="kv-co-etiqueta">Consulta enviada</span>
      <h1>¡Tu proyecto comienza aquí!</h1><p>Recibimos la información de tu proyecto. El equipo de IDC podrá revisar tu solicitud y orientarte sobre los siguientes pasos.</p>
      <div className="kv-co-ref"><span>Referencia preliminar</span><strong className="kv-mono">{c.idPreliminar}</strong><small>No es un folio de proyecto. Código de seguimiento de prueba: <b className="kv-mono">{c.codigoSeguimiento}</b></small></div></div>
      <IlusExito className="kv-co-hero__ilus" /></section>
    <ol className="kv-co-recorrido">{recorrido.map((r, i) => <li key={r} data-hecho={i === 0 || undefined}><span>{i === 0 ? <Check size={15} aria-hidden="true" /> : i + 1}</span>{r}</li>)}</ol>
    <div className="kv-co-acciones"><Link className="kvp-boton kvp-boton--grande" to={`/portal/consulta/seguimiento?ref=${c.idPreliminar}`}>Consultar el estado de mi solicitud <ArrowRight size={17} aria-hidden="true" /></Link>
      <Link className="kvp-boton kvp-boton--suave" to={`/portal/consulta/asesoria?ref=${c.idPreliminar}`}><CalendarDays size={16} aria-hidden="true" /> Solicitar una asesoría</Link></div>
    <div className="kv-co-correos">
      <article className="kv-co-mail"><header><Mail size={15} aria-hidden="true" /> Correo de confirmación <em>(simulación)</em></header><dl><dt>Para</dt><dd>{c.correo}</dd><dt>Asunto</dt><dd>Recibimos tu consulta {c.idPreliminar}</dd></dl>
        <p>Hola, {c.nombre.split(' ')[0]}:</p><p>Recibimos tu consulta. El equipo de IDC podrá revisarla y orientarte sobre los siguientes pasos. Guarda tu referencia y tu código de seguimiento de prueba.</p><p className="kv-mono">{c.idPreliminar} · {c.codigoSeguimiento}</p></article>
      <article className="kv-co-mail kv-co-mail--gestor"><header><Send size={15} aria-hidden="true" /> Notificación al gestor <em>(simulación, no se envió)</em></header>
        {c.notificacionesGestor.map((n) => n.canal === 'correo'
          ? <div key={n.id}><dl><dt>Para</dt><dd>{n.para}</dd><dt>Asunto</dt><dd>{n.asunto}</dd></dl><p>{n.texto}</p></div>
          : <div key={n.id} className="kv-co-wa"><small>WhatsApp · {n.para}</small><p>{n.texto}</p></div>)}</article>
    </div>
  </div>;
}

// ───────────────────────── Seguimiento ─────────────────────────
function Linea({ estado }: { estado: EstadoConsulta }) {
  const i = ORDEN_ESTADOS.indexOf(estado);
  return <ol className="kv-co-linea" aria-label="Estado de la consulta">{ORDEN_ESTADOS.map((e, k) => <li key={e} data-estado={k < i ? 'hecho' : k === i ? 'actual' : 'pendiente'}><span>{k < i ? <Check size={13} aria-hidden="true" /> : k + 1}</span>{TEXTO_ESTADO[e]}</li>)}</ol>;
}
export function ConsultaSeguimiento() {
  const [params] = useSearchParams();
  const { ultimo } = useConsultas();
  const [ref, setRef] = useState(params.get('ref') ?? '');
  const [codigo, setCodigo] = useState('');
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [adj, setAdj] = useState<AdjuntoRef[]>([]);
  const store = useConsultas();
  const c: ConsultaPreliminar | undefined = id ? store.consultas[id] : undefined;
  const propia = ultimo ? store.consultas[ultimo] : undefined;

  function entrar(e: React.FormEvent) { e.preventDefault(); const x = accederSeguimiento(ref, codigo); if (!x) { setError('No encontramos esa combinación. Revisa tu referencia y tu código de prueba.'); return; } setError(''); setId(x.idPreliminar); }

  if (!c) return <div className="kv-co-acceso">
    <span className="kv-co-etiqueta">Seguimiento de tu consulta</span><h1>Consulta el estado de tu solicitud.</h1>
    <p className="kv-co-sub">La referencia pública no basta para ver información privada: necesitas también tu código de seguimiento.</p>
    <form onSubmit={entrar}><label className="kv-co-campo">Referencia<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PRE-2026-001" autoCapitalize="characters" /></label>
      <label className="kv-co-campo">Código de seguimiento<input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="PRUEBA-0001" autoCapitalize="characters" /></label>
      {error && <p className="kv-co-error" role="alert">{error}</p>}
      <button type="submit" className="kvp-boton kvp-boton--grande" disabled={!ref || !codigo}><Lock size={16} aria-hidden="true" /> Ver mi seguimiento</button></form>
    <aside className="kv-co-pruebas"><strong>Códigos de prueba (demostración)</strong>
      <ul>{propia && <li><span className="kv-mono">{propia.idPreliminar}</span> · <span className="kv-mono">{propia.codigoSeguimiento}</span> <button type="button" onClick={() => { setRef(propia.idPreliminar); setCodigo(propia.codigoSeguimiento); }}>Usar</button></li>}
        <li><span className="kv-mono">PRE-2026-000</span> · <span className="kv-mono">PRUEBA-0000</span> <small>(ejemplo: IDC pide información)</small> <button type="button" onClick={() => { setRef('PRE-2026-000'); setCodigo('PRUEBA-0000'); }}>Usar</button></li></ul></aside>
  </div>;

  const pideInfo = c.estado === 'info_solicitada';
  return <div className="kv-co-seg">
    <header className="kv-co-seg__cab"><div><span className="kv-co-etiqueta">Referencia {c.idPreliminar}</span><h1>{TEXTO_ESTADO[c.estado]}</h1><p className="kv-co-sub">Responsable: {c.responsable ? `${c.responsable.nombre} · ${c.responsable.rol}` : 'Se asignará al iniciar la revisión.'}</p></div>
      <span className="kv-gr-pill kv-gr-pill--info">{fechaHora(c.fechaSolicitud)}</span></header>
    <Linea estado={c.estado} />
    {pideInfo && <section className="kv-co-pide"><strong><Info size={18} aria-hidden="true" /> IDC necesita un dato más</strong><p>{[...c.historial].reverse().find((m) => m.de === 'idc')?.texto}</p>
      <label className="kv-co-campo">Tu respuesta<textarea rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Ej. Mi instalación tiene aproximadamente 40 kW." /></label>
      <Adjuntos categoria="respuesta" titulo="Adjuntar cotización o archivo de prueba" Icono={Paperclip} valor={adj} onCambio={setAdj} />
      <button type="button" className="kvp-boton" disabled={!respuesta.trim() && adj.length === 0} onClick={() => { accionesConsulta.responder(c.idPreliminar, respuesta.trim() || 'Adjunté información (demostración).', adj); setRespuesta(''); setAdj([]); }}><Send size={16} aria-hidden="true" /> Enviar respuesta</button></section>}
    <div className="kv-co-dos kv-co-dos--seg">
      <section className="kv-co-hilo"><h2>Historial de comunicación</h2><ol>{c.historial.map((m) => <li key={m.id} data-de={m.de}><small>{m.de === 'cliente' ? 'Tú' : m.de === 'idc' ? 'IDC' : 'Sistema'} · {fechaHora(m.fecha)}{m.canal !== 'portal' ? ` · ${m.canal}` : ''}</small><p>{m.texto}</p>
        {m.adjuntos?.map((a) => <span key={a.id} className="kv-co-pegado"><Paperclip size={13} aria-hidden="true" /> {a.nombre} ({tamanoLegible(a.tamano)})</span>)}</li>)}</ol></section>
      <aside className="kv-co-lado">
        <section className="kv-co-tarjeta"><h2>Tu consulta</h2><dl><dt>Motivo</dt><dd>{MOTIVOS.find((m) => m.id === c.motivo)?.titulo}</dd><dt>Inmueble</dt><dd>{INMUEBLES.find((i) => i.id === c.tipoInmueble)?.t} · {c.ubicacion}</dd><dt>Potencia</dt><dd>{c.potenciaKw ? c.potenciaKw + ' kW' : 'Por confirmar'}</dd><dt>Etapa</dt><dd>{ETAPAS.find((e) => e.id === c.etapa)?.t}</dd><dt>Adjuntos</dt><dd>{c.adjuntos.length || 'Ninguno'}</dd></dl></section>
        <section className="kv-co-tarjeta kv-co-tarjeta--ase"><h2><CalendarDays size={18} aria-hidden="true" /> Asesoría</h2>
          {c.cita ? <><p><strong>{c.cita.tipo === 'telefonica' ? 'Telefónica' : c.cita.tipo === 'virtual' ? 'Virtual' : 'Presencial'}</strong> · {fechaLarga(c.cita.fecha)} · {c.cita.hora}</p><span className={'kv-gr-pill kv-gr-pill--' + (c.cita.estado === 'confirmada' ? 'ok' : 'alerta')}>{c.cita.estado === 'confirmada' ? 'Confirmada por IDC' : 'Pendiente de confirmación'}</span></>
            : <><p className="kv-suave">Pide una orientación inicial con IDC. No es una cita de entrega de expediente.</p><Link className="kvp-boton kvp-boton--suave" to={`/portal/consulta/asesoria?ref=${c.idPreliminar}`}>Solicitar asesoría</Link></>}</section>
      </aside></div>
    <details className="kv-gr-acordeon kv-co-demo"><summary>Controles de demostración · simular lo que registra IDC</summary><div><p className="kv-suave">Solo para la presentación. No modifican el panel administrativo.</p>
      <div className="kv-tr-botones">{ORDEN_ESTADOS.slice(1).map((e) => <button key={e} type="button" className="kvp-boton kvp-boton--suave" onClick={() => accionesConsulta.simularIdc(c.idPreliminar, e)}>{TEXTO_ESTADO[e]}</button>)}</div></div></details>
    <p className="kv-co-nota"><Info size={15} aria-hidden="true" /> Esta orientación no es un dictamen de viabilidad técnica ni anticipa la decisión de CFE.</p>
  </div>;
}

// ───────────────────────── Cita de asesoría ─────────────────────────
const TIPOS: { id: TipoAsesoria; t: string; s: string; Icono: typeof Phone }[] = [
  { id: 'telefonica', t: 'Asesoría telefónica', s: 'Una llamada breve.', Icono: Phone }, { id: 'virtual', t: 'Asesoría virtual', s: 'Videollamada.', Icono: Video }, { id: 'presencial', t: 'Asesoría presencial', s: 'En la oficina de IDC (ficticia).', Icono: MapPin },
];
export function ConsultaAsesoria() {
  const [params] = useSearchParams();
  const { ultimo } = useConsultas();
  const idRef = params.get('ref') ?? ultimo ?? 'PRE-2026-000';
  const store = useConsultas();
  const c = store.consultas[idRef] ?? leerConsulta('PRE-2026-000');
  const dias = useMemo(() => diasHabiles(6), []);
  const [tipo, setTipo] = useState<TipoAsesoria>('telefonica');
  const [fecha, setFecha] = useState(dias[0] ?? '');
  const [hora, setHora] = useState('');
  const [nota, setNota] = useState('');
  if (!c) return null;
  const cita = c.cita;
  return <div className="kv-co-ase">
    <Link to={`/portal/consulta/seguimiento?ref=${c.idPreliminar}`} className="kv-co-volver"><ArrowLeft size={16} aria-hidden="true" /> Volver al seguimiento</Link>
    <span className="kv-co-etiqueta">Asesoría inicial · {c.idPreliminar}</span><h1>Hablemos con IDC.</h1>
    <p className="kv-co-sub">Elige cómo y cuándo. Esta cita es una orientación inicial y es independiente de la entrega física de un expediente.</p>
    {cita ? <section className="kv-co-tarjeta kv-co-tarjeta--ase kv-co-solicitud"><span className="kv-gr-pill kv-gr-pill--alerta">{cita.estado === 'confirmada' ? 'Confirmada por IDC' : 'Pendiente de confirmación'}</span>
      <h2>{fechaLarga(cita.fecha)} · {cita.hora}</h2><p>{TIPOS.find((t) => t.id === cita.tipo)?.t} · referencia <span className="kv-mono">{cita.id}</span></p>
      <p className="kv-suave">IDC confirmará el horario. Si no puede, te propondrá otro. (Simulación: no se agendó nada real.)</p>
      <Link className="kvp-boton" to={`/portal/consulta/seguimiento?ref=${c.idPreliminar}`}>Ir a mi seguimiento <ArrowRight size={16} aria-hidden="true" /></Link></section>
      : <>
        <div className="kv-co-opciones" role="radiogroup" aria-label="Tipo de asesoría">{TIPOS.map((t) => <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} className={'kv-co-opcion' + (tipo === t.id ? ' on' : '')} onClick={() => setTipo(t.id)}><span className="kv-co-opcion__ico"><t.Icono size={24} aria-hidden="true" /></span><strong>{t.t}</strong><small>{t.s}</small></button>)}</div>
        <div className="kv-co-dias" role="radiogroup" aria-label="Día">{dias.map((d) => { const f = new Date(d + 'T12:00:00'); return <button key={d} type="button" role="radio" aria-checked={fecha === d} className={fecha === d ? 'on' : ''} onClick={() => { setFecha(d); setHora(''); }}><small>{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(f)}</small><strong>{f.getDate()}</strong><small>{new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(f)}</small></button>; })}</div>
        <div className="kv-co-horas" role="radiogroup" aria-label="Hora">{HORAS.map((h) => { const no = ocupado(fecha, h); return <button key={h} type="button" role="radio" aria-checked={hora === h} disabled={no} className={hora === h ? 'on' : ''} onClick={() => setHora(h)}>{h}{no && <small>ocupado</small>}</button>; })}</div>
        <label className="kv-co-campo">Nota para IDC <span>(opcional)</span><textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
        <div className="kv-co-nav"><span className="kv-suave"><Clock3 size={15} aria-hidden="true" /> {hora ? `${fechaLarga(fecha)}, ${hora}` : 'Elige un horario ficticio disponible.'}</span>
          <button type="button" className="kvp-boton kvp-boton--grande" disabled={!hora} onClick={() => accionesConsulta.solicitarAsesoria(c.idPreliminar, tipo, fecha, hora, nota)}>Solicitar asesoría <ArrowRight size={17} aria-hidden="true" /></button></div></>}
    <p className="kv-co-nota">Los horarios son ficticios y la solicitud queda pendiente de confirmación.</p>
  </div>;
}

// ───────────────────────── Cierre del recorrido ─────────────────────────
export function ConsultaFin() {
  return <div className="kv-co-exito"><section className="kv-co-hero kv-co-hero--exito"><div className="kv-co-hero__texto"><span className="kv-co-etiqueta">Recorrido finalizado</span>
    <h1>Gracias por recorrer KairóVolt.</h1><p>Viste el camino completo de un proyecto de interconexión, de la primera consulta a la conexión con la red. Elige cómo quieres continuar.</p></div>
    <IlusExito className="kv-co-hero__ilus" /></section>
    <div className="kv-co-acciones"><Link className="kvp-boton kvp-boton--grande" to="/portal/demos">Volver a explorar los escenarios <ArrowRight size={17} aria-hidden="true" /></Link>
      <a className="kvp-boton kvp-boton--suave" href="/">Regresar al inicio empresarial</a>
      <Link className="kvp-boton kvp-boton--suave" to="/idc/KV-2026-005">Conocer la perspectiva de IDC</Link></div></div>;
}
