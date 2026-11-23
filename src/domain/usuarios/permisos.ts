import type { RolUsuario } from './rol';

/**
 * Acciones protegidas. La fuente de verdad es el BACKEND (cada ruta la exige); la interfaz solo usa esto
 * para ocultar lo que el usuario no puede hacer. Ocultar un botón no es seguridad.
 */
export type Accion = 'ver_datos' | 'sincronizar_zoho' | 'descubrir_zoho' | 'gestionar_usuarios';

/** Matriz rol → acciones. SUPUESTO por confirmar con IDC: quién puede escribir en Zoho (compuertas y observaciones). */
export const PERMISOS: Record<Accion, readonly RolUsuario[]> = {
  ver_datos: ['admin', 'coordinacion_admin', 'proyectista', 'supervisor_campo', 'consulta'],
  sincronizar_zoho: ['admin', 'coordinacion_admin', 'proyectista'],
  descubrir_zoho: ['admin'],
  gestionar_usuarios: ['admin'],
};

export const puede = (rol: RolUsuario | null | undefined, accion: Accion): boolean => rol != null && PERMISOS[accion].includes(rol);
