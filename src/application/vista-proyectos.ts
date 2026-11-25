import type { ProyectoVista } from '@/components/feature/ProyectoVista';
import type { ItemCartera } from './cartera';
import { compuertaActual } from './cartera';

/** Modelo de vista de un proyecto para tarjetas y tablas. Solo traduce lo ya calculado. */
export function aVistaProyecto({ proyecto: p, analisis: a }: ItemCartera): ProyectoVista {
  const etapa = compuertaActual(p);
  return {
    id: p.id, folio: p.folio, nombre: p.nombre, cliente: p.cliente, ubicacion: `${p.municipio}, ${p.estado}`, to: `/proyectos/${encodeURIComponent(p.id)}`,
    avance: a.disponible ? { recibidos: a.progreso.recibidos, total: a.progreso.total } : null,
    observaciones: { abiertas: a.seguimiento.resumenObservaciones.abiertas, vencidas: a.seguimiento.resumenObservaciones.vencidas },
    etapa: etapa ?? 'Completo',
    bloqueantes: a.disponible ? a.pendientes.length : null,
    ...(p.esMock && { demo: true }),
  };
}
