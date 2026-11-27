import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, ClipboardCheck, Download, FolderOpen, History, House, Inbox, Mail, RotateCcw, Users, X, Zap } from 'lucide-react';
import { CLIENTE, type Documento, type EstadoDoc } from './datos';
import { acciones, useProto } from './store';
import { descargarPdfDemo, urlPdfDemo } from './pdf';
import './prototipo.css';

export const fechaLarga = (iso: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Hermosillo' }).format(new Date(iso.length === 10 ? iso + 'T12:00:00-07:00' : iso));
export const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Hermosillo' }).format(new Date(iso));
export const diaISO = (d: Date) => d.toISOString().slice(0, 10);

export const ESTADO: Record<EstadoDoc, { texto: string; clase: string }> = {
  pendiente: { texto: 'Por subir', clase: 'pendiente' },
  en_revision: { texto: 'En revisión', clase: 'revision' },
  observado: { texto: 'Necesita corrección', clase: 'observado' },
  aceptado: { texto: 'Aceptado', clase: 'aceptado' },
};
export function Pastilla({ estado }: { estado: EstadoDoc }) {
  return <span className={'kp-pastilla kp-pastilla--' + ESTADO[estado].clase}>{ESTADO[estado].texto}</span>;
}

export function Marca({ claro }: { claro?: boolean }) {
  return <Link to="/prototipo" className={'kp-marca' + (claro ? ' kp-marca--claro' : '')}>
    <span className="kp-marca__sello"><Zap size={18} aria-hidden /></span>
    <span><strong>KairóVolt</strong><small>IDC Sistemas Eléctricos</small></span>
  </Link>;
}

/** Cinta superior de demostración: cambia de vista y reinicia la historia. */
export function CintaDemo() {
  const s = useProto();
  const { pathname } = useLocation();
  const sinLeer = s.correos.filter((c) => !c.leido).length;
  const [confirmar, setConfirmar] = useState(false);
  const modo = pathname.includes('/idc') ? 'idc' : pathname.includes('/correos') ? 'correos' : pathname.includes('/cliente') ? 'cliente' : '';
  return <div className="kp-cinta" role="region" aria-label="Controles de demostración">
    <span className="kp-cinta__etiqueta"><i /> Prototipo con datos ficticios</span>
    <nav className="kp-cinta__vistas" aria-label="Cambiar de vista">
      <Link className={modo === 'cliente' ? 'on' : ''} to="/prototipo/cliente"><House size={15} aria-hidden /> Cliente</Link>
      <Link className={modo === 'idc' ? 'on' : ''} to="/prototipo/idc"><Users size={15} aria-hidden /> Panel IDC</Link>
      <Link className={modo === 'correos' ? 'on' : ''} to="/prototipo/correos"><Mail size={15} aria-hidden /> Correos{sinLeer > 0 && <b>{sinLeer}</b>}</Link>
    </nav>
    {confirmar
      ? <span className="kp-cinta__confirma">¿Volver al inicio de la historia? <button onClick={() => { acciones.reiniciar(); setConfirmar(false); }}>Sí, reiniciar</button><button className="ghost" onClick={() => setConfirmar(false)}>Cancelar</button></span>
      : <button className="kp-cinta__reiniciar" onClick={() => setConfirmar(true)}><RotateCcw size={14} aria-hidden /> Reiniciar demo</button>}
  </div>;
}

const navCliente = [
  { to: '/prototipo/cliente', end: true, i: House, t: 'Inicio' },
  { to: '/prototipo/cliente/documentos', i: FolderOpen, t: 'Documentos' },
  { to: '/prototipo/cliente/cita', i: CalendarDays, t: 'Mi cita' },
  { to: '/prototipo/cliente/avisos', i: Bell, t: 'Avisos' },
  { to: '/prototipo/cliente/historial', i: History, t: 'Historial' },
];
const navIdc = [
  { to: '/prototipo/idc', end: true, i: Inbox, t: 'Mesa de revisión' },
  { to: '/prototipo/idc/expediente', i: ClipboardCheck, t: 'Expediente' },
  { to: '/prototipo/idc/agenda', i: CalendarDays, t: 'Agenda de citas' },
];

export function MarcoProto({ lado }: { lado: 'cliente' | 'idc' }) {
  const s = useProto();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  const nav = lado === 'cliente' ? navCliente : navIdc;
  const avisos = s.avisos.filter((a) => !a.leido).length;
  const porRevisar = s.documentos.filter((d) => d.estado === 'en_revision').length + (s.cita?.estado === 'solicitada' ? 1 : 0);
  const cuenta = (t: string) => lado === 'cliente' ? (t === 'Avisos' ? avisos : 0) : (t === 'Mesa de revisión' ? porRevisar : 0);
  return <div className={'kp kp--' + lado}>
    <CintaDemo />
    <div className="kp-capa">
      <aside className="kp-lado">
        <Marca claro={lado === 'idc'} />
        <div className="kp-lado__quien">
          {lado === 'cliente'
            ? <><small>Tu expediente</small><strong>{CLIENTE.folio}</strong><span>{CLIENTE.titular}</span></>
            : <><small>Sesión de coordinación</small><strong>{CLIENTE.coordinadora}</strong><span>Panel administrativo IDC</span></>}
        </div>
        <nav aria-label="Secciones">
          {nav.map(({ to, end, i: I, t }) => <NavLink key={to} to={to} end={end}><I size={19} aria-hidden /><span>{t}</span>{cuenta(t) > 0 && <b>{cuenta(t)}</b>}</NavLink>)}
        </nav>
        <p className="kp-lado__pie">Ambos lados comparten el mismo expediente de demostración. Abre el panel IDC en otra pestaña y verás los cambios al instante.</p>
      </aside>
      <main className="kp-contenido"><Outlet /></main>
    </div>
    <nav className="kp-barra" aria-label="Secciones (móvil)">
      {nav.map(({ to, end, i: I, t }) => <NavLink key={to} to={to} end={end}><I size={21} aria-hidden /><span>{t.split(' ')[0]}</span>{cuenta(t) > 0 && <b>{cuenta(t)}</b>}</NavLink>)}
    </nav>
  </div>;
}

export function Encabezado({ kicker, titulo, children }: { kicker?: string; titulo: ReactNode; children?: ReactNode }) {
  return <header className="kp-encabezado">
    {kicker && <span className="kp-kicker">{kicker}</span>}
    <h1>{titulo}</h1>
    {children && <p>{children}</p>}
  </header>;
}

/** Anillo solar de avance. */
export function Sol({ pct, etiqueta }: { pct: number; etiqueta?: string }) {
  const r = 70, c = 2 * Math.PI * r;
  return <div className="kp-sol" role="img" aria-label={`Avance ${pct}%`}>
    <svg viewBox="0 0 180 180">
      <circle cx="90" cy="90" r="46" className="kp-sol__nucleo" />
      <circle cx="90" cy="90" r={r} className="kp-sol__pista" />
      <circle cx="90" cy="90" r={r} className="kp-sol__arco" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 90 90)" />
    </svg>
    <div><strong>{pct}<sup>%</sup></strong><small>{etiqueta ?? 'de tu expediente'}</small></div>
  </div>;
}

