import { useState, type FormEvent } from 'react';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Navigate, useNavigate } from 'react-router-dom';
import type { ResultadoInicioSesion } from '@/application/integracion';
import { ErrorCuenta } from '@/application/cuenta';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { cuentaRepositorio } from '@/infrastructure';

const mensajes: Record<Exclude<ResultadoInicioSesion, 'ok'>, string> = {
  credenciales_invalidas: 'Correo o contraseña incorrectos.',
  token_invalido: 'Token incorrecto.',
  cuenta_inactiva: 'Tu cuenta no está activa. Pide a un administrador que la active.',
  demasiados_intentos: 'Demasiados intentos fallidos. Espera un minuto.',
  deshabilitado: 'Este método de acceso no está habilitado en el backend.',
  no_disponible: 'No se pudo verificar tu cuenta (Supabase no responde). Intenta de nuevo en un momento.',
  error: 'No se pudo contactar al backend.',
};

const campo = { padding: '8px 10px', font: 'inherit', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)', width: '100%', marginTop: 4 } as const;
const boton = { padding: '8px 16px', font: 'inherit', fontWeight: 600, color: '#fff', background: 'var(--kv-teal)', border: 0, borderRadius: 'var(--kv-radio)', cursor: 'pointer' } as const;

export function Acceso() {
  const { sesion, iniciarSesionConCorreo, iniciarSesionConToken } = useFuenteDatos();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [correoRecuperacion, setCorreoRecuperacion] = useState('');
  const [recuperacion, setRecuperacion] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  if (sesion.autenticado) return <Navigate to="/" replace />;

  const resolver = async (f: () => Promise<ResultadoInicioSesion>, limpiar: () => void) => {
    setEnviando(true);
    setError(null);
    const r = await f();
    setEnviando(false);
    if (r === 'ok') navigate('/');
    else { setError(mensajes[r]); limpiar(); }
  };

  const entrarConCorreo = (e: FormEvent) => { e.preventDefault(); void resolver(() => iniciarSesionConCorreo(correo, contrasena), () => setContrasena('')); };
  const pedirEnlace = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setRecuperacion(null);
    try {
      await cuentaRepositorio.solicitarRecuperacion(correoRecuperacion);
      setRecuperacion({ tipo: 'ok', texto: 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Puede tardar unos minutos; revisa también la carpeta de spam.' });
    } catch (err) {
      setRecuperacion({ tipo: 'error', texto: err instanceof ErrorCuenta ? err.message : 'Error inesperado.' });
    } finally {
      setEnviando(false);
    }
  };
  const entrarConToken = (e: FormEvent) => { e.preventDefault(); void resolver(() => iniciarSesionConToken(token), () => setToken('')); };

  if (!sesion.loginHabilitado) {
    return (
      <>
        <h1>Iniciar sesión</h1>
        <AlertPanel tono="error">El acceso no está configurado en el backend (falta SUPABASE_PUBLISHABLE_KEY o ADMIN_TOKEN en server/.env).</AlertPanel>
      </>
    );
  }

  const formToken = (
    <form onSubmit={entrarConToken} style={{ maxWidth: 420, marginTop: 8 }}>
      <label htmlFor="token">Token de emergencia (ADMIN_TOKEN)</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required style={campo} />
        <button type="submit" disabled={enviando || token === ''} style={{ ...boton, marginTop: 4 }}>Entrar</button>
      </div>
    </form>
  );

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Iniciar sesión</h1>
      {sesion.metodos.correo && recuperando && (
        <form onSubmit={(e) => void pedirEnlace(e)}>
          <p className="kv-suave">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
          <label htmlFor="correo-rec">Correo</label>
          <input id="correo-rec" type="email" value={correoRecuperacion} onChange={(e) => setCorreoRecuperacion(e.target.value)} autoComplete="username" required style={campo} />
          <p><button type="submit" disabled={enviando || correoRecuperacion === ''} style={boton}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>{' '}
            <button type="button" onClick={() => { setRecuperando(false); setRecuperacion(null); }}>Volver</button></p>
          {recuperacion && <AlertPanel tono={recuperacion.tipo === 'error' ? 'error' : 'ok'}>{recuperacion.texto}</AlertPanel>}
        </form>
      )}
      {sesion.metodos.correo && !recuperando && (
        <form onSubmit={entrarConCorreo}>
          <p className="kv-suave">Entra con tu cuenta de KairóVolt.</p>
          <label htmlFor="correo">Correo</label>
          <input id="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="username" required style={campo} />
          <p style={{ margin: '12px 0 0' }}><label htmlFor="contrasena">Contraseña</label></p>
          <input id="contrasena" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" required style={campo} />
          <p><button type="submit" disabled={enviando || correo === '' || contrasena === ''} style={boton}>{enviando ? 'Entrando…' : 'Entrar'}</button></p>
          <p style={{ fontSize: 13 }}><button type="button" onClick={() => { setRecuperando(true); setCorreoRecuperacion(correo); setError(null); }} style={{ background: 'none', border: 0, padding: 0, color: 'var(--kv-teal)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>¿Olvidaste tu contraseña?</button></p>
        </form>
      )}
      {error && <AlertPanel tono="error">{error}</AlertPanel>}
      {sesion.metodos.token && (sesion.metodos.correo
        ? <details style={{ marginTop: 24 }}><summary className="kv-suave" style={{ cursor: 'pointer' }}>Acceso de emergencia con token</summary>{formToken}</details>
        : <>
          <p className="kv-suave">Ingresa el token de administración (<span className="kv-mono">ADMIN_TOKEN</span> del backend).</p>
          {formToken}
        </>)}
      <p className="kv-suave" style={{ fontSize: 12 }}>La sesión dura 8 horas y vive en una cookie protegida; no se guarda ningún token en el navegador.</p>
    </div>
  );
}
