import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { ResultadoInicioSesion } from '@/application/integracion';
import { useFuenteDatos } from '@/hooks/FuenteDatos';

const mensajes: Record<Exclude<ResultadoInicioSesion, 'ok'>, string> = {
  token_invalido: 'Token incorrecto.',
  demasiados_intentos: 'Demasiados intentos fallidos. Espera un minuto.',
  deshabilitado: 'El inicio de sesión está deshabilitado: falta ADMIN_TOKEN en el backend.',
  error: 'No se pudo contactar al backend.',
};

export function Acceso() {
  const { sesion, iniciarSesion } = useFuenteDatos();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sesion.autenticado) return <Navigate to="/" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await iniciarSesion(token);
    setEnviando(false);
    if (r === 'ok') navigate('/');
    else { setError(mensajes[r]); setToken(''); }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} style={{ maxWidth: 420 }}>
      <h1>Iniciar sesión</h1>
      <p className="kv-suave">Ingresa el token de administración (<span className="kv-mono">ADMIN_TOKEN</span> del backend) para ver y sincronizar datos reales de Zoho.</p>
      <label htmlFor="token">Token de administración</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required
          style={{ flex: 1, padding: '8px 10px', font: 'inherit', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)' }}
        />
        <button type="submit" disabled={enviando || token === ''} style={{ padding: '8px 16px', font: 'inherit', fontWeight: 600, color: '#fff', background: 'var(--kv-teal)', border: 0, borderRadius: 'var(--kv-radio)', cursor: 'pointer' }}>
          Entrar
        </button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--kv-error)' }}>{error}</p>}
      <p className="kv-suave" style={{ fontSize: 12 }}>El token no se guarda en el navegador: el backend lo cambia por una sesión que dura 8 horas.</p>
    </form>
  );
}
