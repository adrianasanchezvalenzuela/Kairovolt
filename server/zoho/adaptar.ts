import { ORDEN_COMPUERTAS } from '../../src/domain/compuertas/compuerta';
import type { Actividad } from '../../src/domain/cronograma/actividad';
import type { Observacion } from '../../src/domain/observaciones/observacion';
import type { Proyecto } from '../../src/domain/proyecto/proyecto';
import type { ProyectoZoho } from './lectura';

/**
 * Convierte lo leído de Zoho al `Proyecto` del dominio. Lo que Zoho no guarda (sistema FV, expediente, acuerdos semanales)
 * NO se inventa: `sistema` es null, `documentos`/`acciones` van vacíos y `documentosDisponibles` es false.
 */
export function aProyectoKv(pz: ProyectoZoho, observaciones: Observacion[]): Proyecto {
  const cronograma: Actividad[] = pz.compuertas.flatMap((t) =>
    t.inicioPlan && t.finPlan
      ? [{ id: t.tareaId, nombre: t.nombre, compuerta: t.compuerta, inicioPlan: t.inicioPlan, finPlan: t.finPlan, finReal: t.finReal, responsable: null }]
      : [],
  );
  return {
    id: pz.folio,
    folio: pz.folio,
    nombre: pz.nombre,
    cliente: pz.cliente?.nombre ?? '—',
    municipio: pz.cliente?.ciudad ?? '—',
    estado: pz.cliente?.estado ?? '—',
    sistema: null,
    compuertas: ORDEN_COMPUERTAS.map((id) => ({ id, estado: pz.compuertas.find((c) => c.compuerta === id)?.estado ?? 'pendiente' })),
    documentos: [],
    documentosDisponibles: false,
    observaciones,
    cronograma,
    acciones: [],
    esMock: false,
  };
}
