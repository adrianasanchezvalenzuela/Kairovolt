import type { RolUsuario } from './rol';

/**
 * Acciones protegidas. La fuente de verdad es el BACKEND (cada ruta la exige); la interfaz solo usa esto
 * para ocultar lo que el usuario no puede hacer. Ocultar un botón no es seguridad.
 */
export type Accion = 'ver_datos' | 'sincronizar_zoho' | 'descubrir_zoho' | 'gestionar_usuarios' | 'aprobar_excepciones' | 'gestionar_validaciones' | 'liberar_compuertas' | 'gestionar_portal';

/** Matriz rol → acciones. SUPUESTO por confirmar con IDC: quién puede escribir en Zoho (compuertas y observaciones). */
export const PERMISOS: Record<Accion, readonly RolUsuario[]> = {
  ver_datos: ['admin', 'coordinacion_admin', 'proyectista', 'supervisor_campo', 'consulta'],
  sincronizar_zoho: ['admin', 'coordinacion_admin', 'proyectista'],
  descubrir_zoho: ['admin'],
  gestionar_usuarios: ['admin'],
  /** Aprobar como excepción una validación que exige aprobación humana (supuesto, por confirmar con IDC). */
  aprobar_excepciones: ['admin', 'coordinacion_admin'],
  /** Registrar observaciones, asignar responsables y resolver validaciones que no exigen aprobación humana (supuesto, por confirmar con IDC). */
  gestionar_validaciones: ['admin', 'coordinacion_admin', 'proyectista'],
  /** Liberar una compuerta (G0–G3) y dejar constancia de quién la aprobó (supuesto, por confirmar con IDC). */
  liberar_compuertas: ['admin', 'coordinacion_admin'],
  /** Generar y revocar los accesos del portal del cliente (supuesto, por confirmar con IDC). */
  gestionar_portal: ['admin', 'coordinacion_admin'],
};

export const puede = (rol: RolUsuario | null | undefined, accion: Accion): boolean => rol != null && PERMISOS[accion].includes(rol);
