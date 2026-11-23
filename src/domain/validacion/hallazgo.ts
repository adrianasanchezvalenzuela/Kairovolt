export type SeveridadHallazgo = 'bloqueante' | 'advertencia';
export type CategoriaHallazgo = 'discrepancia' | 'campo_incompleto' | 'vigencia';

export type SubtipoHallazgo = 'vencido' | 'por_vencer' | 'sin_fecha' | 'incoherente';

export interface Evidencia {
  documentoId: string;
  documentoNombre: string;
  /** Valor tal como aparece en el documento; null = vacío. */
  valor: string | null;
}

/**
 * Resultado de una regla de validación. El sistema reporta; nunca decide cuál versión es la correcta.
 */
export interface Hallazgo {
  id: string;
  categoria: CategoriaHallazgo;
  /** Detalle de la categoría, cuando aplica (hoy: vigencias). */
  subtipo?: SubtipoHallazgo;
  severidad: SeveridadHallazgo;
  titulo: string;
  detalle: string;
  evidencias: Evidencia[];
}
