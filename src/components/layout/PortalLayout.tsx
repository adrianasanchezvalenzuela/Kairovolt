import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { REQUIERE_ACCION } from '@/components/portal/estados';
import { Boton } from '@/components/ui/Boton';
import { ErrorState, LoadingState } from '@/components/ui/Estados';
import { usePortal } from '@/hooks/PortalContexto';

/**
 * Estructura del portal del cliente. Protege la ruta: sin sesión vuelve al acceso. (Es comodidad de interfaz; la seguridad real
 * está en el backend, que exige una sesión vigente en cada petición.)
 */
export function PortalLayout() {
  const { fase, salir, recargar } = usePortal();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  if (fase.tipo === 'cargando') return <div className="kvp"><LoadingState variante="pagina" etiqueta="Abriendo tu expediente…" /></div>;
  if (fase.tipo === 'sin_sesion') return <Navigate to="/portal" replace />;
  if (fase.tipo === 'error') {
    return (
      <div className="kvp"><div className="kvp-contenido">
        <ErrorState titulo="No pudimos abrir tu expediente" descripcion={fase.error.message} onReintentar={() => void recargar()} acciones={<Boton onClick={() => void salir()}>Volver al inicio</Boton>} />
      </div></div>
    );
  }

  const v = fase.vista;
  const porEntregar = v.documentos?.filter((d) => REQUIERE_ACCION.includes(d.estado)).length ?? 0;
  const avisos = v.notificaciones.filter((n) => n.tipo === 'accion').length;
  const items = [
    { to: '/portal/inicio', etiqueta: 'Inicio', icono: '◉', cuenta: 0 },
    ...(v.permisos.editarParticipantes ? [{ to: '/portal/mis-datos', etiqueta: 'Mis datos', icono: '☻', cuenta: 0 }] : []),
    { to: '/portal/documentos', etiqueta: 'Documentos', icono: '▤', cuenta: porEntregar },
    { to: '/portal/avisos', etiqueta: 'Avisos', icono: '✉', cuenta: avisos },
    { to: '/portal/historial', etiqueta: 'Historial', icono: '↺', cuenta: 0 },
  ];

  return (
    <div className="kvp">
      <a href="#contenido" className="kv-salto">Saltar al contenido</a>
      <header className="kvp-cab">
        <span className="kvp-cab__marca">KairóVolt</span>
        <span className="kvp-cab__folio">{v.folio}</span>
        {v.demo && <span className="kv-badge kv-badge--solido kv-tono-alerta">DEMO</span>}
        <Boton className="kvp-cab__salir" variante="sobre-oscuro" tamano="sm" onClick={() => void salir()}>Salir</Boton>
      </header>
      <nav className={`kvp-nav${v.permisos.editarParticipantes ? ' kvp-nav--cinco' : ''}`} aria-label="Secciones del portal">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to}>
            <span className="kvp-nav__icono" aria-hidden="true">{i.icono}</span>
            {i.etiqueta}
            {i.cuenta > 0 && <span className="kvp-nav__cuenta" aria-label={`${i.cuenta} pendientes`}>{i.cuenta}</span>}
          </NavLink>
        ))}
      </nav>
      <main id="contenido" className="kvp-contenido" tabIndex={-1}>
        {v.demo && <p className="kv-demo"><strong>Modo demostración:</strong> datos de prueba. Lo que subas aquí no se conserva.</p>}
        <p className="kvp-aviso-cfe">La preparación documental es una guía de acompañamiento; CFE determina la aceptación y viabilidad de cada trámite.</p>
        <Outlet />
      </main>
    </div>
  );
}
