export type RolUsuario = 'admin' | 'coordinacion_admin' | 'proyectista' | 'supervisor_campo' | 'consulta';

/** Roles del personal de IDC (coinciden con el CHECK de `perfiles.rol` en Supabase). */
export const ROLES_USUARIO: readonly { valor: RolUsuario; etiqueta: string; descripcion: string }[] = [
  { valor: 'admin', etiqueta: 'Administrador', descripcion: 'Usuarios, permisos y todo el expediente.' },
  { valor: 'coordinacion_admin', etiqueta: 'Coordinación administrativa', descripcion: 'Gestión documental, catálogo, acuerdos PAER y auditoría.' },
  { valor: 'proyectista', etiqueta: 'Proyectista', descripcion: 'Documentación técnica, datos FV y resoluciones técnicas.' },
  { valor: 'supervisor_campo', etiqueta: 'Supervisor de campo', descripcion: 'Consulta y carga de evidencia de instalación.' },
  { valor: 'consulta', etiqueta: 'Consulta', descripcion: 'Solo lectura.' },
];

export const esRolUsuario = (v: unknown): v is RolUsuario => ROLES_USUARIO.some((r) => r.valor === v);
