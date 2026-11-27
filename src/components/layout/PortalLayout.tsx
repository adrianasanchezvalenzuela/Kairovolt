import { useEffect, useState } from 'react';
import { Bell, CalendarDays, ClipboardList, FolderOpen, Archive, ChevronLeft, ChevronRight, FileSignature, Gauge, History, House, Info, LogOut, RotateCcw, UserRound, Waypoints } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CargaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { REQUIERE_ACCION } from '@/components/portal/estados';
import { Boton } from '@/components/ui/Boton';
import { ErrorState } from '@/components/ui/Estados';
import { usePortal } from '@/hooks/PortalContexto';
import { demosPortal, esCapturaDemo, esTramiteDemo } from '@/data/demos-portal';

/** Navegación secuencial entre demos (solo desarrollo): anterior, indicador «Demo n de N» y siguiente / reiniciar. */
function NavegacionDemos({ folio }: { folio: string }) {
  const { entrar } = usePortal();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState(false);
  const total = demosPortal.length;
  const indice = Math.max(0, demosPortal.findIndex((d) => d.folio === folio));
  const ultimo = indice === total - 1;

  async function ir(destino: number) {
    const demo = demosPortal[destino];
    if (!demo || ocupado) return;
    setOcupado(true);
    try {
      document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
      await entrar(demo.folio, demo.codigo);
      navegar('/portal/inicio', { replace: true });
      window.scrollTo({ top: 0 });
    } finally { setOcupado(false); }
  }

  return <div className="kv-demo-nav" role="group" aria-label="Navegación entre demostraciones">
    <button type="button" className="kv-demo-nav__ant" disabled={indice === 0 || ocupado} onClick={() => void ir(indice - 1)} aria-label="Demo anterior" title="Demo anterior"><ChevronLeft size={18} aria-hidden="true" /></button>
    <NavLink to="/portal/demos" className="kv-cliente-demo" title="Elegir una demostración">DEMO · Cambiar</NavLink>
    <span className="kv-demo-nav__indice" aria-live="polite">Demo {indice + 1} de {total}</span>
    <button type="button" className="kv-demo-nav__sig" disabled={ocupado} onClick={() => void ir(ultimo ? 0 : indice + 1)}>
      {ultimo ? <><RotateCcw size={16} aria-hidden="true" /><span>Reiniciar recorrido</span></> : <><span>Siguiente demo</span><ChevronRight size={18} aria-hidden="true" /></>}
    </button>
  </div>;
}

