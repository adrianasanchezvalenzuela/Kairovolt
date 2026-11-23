import { Link, Outlet } from 'react-router-dom';
import type { EstadoZohoUi, MotivoMock } from '@/application/integracion';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { Badge } from '@/components/ui/Badge';

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

const boton = { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.5)', borderRadius: 'var(--kv-radio)', padding: '2px 10px', font: 'inherit', cursor: 'pointer' } as const;

export function AppShell() {
  const { integracion, sesion, fuente, motivoMock, cerrarSesion } = useFuenteDatos();
  const zoho = zohoUi[integracion.zoho];
  const puedeIniciar = integracion.zoho === 'conectado' && sesion.adminHabilitado;

  return (
    <>
      <header style={{ background: 'var(--kv-navy)', color: '#fff', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '3px solid var(--kv-ambar)', flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>KairóVolt</Link>
        <span style={{ opacity: 0.7 }}>Panel interno IDC</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {fuente === 'zoho'
            ? <Badge tono="ok">Datos reales · Zoho CRM + Projects</Badge>
            : <Badge tono="alerta">Datos MOCK{motivoMock ? ` · ${motivoUi[motivoMock]}` : ''}</Badge>}
          <span title={integracion.detalle}><Badge tono={zoho.tono}>{zoho.texto}</Badge></span>
          {puedeIniciar && (sesion.autenticado
            ? <button style={boton} onClick={() => void cerrarSesion()}>Cerrar sesión</button>
            : <Link to="/acceso" style={{ ...boton, textDecoration: 'none' }}>Iniciar sesión</Link>)}
        </span>
      </header>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
        <Outlet />
      </main>
    </>
  );
}
