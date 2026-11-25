import { EmptyState } from '@/components/ui/Estados';
import { Timeline } from '@/components/ui/Timeline';
import { useVistaPortal } from '@/hooks/PortalContexto';

/** Historial público: solo hechos con etiqueta fija (etapas completadas, hitos conocidos y documentos recibidos). */
export function PortalHistorial() {
  const v = useVistaPortal();
  return (
    <>
      <h1>Historial</h1>
      <p className="kv-suave">Lo que ya ocurrió en tu proyecto.</p>
      {v.historial.length === 0
        ? <EmptyState titulo="Todavía no hay historial" descripcion="Aquí aparecerán las etapas que se vayan completando." />
        : <Timeline etiqueta="Historial de tu proyecto" eventos={v.historial.map((e) => ({ id: e.id, fecha: e.fecha, titulo: e.titulo, tono: 'ok' as const, hecho: true }))} />}
    </>
  );
}