/** Visor lateral con vista previa PDF real (generado en el navegador). */
export function Visor({ doc, version, onClose, children }: { doc: Documento; version: number; onClose: () => void; children?: ReactNode }) {
  const [url, setUrl] = useState('');
  const corregido = version > 1;
  useEffect(() => {
    let u = ''; let vivo = true;
    void urlPdfDemo(doc, version, corregido).then((x) => { if (vivo) { u = x; setUrl(x); } else URL.revokeObjectURL(x); });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [doc, version, corregido]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return <div className="kp-visor" role="dialog" aria-modal="true" aria-label={doc.nombre}>
    <button className="kp-visor__fondo" aria-label="Cerrar" onClick={onClose} />
    <section className="kp-visor__hoja">
      <header>
        <div><Pastilla estado={doc.estado} /><h2>{doc.nombre}</h2><p>{doc.descripcion}</p></div>
        <button className="kp-icono" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
      </header>
      <div className="kp-visor__cuerpo">
        <div className="kp-visor__papel">
          {url ? <iframe title={'Vista previa de ' + doc.nombre} src={url + '#toolbar=0&navpanes=0'} /> : <p className="kp-suave">Preparando vista previa…</p>}
          <div className="kp-visor__acciones">
            <span>Vista previa · versión {version}</span>
            <button className="kp-boton kp-boton--suave" onClick={() => void descargarPdfDemo(doc, version, corregido)}><Download size={16} aria-hidden /> Descargar PDF de ejemplo</button>
          </div>
        </div>
        <div className="kp-visor__lado">{children}</div>
      </div>
    </section>
  </div>;
}

/** Selector de archivo con atajo de demostración. */
export function Cargador({ etiqueta, onArchivo }: { etiqueta: string; onArchivo: (nombre: string) => void }) {
  const [sobre, setSobre] = useState(false);
  return <div className={'kp-carga' + (sobre ? ' kp-carga--sobre' : '')}
    onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
    onDrop={(e) => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files[0]; if (f) onArchivo(f.name); }}>
    <strong>{etiqueta}</strong>
    <span>Arrastra un archivo aquí o</span>
    <div>
      <label className="kp-boton">Elegir archivo<input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f.name); e.target.value = ''; }} /></label>
      <button className="kp-boton kp-boton--suave" onClick={() => onArchivo('archivo_de_ejemplo.pdf')}>Usar archivo de ejemplo</button>
    </div>
    <small>PDF, JPG o PNG · en la demo el archivo no sale de tu equipo</small>
  </div>;
}
