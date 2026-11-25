import type { Actividad } from '../cronograma/actividad';

/** Hitos que marcan el avance real del proceso de interconexión (base de los tiempos de proceso). */
export type TipoHito =
  | 'inicio_proyecto'
  | 'consulta_capacidad'
  | 'acopio_completo'
  | 'validacion_g2'
  | 'obra_terminada'
  | 'ingreso_cfe'
  | 'dictamen_uvie'
  | 'contrato_firmado'
  | 'interconexion';

/** Hito del proyecto: una actividad del cronograma, con su tipo cuando representa un hito conocido. */
export interface HitoProyecto extends Actividad {
  tipo: TipoHito | null;
}
