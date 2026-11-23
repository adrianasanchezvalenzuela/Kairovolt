import type { Requisito } from '@/domain/checklist/checklist';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import type { Hallazgo } from '@/domain/validacion/hallazgo';
import { detectarCamposIncompletos, detectarDiscrepancias } from '@/domain/validacion/validacion-cruzada';
import { evaluarVigencias } from '@/domain/vigencias/vigencias';

export interface AuditoriaExpediente {
  hallazgos: Hallazgo[];
  bloqueantes: Hallazgo[];
  advertencias: Hallazgo[];
}

/** Caso de uso: ejecuta todas las reglas de validación sobre el expediente. `hoy` es ISO (YYYY-MM-DD). */
export function auditarExpediente(
  proyecto: Proyecto,
  requisitos: readonly Requisito[],
  hoy: string,
): AuditoriaExpediente {
  const hallazgos = [
    ...detectarDiscrepancias(proyecto.documentos),
    ...detectarCamposIncompletos(proyecto.documentos),
    ...evaluarVigencias(requisitos, proyecto.documentos, hoy),
  ];
  return {
    hallazgos,
    bloqueantes: hallazgos.filter((h) => h.severidad === 'bloqueante'),
    advertencias: hallazgos.filter((h) => h.severidad === 'advertencia'),
  };
}
