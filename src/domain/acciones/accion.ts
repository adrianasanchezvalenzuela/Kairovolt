export type EstadoAccion = 'completada' | 'pendiente' | 'no_realizada';

/**
 * Acción o compromiso acordado en el Sprint de Energización (lunes 8:30–9:00).
 * `semana` = fecha ISO (YYYY-MM-DD) de la sesión semanal en que se acordó; es el corte del PAER.
 */
export interface AccionAcordada {
  id: string;
  semana: string;
  descripcion: string;
  responsable: string | null;
  estado: EstadoAccion;
}
