import type { RolUsuario } from '@/domain/usuarios/rol';

export interface UsuarioKv {
  id: string;
  correo: string | null;
  nombre: string | null;
  rol: RolUsuario | null;
  activo: boolean;
  /** false = existe en Auth pero sin perfil: no puede entrar a nada. */
  tienePerfil: boolean;
  creadoEn: string | null;
  ultimoAcceso: string | null;
}

export interface NuevoUsuario {
  correo: string;
  nombre: string;
  rol: RolUsuario;
  /** Se envía una sola vez; Supabase guarda solo su hash. */
  contrasena: string;
}

export interface CambioUsuario {
  rol?: RolUsuario;
  activo?: boolean;
}

export interface ResultadoUsuario {
  usuario: UsuarioKv;
  /** false = la operación se hizo pero no quedó registrada en la auditoría. */
  auditado: boolean;
}

/** Error legible para el usuario (el backend no incluye secretos en sus mensajes). */
export class ErrorUsuarios extends Error {}

export interface UsuariosRepositorio {
  listar(): Promise<UsuarioKv[]>;
  crear(nuevo: NuevoUsuario): Promise<ResultadoUsuario>;
  actualizar(id: string, cambio: CambioUsuario): Promise<ResultadoUsuario>;
}
