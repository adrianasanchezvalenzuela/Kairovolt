import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorUsuarios, type UsuarioKv } from '@/application/usuarios';
import { generarContrasena, validarContrasena } from '@/domain/usuarios/credenciales';
import { puede } from '@/domain/usuarios/permisos';
import { ROLES_USUARIO, type RolUsuario } from '@/domain/usuarios/rol';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { usuariosRepositorio } from '@/infrastructure';
import { Badge } from '@/components/ui/Badge';

const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const etiquetaRol = (r: RolUsuario | null) => ROLES_USUARIO.find((x) => x.valor === r)?.etiqueta ?? 'Sin rol';
const fecha = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');
const mensajeError = (e: unknown) => (e instanceof ErrorUsuarios ? e.message : 'Error inesperado.');

const campo = { padding: '8px 10px', font: 'inherit', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)', width: '100%' } as const;
const primario = { padding: '8px 16px', font: 'inherit', fontWeight: 600, color: '#fff', background: 'var(--kv-teal)', border: 0, borderRadius: 'var(--kv-radio)', cursor: 'pointer' } as const;

export function Usuarios() {
  const { sesion, usuario } = useFuenteDatos();
  const autorizado = puede(usuario?.rol, 'gestionar_usuarios');
  const [usuarios, setUsuarios] = useState<UsuarioKv[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolUsuario>('consulta');
  const [contrasena, setContrasena] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(
    () => usuariosRepositorio.listar().then((u) => { setUsuarios(u); setError(null); }).catch((e: unknown) => setError(mensajeError(e))),
    [],
  );
  useEffect(() => { if (autorizado) void cargar(); }, [autorizado, cargar]);

  if (!sesion.autenticado) {
    return (
      <>
        <h1>Usuarios</h1>
        <p className="kv-suave">Inicia sesión para administrar usuarios. <Link to="/acceso">Iniciar sesión</Link></p>
      </>
    );
  }
  if (!autorizado) {
    return (
      <>
        <h1>Usuarios</h1>
        <p role="alert" style={{ color: 'var(--kv-error)' }}>Tu rol no permite administrar usuarios. Pídeselo a un administrador.</p>
      </>
    );
  }

  const problemaContrasena = contrasena === '' ? null : validarContrasena(contrasena);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(contrasena); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin permiso del portapapeles */ }
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setCreando(true);
    setAviso(null);
    try {
      const r = await usuariosRepositorio.crear({ correo, nombre, rol, contrasena });
      setAviso({ tipo: 'ok', texto: `Usuario ${r.usuario.correo ?? ''} creado como ${etiquetaRol(r.usuario.rol)}. Entrégale la contraseña por un canal seguro: no se vuelve a mostrar.${r.auditado ? '' : ' (No quedó registrado en la auditoría.)'}` });
      setCorreo(''); setNombre(''); setContrasena(''); setRol('consulta');
      await cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeError(err) });
    } finally {
      setCreando(false);
    }
  };

  const cambiar = async (u: UsuarioKv, cambio: { rol?: RolUsuario; activo?: boolean }, confirmacion?: string) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setOcupado(u.id);
    setAviso(null);
    try {
      await usuariosRepositorio.actualizar(u.id, cambio);
      await cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeError(err) });
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <h1>Usuarios</h1>
      <p className="kv-suave">Personal de IDC con acceso a KairóVolt. Las contraseñas las guarda Supabase como hash; aquí nunca se almacenan.</p>

      {aviso && <p role={aviso.tipo === 'error' ? 'alert' : 'status'} style={{ color: aviso.tipo === 'error' ? 'var(--kv-error)' : 'var(--kv-ok)' }}>{aviso.texto}</p>}

      <h2>Nuevo usuario</h2>
      <form onSubmit={(e) => void crear(e)} style={{ background: '#fff', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)', padding: 16, maxWidth: 640 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            <label htmlFor="u-nombre">Nombre completo</label>
            <input id="u-nombre" style={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="u-correo">Correo</label>
            <input id="u-correo" type="email" style={campo} value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="off" />
          </div>
          <div>
            <label htmlFor="u-rol">Rol</label>
            <select id="u-rol" style={campo} value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)}>
              {ROLES_USUARIO.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
            </select>
            <div className="kv-suave" style={{ fontSize: 12, marginTop: 2 }}>{ROLES_USUARIO.find((r) => r.valor === rol)?.descripcion}</div>
          </div>
          <div>
            <label htmlFor="u-pass">Contraseña</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input id="u-pass" style={{ ...campo, fontFamily: 'var(--kv-mono)' }} value={contrasena} onChange={(e) => setContrasena(e.target.value)} required autoComplete="new-password" spellCheck={false} />
              <button type="button" onClick={() => setContrasena(generarContrasena(aleatorio))}>Generar</button>
              <button type="button" onClick={() => void copiar()} disabled={contrasena === ''}>{copiado ? 'Copiada' : 'Copiar'}</button>
            </div>
            <div style={{ fontSize: 12, marginTop: 2, color: problemaContrasena ? 'var(--kv-error)' : 'var(--kv-texto-suave)' }}>
              {problemaContrasena ?? 'Mínimo 12 caracteres, con letras y números.'}
            </div>
          </div>
        </div>
        <p style={{ marginBottom: 0 }}>
          <button type="submit" style={{ ...primario, opacity: creando || problemaContrasena !== null || contrasena === '' ? 0.5 : 1 }} disabled={creando || problemaContrasena !== null || contrasena === ''}>{creando ? 'Creando…' : 'Crear usuario'}</button>
        </p>
      </form>

      <h2>Usuarios registrados</h2>
      {error && <p role="alert" style={{ color: 'var(--kv-error)' }}>{error}</p>}
      {!error && !usuarios && <p>Cargando…</p>}
      {usuarios && usuarios.length === 0 && <p className="kv-suave">Todavía no hay usuarios. Crea el primero arriba (elige el rol Administrador).</p>}
      {usuarios && usuarios.length > 0 && (
        <table>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Último acceso</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre ?? '—'}<div className="kv-suave">{u.correo}</div></td>
                <td>
                  {u.tienePerfil ? (
                    <select aria-label={`Rol de ${u.correo ?? u.id}`} value={u.rol ?? 'consulta'} disabled={ocupado === u.id}
                      onChange={(e) => void cambiar(u, { rol: e.target.value as RolUsuario }, `¿Cambiar el rol de ${u.correo ?? 'este usuario'} a "${etiquetaRol(e.target.value as RolUsuario)}"?`)}>
                      {ROLES_USUARIO.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                    </select>
                  ) : <Badge tono="alerta">Sin perfil</Badge>}
                </td>
                <td>{u.activo ? <Badge tono="ok">Activo</Badge> : <Badge tono="neutro">Inactivo</Badge>}</td>
                <td className="kv-mono">{fecha(u.creadoEn)}</td>
                <td className="kv-mono">{fecha(u.ultimoAcceso)}</td>
                <td>
                  {u.tienePerfil && (
                    <button disabled={ocupado === u.id} onClick={() => void cambiar(u, { activo: !u.activo }, u.activo ? `¿Desactivar a ${u.correo ?? 'este usuario'}? Perderá todo acceso.` : undefined)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
