import { normalizarCorreo, validarContrasena } from '../../src/domain/usuarios/credenciales';
import { esRolUsuario, type RolUsuario } from '../../src/domain/usuarios/rol';
import { registrarEvento, type ActorAuditoria } from './auditoria';
import { SupabaseError, type ClienteSupabase } from './cliente';

export type CodigoUsuario = 'datos_invalidos' | 'correo_duplicado' | 'contrasena_debil' | 'perfil_fallo' | 'no_encontrado' | 'auto_modificacion';

export class UsuarioError extends Error {
  constructor(readonly codigo: CodigoUsuario, message: string) {
    super(message);
    this.name = 'UsuarioError';
  }
}

export interface UsuarioKv {
  id: string;
  correo: string | null;
  nombre: string | null;
  rol: RolUsuario | null;
  activo: boolean;
  /** false = existe en Auth pero sin fila en `perfiles` (no puede entrar a nada). */
  tienePerfil: boolean;
  creadoEn: string | null;
  ultimoAcceso: string | null;
}

interface UsuarioAuth { id: string; email?: string | null; created_at?: string | null; last_sign_in_at?: string | null; user_metadata?: { full_name?: string } | null }
interface Perfil { id: string; nombre_completo: string | null; correo: string | null; rol: string; activo: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const aUsuario = (u: UsuarioAuth, p: Perfil | undefined): UsuarioKv => ({
  id: u.id,
  correo: p?.correo ?? u.email ?? null,
  nombre: p?.nombre_completo || u.user_metadata?.full_name || null,
  rol: p && esRolUsuario(p.rol) ? p.rol : null,
  activo: p?.activo === true,
  tienePerfil: p !== undefined,
  creadoEn: u.created_at ?? null,
  ultimoAcceso: u.last_sign_in_at ?? null,
});

export async function listarUsuarios(cli: ClienteSupabase): Promise<UsuarioKv[]> {
  const [auth, perfiles] = await Promise.all([
    cli.auth<{ users?: UsuarioAuth[] }>('GET', '/admin/users?per_page=200'),
    cli.rest<Perfil[]>('GET', '/perfiles?select=id,nombre_completo,correo,rol,activo'),
  ]);
  const porId = new Map((perfiles ?? []).map((p) => [p.id, p]));
  return (auth.users ?? []).map((u) => aUsuario(u, porId.get(u.id))).sort((a, b) => (a.correo ?? '').localeCompare(b.correo ?? ''));
}

export interface NuevoUsuario { correo: string; nombre: string; rol: string; contrasena: string }

/**
 * Crea el usuario en Supabase Auth (que guarda solo el hash bcrypt de la contraseña) y su perfil con rol, activo.
 * Si falla el perfil, deshace la creación en Auth para no dejar usuarios huérfanos.
 */
export async function crearUsuario(cli: ClienteSupabase, datos: NuevoUsuario, actor: ActorAuditoria): Promise<{ usuario: UsuarioKv; auditado: boolean }> {
  const correo = normalizarCorreo(datos.correo);
  const nombre = datos.nombre.trim();
  if (!correo) throw new UsuarioError('datos_invalidos', 'El correo no es válido.');
  if (nombre.length < 2 || nombre.length > 120) throw new UsuarioError('datos_invalidos', 'El nombre debe tener entre 2 y 120 caracteres.');
  if (!esRolUsuario(datos.rol)) throw new UsuarioError('datos_invalidos', 'El rol no es válido.');
  const problema = validarContrasena(datos.contrasena);
  if (problema) throw new UsuarioError('contrasena_debil', problema);

  let creado: UsuarioAuth;
  try {
    creado = await cli.auth<UsuarioAuth>('POST', '/admin/users', {
      email: correo, password: datos.contrasena, email_confirm: true, user_metadata: { full_name: nombre },
    });
  } catch (e) {
    if (e instanceof SupabaseError && (e.codigo === 'email_exists' || e.codigo === 'user_already_exists')) {
      throw new UsuarioError('correo_duplicado', 'Ya existe un usuario con ese correo.');
    }
    if (e instanceof SupabaseError && e.codigo === 'weak_password') throw new UsuarioError('contrasena_debil', 'Supabase rechazó la contraseña por débil.');
    throw e;
  }

  try {
    const [perfil] = await cli.rest<Perfil[]>(
      'POST', '/perfiles?on_conflict=id',
      { id: creado.id, nombre_completo: nombre, correo, rol: datos.rol, activo: true },
      'resolution=merge-duplicates,return=representation',
    );
    const auditado = await registrarEvento(cli, actor, { entidad: 'usuario', entidadId: creado.id, accion: 'usuario_creado', detalles: { correo, rol: datos.rol } });
    return { usuario: aUsuario(creado, perfil), auditado };
  } catch (e) {
    await cli.auth('DELETE', `/admin/users/${creado.id}`).catch(() => undefined);
    const motivo = e instanceof SupabaseError ? e.message : 'error desconocido';
    throw new UsuarioError('perfil_fallo', `No se pudo asignar el rol (${motivo}). Se canceló la creación del usuario. ¿Aplicaste el parche SQL?`);
  }
}

export interface CambioUsuario { rol?: unknown; activo?: unknown }

export async function actualizarUsuario(cli: ClienteSupabase, id: string, cambio: CambioUsuario, actor: ActorAuditoria): Promise<{ usuario: UsuarioKv; auditado: boolean }> {
  if (!UUID.test(id)) throw new UsuarioError('datos_invalidos', 'Identificador de usuario inválido.');
  const parche: { rol?: RolUsuario; activo?: boolean } = {};
  if (cambio.rol !== undefined) {
    if (!esRolUsuario(cambio.rol)) throw new UsuarioError('datos_invalidos', 'El rol no es válido.');
    parche.rol = cambio.rol;
  }
  if (cambio.activo !== undefined) {
    if (typeof cambio.activo !== 'boolean') throw new UsuarioError('datos_invalidos', 'El estado debe ser verdadero o falso.');
    parche.activo = cambio.activo;
  }
  if (Object.keys(parche).length === 0) throw new UsuarioError('datos_invalidos', 'No hay nada que cambiar.');
  // Evita quedarse sin acceso por error: nadie puede desactivarse ni quitarse el rol de administrador a sí mismo.
  if (actor.uid === id && (parche.activo === false || (parche.rol !== undefined && parche.rol !== 'admin'))) {
    throw new UsuarioError('auto_modificacion', 'No puedes desactivarte ni quitarte el rol de administrador a ti mismo. Pídeselo a otro administrador.');
  }

  const perfiles = await cli.rest<Perfil[]>('PATCH', `/perfiles?id=eq.${id}`, parche, 'return=representation');
  const perfil = perfiles?.[0];
  if (!perfil) throw new UsuarioError('no_encontrado', 'El usuario no tiene perfil. Créalo desde esta pantalla.');
  const auth = await cli.auth<UsuarioAuth>('GET', `/admin/users/${id}`);
  const auditado = await registrarEvento(cli, actor, { entidad: 'usuario', entidadId: id, accion: 'usuario_modificado', detalles: { ...parche, correo: perfil.correo } });
  return { usuario: aUsuario(auth, perfil), auditado };
}
