import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { EstadoZohoUi, MotivoMock } from '@/application/integracion';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { puede } from '@/domain/usuarios/permisos';
import { ROLES_USUARIO } from '@/domain/usuarios/rol';
import { Boton } from '@/components/ui/Boton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Sidebar, type SeccionNav } from './Sidebar';
import { Topbar } from './Topbar';

const zohoUi: Record<EstadoZohoUi, { texto: string; tono: 'ok' | 'alerta' | 'error' }> = {
  conectado: { texto: 'Zoho: autenticación verificada', tono: 'ok' },
  no_configurado: { texto: 'Zoho: no conectado', tono: 'alerta' },
  error: { texto: 'Zoho: error de conexión', tono: 'error' },
  backend_no_disponible: { texto: 'Backend no disponible', tono: 'alerta' },
};

const motivoUi: Record<MotivoMock, string> = {
  sin_credenciales: 'Zoho no conectado',
  requiere_login: 'inicia sesión para ver Zoho',
  login_deshabilitado: 'define ADMIN_TOKEN para iniciar sesión',
  backend_no_disponible: 'backend no disponible',
  error_zoho: 'error de conexión con Zoho',
};

export function AppShell() {
  const { integracion, sesion, usuario, fuente, motivoMock, cerrarSesion } = useFuenteDatos();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname, hash, search } = useLocation();
  useEffect(() => setMenuAbierto(false), [pathname]);

  // Si Supabase redirige a la URL principal de la app, conserva el enlace de recuperación.
  const fragmento = new URLSearchParams(hash.slice(1));
  const consulta = new URLSearchParams(search);
  if (pathname !== '/restablecer' && (fragmento.get('type') === 'recovery'
    || fragmento.get('error_code') === 'otp_expired' || consulta.get('error_code') === 'otp_expired')) {
    return <Navigate to={{ pathname: '/restablecer', search, hash }} replace />;
  }

  const zoho = zohoUi[integracion.zoho];
  const puedeIniciar = sesion.loginHabilitado; // el login no depende de Zoho: también da acceso a la gestión de usuarios

  const secciones: SeccionNav[] = [
    { titulo: 'Operación', items: [{ to: '/panel', etiqueta: 'Panel', icono: '◧', exacto: true }, { to: '/proyectos', etiqueta: 'Proyectos', icono: '▤' }] },
    { titulo: 'Control', items: [
      { to: '/documentos', etiqueta: 'Documentos', icono: '▭' }, { to: '/validaciones', etiqueta: 'Validaciones', icono: '✓' }, { to: '/cronograma', etiqueta: 'Cronograma', icono: '▦' },
      ...(puede(usuario?.rol, 'gestionar_validaciones') ? [{ to: '/bandeja', etiqueta: 'Bandeja IDC', icono: '▤' }] : []),
      { to: '/seguimiento-cfe', etiqueta: 'Seguimiento CFE', icono: '⚡' }, { to: '/indicadores', etiqueta: 'Indicadores', icono: '%' },
    ] },
    { titulo: 'Sistema', items: [{ to: '/integraciones', etiqueta: 'Integraciones', icono: '⇄' }, { to: '/configuracion', etiqueta: 'Configuración', icono: '⚙' }] },
    ...(puede(usuario?.rol, 'gestionar_usuarios') || usuario
      ? [{ titulo: 'Cuenta', items: [
        ...(puede(usuario?.rol, 'gestionar_usuarios') ? [{ to: '/usuarios', etiqueta: 'Usuarios', icono: '☺' }] : []),
        ...(usuario ? [{ to: '/cuenta', etiqueta: 'Mi cuenta', icono: '☻' }] : []),
      ] }]
      : []),
    { titulo: 'Clientes', items: [
      { to: '/portal', etiqueta: 'Portal del cliente', icono: '↗' },
      // Vista especializada de revisión de expedientes (modo demostración): comparte estado con el portal del cliente.
      ...(import.meta.env.DEV ? [{ to: '/idc/KV-2026-005', etiqueta: 'Revisión documental de clientes', icono: '☑' }] : []),
    ] },
  ];

  return (
    <div className="kv-shell">
      <a href="#contenido" className="kv-salto">Saltar al contenido</a>
      <Sidebar inicio="/panel" marca="KairóVolt" subtitulo="Panel interno IDC" secciones={secciones} abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} pie="IDC Sistemas Eléctricos · Hermosillo" />
      <div className="kv-shell__principal">
        <Topbar marca={{ texto: 'KairóVolt', to: '/panel' }} onMenu={() => setMenuAbierto((a) => !a)} menuAbierto={menuAbierto}>
          {fuente === 'zoho'
            ? <StatusBadge tono="ok" variante="suave" punto>Datos reales · Zoho CRM + Projects</StatusBadge>
            : <StatusBadge tono="alerta" variante="suave" punto>Datos MOCK{motivoMock ? ` · ${motivoUi[motivoMock]}` : ''}</StatusBadge>}
          <StatusBadge tono={zoho.tono} variante="suave" title={integracion.detalle}>{zoho.texto}</StatusBadge>
          {usuario && (
            <Link to="/cuenta" title="Mi cuenta">
              {usuario.nombre ?? usuario.correo} · {ROLES_USUARIO.find((r) => r.valor === usuario.rol)?.etiqueta}
            </Link>
          )}
          {puedeIniciar && (sesion.autenticado
            ? <Boton tamano="sm" onClick={() => void cerrarSesion()}>Cerrar sesión</Boton>
            : <Link to="/acceso" className="kv-btn kv-btn--secundario kv-btn--sm">Iniciar sesión</Link>)}
        </Topbar>
        <main id="contenido" className="kv-shell__contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
