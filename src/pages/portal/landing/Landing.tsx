import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, CalendarCheck, CalendarDays, Compass, FolderOpen, HeartHandshake, ListChecks, Menu, MapPin, Radar, ScanSearch, ShieldCheck, X, Zap, BadgeCheck, Cable, ClipboardList, Play, Users,
} from 'lucide-react';
import { MarcaPortal } from '@/components/portal/DisenoPortal';
import { IlusConectada, IlusEquipo } from '@/components/portal/IlustracionesHero';
import { Dialogo } from '@/components/ui/Dialogo';

const ENLACES = [['inicio', 'Inicio'], ['nosotros', 'Nosotros'], ['como-funciona', 'Cómo funciona'], ['contacto', 'Contacto']] as const;
/** Se prueba en este orden; basta con guardar la fotografía con cualquiera de estos nombres en public/brand/. */
const FOTOS = ['/brand/idc-equipo.jpg', '/brand/idc-equipo.jpeg', '/brand/idc-equipo.png', '/brand/idc-equipo.webp'];
/** Los escenarios de demostración viven bajo /demo/portal (modo demo del portal); solo existen en desarrollo. */
const RUTA_DEMOS = '/demo/portal/demos';

/** Revela cada bloque al entrar en pantalla (discreto; respeta «reducir movimiento»). */
function Revela({ children, className = '', retraso = 0 }: { children: ReactNode; className?: string; retraso?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={'kv-ld-revela ' + className + (visible ? ' kv-ld-revela--on' : '')} style={{ transitionDelay: retraso + 'ms' }}>{children}</div>;
}

function irA(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
  el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
}

export function Landing() {
  const [menu, setMenu] = useState(false);
  const [privacidad, setPrivacidad] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);
  const hayDemos = import.meta.env.DEV;
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);
  const ir = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); setMenu(false); irA(id); };

  return <div className="kvp kv-ld">
    <header className="kv-ld-nav">
      <div className="kv-ld-wrap kv-ld-nav__fila">
        <a href="#inicio" onClick={ir('inicio')} className="kv-ld-marca" aria-label="KairóVolt, ir al inicio"><MarcaPortal enlace={false} /></a>
        <nav className="kv-ld-nav__enlaces" aria-label="Secciones">{ENLACES.map(([id, t]) => <a key={id} href={'#' + id} onClick={ir(id)}>{t}</a>)}{hayDemos && <a href={RUTA_DEMOS} className="kv-ld-nav__demos"><Play size={14} aria-hidden="true" /> Demostraciones</a>}</nav>
        <Link to="/portal/acceso" className="kv-ld-nav__portal">Portal del cliente</Link>
        <button type="button" className="kv-ld-nav__burger" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu} aria-controls="kv-ld-menu" onClick={() => setMenu((m) => !m)}>{menu ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}</button>
      </div>
      {menu && <nav id="kv-ld-menu" className="kv-ld-menu" aria-label="Menú móvil">{ENLACES.map(([id, t]) => <a key={id} href={'#' + id} onClick={ir(id)}>{t}</a>)}
        {hayDemos && <a href={RUTA_DEMOS} className="kv-ld-nav__demos"><Play size={14} aria-hidden="true" /> Demostraciones</a>}
        <Link to="/portal/acceso" className="kv-ld-nav__portal" onClick={() => setMenu(false)}>Portal del cliente</Link></nav>}
    </header>

    {/* ── Hero ── */}
    <section id="inicio" className="kv-ld-hero">
      <div className="kv-ld-wrap kv-ld-hero__grid">
        <div className="kv-ld-hero__texto">
          <span className="kv-ld-etiqueta"><Zap size={14} aria-hidden="true" /> Ingeniería · Energía · Conexión</span>
          <h1>Conectamos proyectos.<br /><em>Impulsamos el futuro.</em></h1>
          <p>Ingeniería eléctrica y acompañamiento especializado para llevar tu proyecto de la planeación a la conexión.</p>
          <div className="kv-ld-botones">
            <Link to="/portal/consulta" className="kv-ld-boton kv-ld-boton--ambar">Iniciar un proyecto <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link to="/portal/acceso" className="kv-ld-boton kv-ld-boton--linea">Consultar mi expediente</Link>
          </div>
        </div>
        <figure className="kv-ld-foto">
          <span className="kv-ld-foto__marco" aria-hidden="true" />
          <svg className="kv-ld-foto__trama" viewBox="0 0 120 120" aria-hidden="true"><path d="M0 20h120M0 50h120M0 80h120M0 110h120M20 0v120M50 0v120M80 0v120M110 0v120" stroke="currentColor" strokeWidth="1" /></svg>
          <div className="kv-ld-foto__imagen">{fotoIdx < FOTOS.length ? <img key={FOTOS[fotoIdx]} src={FOTOS[fotoIdx]} alt="Personal de IDC Sistemas Eléctricos trabajando en una instalación eléctrica" loading="eager" onError={() => setFotoIdx((i) => i + 1)} />
            : <IlusEquipo />}</div>
          <figcaption><Cable size={15} aria-hidden="true" /> Ingeniería en acción</figcaption>
        </figure>
      </div>
    </section>

    {/* ── Confianza ── */}
    <section className="kv-ld-confianza" aria-label="Lo que nos distingue">
      <div className="kv-ld-wrap kv-ld-confianza__fila">
        {[[ShieldCheck, 'Confianza técnica', 'Ingeniería eléctrica con criterio profesional.'], [ListChecks, 'Procesos claros', 'Sabes qué sigue en cada etapa.'], [HeartHandshake, 'Atención cercana', 'Un equipo que te acompaña.']].map(([I, t, s]) => {
          const Icono = I as typeof ShieldCheck; return <div key={t as string}><span><Icono size={22} aria-hidden="true" /></span><div><strong>{t as string}</strong><small>{s as string}</small></div></div>;
        })}
      </div>
    </section>

    {/* ── Experiencia interactiva (demostraciones) ── */}
    {hayDemos && <section id="demos" className="kv-ld-demos" aria-label="Demostraciones interactivas">
      <Revela className="kv-ld-wrap kv-ld-demos__grid">
        <div className="kv-ld-demos__texto">
          <span className="kv-ld-etiqueta"><Play size={14} aria-hidden="true" /> Experiencia interactiva</span>
          <h2>Descubre KairóVolt en acción.</h2>
          <p>Explora el recorrido completo de un proyecto de interconexión, desde la primera consulta hasta su conexión con la red.</p>
          <ul className="kv-ld-demos__cifras"><li><b>07</b><span>escenarios interactivos</span></li><li><b>02</b><span>perspectivas de usuario</span></li><li><b>01</b><span>recorrido completo</span></li></ul>
          <a href={RUTA_DEMOS} className="kv-ld-boton kv-ld-boton--ambar kv-ld-boton--grande">Explorar demostraciones <ArrowRight size={20} aria-hidden="true" /></a>
          <small>Sin registro · Datos ficticios · Experiencia de demostración.</small>
        </div>
        <div className="kv-ld-demos__arte" aria-hidden="true">
          <ol>{['Consulta', 'Datos', 'Documentos', 'Entrega', 'Aprobación', 'Medidor', 'Conexión'].map((e, i) => <li key={e}><span>{String(i).padStart(2, '0')}</span>{e}</li>)}</ol>
        </div>
      </Revela>
    </section>}

    {/* ── Acceso a KairóVolt ── */}
    <section id="acceso" className="kv-ld-sec kv-ld-acceso" aria-label="Acceso a KairóVolt">
      <div className="kv-ld-wrap">
        <Revela className="kv-ld-acceso__cab"><span className="kv-ld-kicker">Acceso a KairóVolt</span><h2>Tu energía, un paso más adelante.</h2>
          <p>Desde tu primera consulta hasta tu conexión con la red. Estamos contigo en cada etapa.</p></Revela>
        <div className="kv-ld-caminos">
          <Revela className="kv-ld-camino kv-ld-camino--proyecto"><span className="kv-ld-camino__ico"><ClipboardList size={24} aria-hidden="true" /></span><h3>Ya tengo un proyecto</h3>
            <p>Consulta el avance de tu interconexión. Accede a tus documentos, citas y avisos.</p><Link to="/portal/acceso" className="kvp-boton">Entrar a mi expediente <ArrowRight size={17} aria-hidden="true" /></Link></Revela>
          <Revela className="kv-ld-camino kv-ld-camino--nuevo" retraso={100}><span className="kv-ld-camino__ico"><Compass size={24} aria-hidden="true" /></span><h3>Quiero iniciar un proyecto</h3>
            <p>Cuéntanos qué necesitas y recibe orientación inicial de IDC.</p><Link to="/portal/consulta" className="kvp-boton">Consultar mi proyecto <ArrowRight size={17} aria-hidden="true" /></Link></Revela>
        </div>
        <p className="kv-co-nota"><Users size={0} aria-hidden="true" />La consulta es una conversación inicial: no es un trámite ni genera un folio de proyecto.</p>
      </div>
    </section>

    {/* ── Nosotros ── */}
    <section id="nosotros" className="kv-ld-sec kv-ld-nosotros">
      <div className="kv-ld-wrap kv-ld-nosotros__grid">
        <Revela className="kv-ld-nosotros__texto">
          <span className="kv-ld-kicker">Nosotros</span>
          <h2>Ingeniería que conecta. Tecnología que acompaña.</h2>
          <p>KairóVolt es una propuesta de acompañamiento digital para los proyectos de interconexión eléctrica de IDC Sistemas Eléctricos. Busca facilitar la preparación documental, mejorar la comunicación y brindar mayor claridad durante cada etapa del trámite.</p>
          <p className="kv-ld-aclara">Esta es una propuesta de demostración; todavía no es un servicio operando comercialmente.</p>
        </Revela>
        <Revela className="kv-ld-nosotros__arte" retraso={120}><div><IlusConectada tono="claro" /></div></Revela>
      </div>
    </section>

    {/* ── Cómo funciona ── */}
    <section id="como-funciona" className="kv-ld-sec kv-ld-como">
      <div className="kv-ld-wrap">
        <Revela><span className="kv-ld-kicker">Cómo funciona KairóVolt</span><h2>Cinco momentos, de la primera idea a la conexión.</h2></Revela>
        <div className="kv-ld-pasos" role="list">{([[Compass, 'Cuéntanos sobre tu proyecto', '#DCE7ED'], [FolderOpen, 'Prepara tus datos y documentos', '#C9DFD6'], [BadgeCheck, 'Recibe orientación y revisión de IDC', '#F4DFA9'], [CalendarDays, 'Organiza tus visitas y consulta tus avances', '#DCE7ED'], [Zap, 'Acompaña tu proyecto hasta la conexión', '#C9DFD6']] as const).map(([I, t, fondo], i) => {
          const Icono = I; return <Revela key={t} className="kv-ld-paso" retraso={i * 90}><div role="listitem"><span className="kv-ld-paso__ico" style={{ background: fondo }}><Icono size={26} aria-hidden="true" /><b>{i + 1}</b></span><strong>{t}</strong></div></Revela>;
        })}</div>
      </div>
    </section>

    {/* ── Beneficios ── */}
    <section className="kv-ld-sec kv-ld-bento" aria-label="Beneficios para el cliente">
      <div className="kv-ld-wrap">
        <Revela><span className="kv-ld-kicker">Para ti</span><h2>Menos dudas, más claridad.</h2></Revela>
        <div className="kv-ld-bento__rejilla">
          <Revela className="kv-ld-b kv-ld-b--salvia"><BookOpenCheck size={30} aria-hidden="true" /><h3>Guías documentales</h3><p>Conoce qué necesitas preparar.</p><ul aria-hidden="true"><li /><li /><li /></ul></Revela>
          <Revela className="kv-ld-b kv-ld-b--hielo" retraso={80}><ScanSearch size={30} aria-hidden="true" /><h3>Revisión previa</h3><p>Recibe observaciones antes de acudir presencialmente.</p></Revela>
          <Revela className="kv-ld-b kv-ld-b--crema" retraso={160}><CalendarCheck size={30} aria-hidden="true" /><h3>Agenda de visitas</h3><p>Organiza tus citas con IDC.</p></Revela>
          <Revela className="kv-ld-b kv-ld-b--teal" retraso={240}><Radar size={30} aria-hidden="true" /><h3>Seguimiento transparente</h3><p>Consulta el avance de tu proyecto.</p></Revela>
        </div>
      </div>
    </section>

    {/* ── Llamada final ── */}
    <section className="kv-ld-final">
      <Revela className="kv-ld-wrap kv-ld-final__cuerpo"><h2>Hagamos realidad tu próximo proyecto.</h2>
        <p>Da el primer paso y descubre cómo KairóVolt puede acompañarte durante tu proceso de interconexión.</p>
        <div className="kv-ld-botones"><Link to="/portal/consulta" className="kv-ld-boton kv-ld-boton--ambar">Consultar mi proyecto <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link to="/portal/acceso" className="kv-ld-boton kv-ld-boton--linea">Ya tengo un expediente</Link></div></Revela>
    </section>

    {/* ── Footer ── */}
    <footer id="contacto" className="kv-ld-pie">
      <div className="kv-ld-wrap kv-ld-pie__grid">
        <div><MarcaPortal enlace={false} /><p className="kv-ld-pie__lugar"><MapPin size={15} aria-hidden="true" /> Hermosillo, Sonora, México</p>
          <p className="kv-ld-pie__nota">Para platicar con IDC, inicia una consulta desde esta plataforma.</p></div>
        <nav aria-label="Enlaces rápidos"><strong>Enlaces rápidos</strong>{ENLACES.map(([id, t]) => <a key={id} href={'#' + id} onClick={ir(id)}>{t}</a>)}<a href="#acceso" onClick={ir('acceso')}>Acceso a KairóVolt</a></nav>
        <nav aria-label="Portal"><strong>Portal</strong><Link to="/portal/acceso">Portal del cliente</Link><Link to="/portal/consulta">Iniciar un proyecto</Link>
          <button type="button" onClick={() => setPrivacidad(true)}>Aviso de privacidad de demostración</button></nav>
      </div>
      <div className="kv-ld-wrap kv-ld-pie__base"><span>© KairóVolt · prototipo de demostración · datos ficticios</span>{hayDemos && <a href={RUTA_DEMOS} className="kv-ld-pie__demos">Demos</a>}</div>
    </footer>

    <Dialogo abierto={privacidad} titulo="Aviso de privacidad de demostración" onCerrar={() => setPrivacidad(false)}>
      <div className="kv-gr-detalle"><p>Esta plataforma es un prototipo de demostración. Todos los datos que ves son ficticios.</p>
        <p>Si llenas formularios o adjuntas archivos, la información se queda únicamente en tu navegador durante la sesión: no se envía a ningún servidor, no se crean correos ni mensajes reales y no se genera ningún proyecto formal.</p>
        <p>Antes de un uso real se publicaría un aviso de privacidad formal.</p></div>
    </Dialogo>
  </div>;
}
