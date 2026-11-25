import type { EventoHistorial } from '@/application/historial';
import { EmptyState } from '@/components/ui/Estados';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';

/** Historial del proyecto: lo ocurrido en la fuente y lo decidido en KairóVolt, con quién y cuándo. */
export function HistorialProyecto({ eventos }: { eventos: readonly EventoHistorial[] }) {
  if (eventos.length === 0) return <EmptyState titulo="Sin historial" descripcion="Todavía no hay actividades terminadas ni decisiones registradas." />;
  return (
    <Timeline
      etiqueta="Historial del proyecto"
      eventos={eventos.map((e) => ({
        id: e.id, fecha: e.fecha.slice(0, 16).replace('T', ' '), titulo: e.titulo, tono: e.tono, hecho: true,
        descripcion: [e.detalle, e.actor ? `Por ${e.actor}` : null].filter(Boolean).join(' — ') || undefined,
        estado: e.tipo === 'decision' || e.tipo === 'compuerta' ? <StatusBadge tono="info" variante="suave"> en KairóVolt</StatusBadge> : undefined,
      }))}
    />
  );
}
