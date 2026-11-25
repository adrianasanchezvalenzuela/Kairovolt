import { useEffect, useState, type FormEvent } from 'react';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Link } from 'react-router-dom';
import { ErrorCuenta } from '@/application/cuenta';
import { validarContrasena } from '@/domain/usuarios/credenciales';
import { cuentaRepositorio } from '@/infrastructure';

const campo = { padding: '8px 10px', font: 'inherit', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)', width: '100%', marginTop: 4 } as const;
const boton = { padding: '8px 16px', font: 'inherit', fontWeight: 600, color: '#fff', background: 'var(--kv-teal)', border: 0, borderRadius: 'var(--kv-radio)', cursor: 'pointer' } as const;

/** Lee el token temporal del fragmento (#access_token=...) del enlace del correo. Nunca llega al servidor como parte de la URL. */
function leerEnlace(): { token: string | null; vencido: boolean } {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = h.get('access_token');
  const tipo = h.get('type');
  return { token: token && (tipo === 'recovery' || tipo === null) ? token : null, vencido: h.has('error') || h.has('error_description') };
}

export function Restablecer() {
  // Se lee una vez al montar (el inicializador es puro, así que React StrictMode no lo estropea)
  const [enlace] = useState(leerEnlace);
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  // El token sale de la barra de direcciones y del historial en cuanto se lee: queda solo en memoria.
  useEffect(() => { if (window.location.hash) window.history.replaceState(null, '', window.location.pathname); }, []);

  const problema = nueva === '' ? null : validarContrasena(nueva);
  const noCoincide = repetir !== '' && repetir !== nueva;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!enlace.token) return;
    setEnviando(true);
    setError(null);
    try {
      await cuentaRepositorio.restablecer(enlace.token, nueva);
      setListo(true);
      setNueva(''); setRepetir('');
    } catch (err) {
      setError(err instanceof ErrorCuenta ? err.message : 'Error inesperado.');
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h1>Contraseña actualizada</h1>
        <p role="status" style={{ color: 'var(--kv-ok)' }}>Ya puedes entrar con tu contraseña nueva.</p>
        <p><Link to="/acceso">Iniciar sesión</Link></p>
      </div>
    );
  }

  if (!enlace.token) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h1>Enlace no válido</h1>
        <AlertPanel tono="error">
          {enlace.vencido ? 'El enlace venció o ya se usó.' : 'Esta página solo funciona desde el enlace del correo de recuperación.'}
        </AlertPanel>
        <p><Link to="/acceso">Pedir un enlace nuevo</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} style={{ maxWidth: 420 }}>
      <h1>Nueva contraseña</h1>
      <p className="kv-suave">Elige una contraseña nueva para tu cuenta.</p>
      <label htmlFor="nueva">Contraseña nueva</label>
      <input id="nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required style={campo} />
      <div style={{ fontSize: 12, marginTop: 2, color: problema ? 'var(--kv-error)' : 'var(--kv-texto-suave)' }}>{problema ?? 'Mínimo 12 caracteres, con letras y números.'}</div>
      <p style={{ margin: '12px 0 0' }}><label htmlFor="repetir">Repite la contraseña</label></p>
      <input id="repetir" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required style={campo} />
      {noCoincide && <div style={{ fontSize: 12, marginTop: 2, color: 'var(--kv-error)' }}>Las contraseñas no coinciden.</div>}
      <p><button type="submit" style={{ ...boton, opacity: enviando || problema !== null || noCoincide || nueva === '' || repetir === '' ? 0.5 : 1 }} disabled={enviando || problema !== null || noCoincide || nueva === '' || repetir === ''}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button></p>
      {error && <AlertPanel tono="error" acciones={<Link to="/acceso">Pedir un enlace nuevo</Link>}>{error}</AlertPanel>}
    </form>
  );
}