export function PortalLayout() {
  const { fase, salir, recargar } = usePortal();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  if (fase.tipo === 'cargando') return <div className="kvp"><CargaPortal etiqueta="Abriendo tu expediente…" /></div>;
  if (fase.tipo === 'sin_sesion') return <Navigate to="/portal" replace />;
  if (fase.tipo === 'error') return <div className="kvp"><div className="kv-cliente-carga">
    <ErrorState titulo="No pudimos abrir tu expediente" descripcion={fase.error.message} onReintentar={() => void recargar()}
      acciones={<Boton onClick={() => void salir()}>Volver al inicio</Boton>} />
  </div></div>;

  const v = fase.vista;
  const soloCaptura = esCapturaDemo(v);
  if (soloCaptura && pathname !== '/portal/inicio' && pathname !== '/portal/mis-datos') {
    return <Navigate to="/portal/inicio" replace />;
  }
  const avisos = v.notificaciones.filter((n) => n.tipo === 'accion').length;
  const tramite = esTramiteDemo(v);
  const items = [
    { to: '/portal/inicio', etiqueta: 'Inicio', Icono: House, cuenta: 0 },
    ...(tramite ? [{ to: '/portal/recorrido', etiqueta: 'Mi recorrido', Icono: Waypoints, cuenta: 0 }] : []),
    ...(v.permisos.editarParticipantes ? [{ to: '/portal/mis-datos', etiqueta: 'Mis datos', Icono: ClipboardList, cuenta: 0 }] : []),
    ...(!soloCaptura ? [
      { to: '/portal/documentos', etiqueta: 'Documentos', Icono: FolderOpen, cuenta: v.documentos?.filter((d) => REQUIERE_ACCION.includes(d.estado)).length ?? 0 },
      ...(tramite ? [{ to: '/portal/contratos', etiqueta: 'Mis contratos', Icono: FileSignature, cuenta: 0 }, { to: '/portal/instalacion', etiqueta: 'Mi instalación', Icono: Gauge, cuenta: 0 }, { to: '/portal/expediente', etiqueta: 'Expediente final', Icono: Archive, cuenta: 0 }] : []),
      ...(v.documentos !== null ? [{ to: '/portal/visita', etiqueta: 'Mi visita', Icono: CalendarDays, cuenta: 0 }] : []),
      { to: '/portal/avisos', etiqueta: 'Avisos', Icono: Bell, cuenta: avisos },
      { to: '/portal/historial', etiqueta: 'Historial', Icono: History, cuenta: 0 },
    ] : []),
  ];
  const titulo = items.find((i) => pathname === i.to)?.etiqueta ?? (pathname === '/portal/cita' ? 'Mi visita' : 'Portal del cliente');

  return <div className="kvp kv-cliente">
    <a href="#contenido" className="kv-salto">Saltar al contenido</a>
    <aside className="kv-cliente-sidebar" aria-label="Portal KairóVolt">
      <MarcaPortal />
      <div className="kv-cliente-folio"><FolderOpen size={16} aria-hidden="true" /><span>{v.folio}</span></div>
      <nav className={"kv-cliente-nav" + (items.length > 6 ? " kv-cliente-nav--amplia" : "")} aria-label="Secciones del portal">
        {items.map(({ to, Icono, etiqueta, cuenta }) => <NavLink to={to} key={to}>
          <Icono size={19} aria-hidden="true" /><span>{etiqueta}</span>
          {cuenta > 0 && <span className="kv-cliente-nav__cuenta" aria-label={cuenta + ' pendientes'}>{cuenta}</span>}
        </NavLink>)}
      </nav>
      <button type="button" className="kv-cliente-salir" onClick={() => void salir()}><LogOut size={18} aria-hidden="true" />Cerrar sesión</button>
    </aside>
    <div className="kv-cliente-area">
      <header className="kv-cliente-top">
        <div className="kv-cliente-top__marca"><MarcaPortal /></div>
        <span className="kv-cliente-top__ruta">{titulo}</span>
        <div className="kv-cliente-top__acciones">
          {v.demo && (import.meta.env.DEV && window.location.pathname.startsWith('/demo/portal')
            ? <NavegacionDemos folio={v.folio} />
            : <span className="kv-cliente-demo">DEMO</span>)}
          {!soloCaptura && <NavLink className="kv-cliente-iconbtn" to="/portal/avisos" aria-label={avisos ? 'Avisos, ' + avisos + ' pendientes' : 'Avisos'}><Bell size={19} aria-hidden="true" /></NavLink>}
          <span className="kv-cliente-top__cuenta"><UserRound size={16} aria-hidden="true" /> Cliente IDC</span>
          <button type="button" className="kv-cliente-iconbtn kv-cliente-top__salir" aria-label="Cerrar sesión" onClick={() => void salir()}><LogOut size={19} aria-hidden="true" /></button>
        </div>
      </header>
      <main id="contenido" className="kv-cliente-contenido" tabIndex={-1}>
        {v.demo && <div className="kv-cliente-nota"><Info size={16} aria-hidden="true" /> Modo demostración con datos ficticios. Los archivos y citas de prueba se conservan solo en memoria local.</div>}
        <Outlet />
        <footer className="kv-cliente-legal"><Info size={16} aria-hidden="true" /> La preparación documental orienta tu trámite. CFE determina su aceptación y viabilidad.</footer>
      </main>
    </div>
  </div>;
}
