import { catalogoParaZona, CONFIGURACION_ZONA_POR_DEFECTO, type Requisito } from '@/domain/checklist/checklist';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';

/** La política de zona real aún no está configurada: se usa el valor por defecto. */
export const catalogoRequisitos: readonly Requisito[] = catalogoParaZona(catalogoRequisitosBase, CONFIGURACION_ZONA_POR_DEFECTO);
