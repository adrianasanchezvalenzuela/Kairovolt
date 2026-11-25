import { useEffect } from 'react';
import { Bell, ClipboardList, FolderOpen, History, House, Info, LogOut, UserRound } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CargaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { REQUIERE_ACCION } from '@/components/portal/estados';
import { Boton } from '@/components/ui/Boton';
import { ErrorState } from '@/components/ui/Estados';
import { usePortal } from '@/hooks/PortalContexto';

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
  const avisos = v.notificaciones.filter((n) => n.tipo === 'accion').length;
  const items = [
    { to: '/portal/inicio', etiqueta: 'Inicio', Icono: House, cuenta: 0 },
    ...(v.permisos.editarParticipantes ? [{ to: '/portal/mis-datos', etiqueta: 'Mis datos', Icono: ClipboardList, cuenta: 0 }] : []),
    { to: '/portal/documentos', etiqueta: 'Documentos', Icono: FolderOpen, cuenta: v.documentos?.filter((d) => REQUIERE_ACCION.includes(d.estado)).length ?? 0 },
    { to: '/portal/avisos', etiqueta: 'Avisos', Icono: Bell, cuenta: avisos },
    { to: '/portal/historial', etiqueta: 'Historial', Icono: History, cuenta: 0 },
  ];
  const titulo = items.find((i) => pathname === i.to)?.etiqueta ?? 'Portal del cliente';

  return <div className="kvp kv-cliente">
    <a href="#contenido" className="kv-salto">Saltar al contenido</a>
    <aside className="kv-cliente-sidebar" aria-label="Portal KairóVolt">
      <MarcaPortal />
      <div className="kv-cliente-folio"><FolderOpen size={16} aria-hidden="true" /><span>{v.folio}</span></div>
      <nav className="kv-cliente-nav" aria-label="Secciones del portal">
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
            ? <NavLink to="/portal/demos" className="kv-cliente-demo" title="Cambiar demostración">DEMO · Cambiar</NavLink>
            : <span className="kv-cliente-demo">DEMO</span>)}
          <NavLink className="kv-cliente-iconbtn" to="/portal/avisos" aria-label={avisos ? 'Avisos, ' + avisos + ' pendientes' : 'Avisos'}><Bell size={19} aria-hidden="true" /></NavLink>
          <span className="kv-cliente-top__cuenta"><UserRound size={16} aria-hidden="true" /> Cliente IDC</span>
          <button type="button" className="kv-cliente-iconbtn kv-cliente-top__salir" aria-label="Cerrar sesión" onClick={() => void salir()}><LogOut size={19} aria-hidden="true" /></button>
        </div>
      </header>
      <main id="contenido" className="kv-cliente-contenido" tabIndex={-1}>
        {v.demo && <div className="kv-cliente-nota"><Info size={16} aria-hidden="true" /> Usa datos ficticios. Los archivos de demostración se descartan y la captura se borra al reiniciar.</div>}
        <Outlet />
        <footer className="kv-cliente-legal"><Info size={16} aria-hidden="true" /> La preparación documental orienta tu trámite. CFE determina su aceptación y viabilidad.</footer>
      </main>
    </div>
  </div>;
}
