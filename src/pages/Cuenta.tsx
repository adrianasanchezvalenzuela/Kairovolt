import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorCuenta } from '@/application/cuenta';
import { validarContrasena } from '@/domain/usuarios/credenciales';
import { ROLES_USUARIO } from '@/domain/usuarios/rol';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { cuentaRepositorio } from '@/infrastructure';

const campo = { padding: '8px 10px', font: 'inherit', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)', width: '100%', marginTop: 4 } as const;
const boton = { padding: '8px 16px', font: 'inherit', fontWeight: 600, color: '#fff', background: 'var(--kv-teal)', border: 0, borderRadius: 'var(--kv-radio)', cursor: 'pointer' } as const;

export function Cuenta() {
  const { sesion, usuario } = useFuenteDatos();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!sesion.autenticado || !usuario) {
    return (
      <>
        <h1>Mi cuenta</h1>
        <p className="kv-suave">Inicia sesión para ver tu cuenta. <Link to="/acceso">Iniciar sesión</Link></p>
      </>
    );
  }

  const problema = nueva === '' ? null : validarContrasena(nueva);
  const noCoincide = repetir !== '' && repetir !== nueva;
  const deshabilitado = enviando || actual === '' || nueva === '' || repetir === '' || problema !== null || noCoincide;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setAviso(null);
    try {
      await cuentaRepositorio.cambiarContrasena(actual, nueva);
      setAviso({ tipo: 'ok', texto: 'Contraseña actualizada.' });
      setActual(''); setNueva(''); setRepetir('');
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof ErrorCuenta ? err.message : 'Error inesperado.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <h1>Mi cuenta</h1>
      <p>
        <strong>{usuario.nombre ?? usuario.correo ?? 'Administrador'}</strong>
        {usuario.correo && <span className="kv-suave"> · {usuario.correo}</span>}
        <span className="kv-suave"> · {ROLES_USUARIO.find((r) => r.valor === usuario.rol)?.etiqueta}</span>
      </p>

      <h2>Cambiar contraseña</h2>
      {usuario.via === 'token' ? (
        <p className="kv-suave">Entraste con el token de emergencia: esta sesión no tiene una cuenta con contraseña. Inicia sesión con tu correo para cambiarla.</p>
      ) : (
        <form onSubmit={(e) => void enviar(e)} style={{ maxWidth: 420 }}>
          <label htmlFor="actual">Contraseña actual</label>
          <input id="actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required style={campo} />
          <p style={{ margin: '12px 0 0' }}><label htmlFor="nueva">Contraseña nueva</label></p>
          <input id="nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required style={campo} />
          <div style={{ fontSize: 12, marginTop: 2, color: problema ? 'var(--kv-error)' : 'var(--kv-texto-suave)' }}>{problema ?? 'Mínimo 12 caracteres, con letras y números.'}</div>
          <p style={{ margin: '12px 0 0' }}><label htmlFor="repetir">Repite la contraseña nueva</label></p>
          <input id="repetir" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required style={campo} />
          {noCoincide && <div style={{ fontSize: 12, marginTop: 2, color: 'var(--kv-error)' }}>Las contraseñas no coinciden.</div>}
          <p><button type="submit" disabled={deshabilitado} style={{ ...boton, opacity: deshabilitado ? 0.5 : 1 }}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button></p>
        </form>
      )}
      {aviso && <p role={aviso.tipo === 'error' ? 'alert' : 'status'} style={{ color: aviso.tipo === 'error' ? 'var(--kv-error)' : 'var(--kv-ok)' }}>{aviso.texto}</p>}
    </>
  );
}
