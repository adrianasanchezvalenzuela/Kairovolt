import { useMemo, useState } from 'react';
import { useCartera } from '@/hooks/useExpediente';
import { CronogramaTable } from '@/components/feature/CronogramaTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Actividad, ActividadEvaluada, EstadoActividad } from '@/domain/cronograma/actividad';

const ORDEN: Record<EstadoActividad, number> = { atrasada: 0, en_curso: 1, pendiente: 2, completada: 3 };

/** Cronograma de todos los proyectos: primero lo atrasado, luego lo que está en curso. */
export function Cronograma() {
  const { items, error, recargar } = useCartera();
  const [estado, setEstado] = useState<'abiertas' | 'todas'>('abiertas');

  const { filas, proyectoDe } = useMemo(() => {
    const dueno = new Map<Actividad, { folio: string; to: string }>();
    const lista: ActividadEvaluada[] = [];
    for (const { proyecto: p, analisis: a } of items ?? []) {
      for (const e of a.seguimiento.actividades) {
        dueno.set(e.actividad, { folio: p.folio, to: `/proyectos/${encodeURIComponent(p.id)}?tab=cronograma` });
        lista.push(e);
      }
    }
    lista.sort((x, y) => ORDEN[x.estado] - ORDEN[y.estado] || x.actividad.finPlan.localeCompare(y.actividad.finPlan));
    return { filas: lista, proyectoDe: (a: Actividad) => dueno.get(a) };
  }, [items]);

  if (error) return <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />;
  if (!items) return <LoadingState etiqueta="Cargando cronograma…" />;

  const visibles = estado === 'todas' ? filas : filas.filter((f) => f.estado !== 'completada');
  const cuenta = (e: EstadoActividad) => filas.filter((f) => f.estado === e).length;

  return (
    <>
      <PageHeader titulo="Cronograma" meta="Actividades de todos los proyectos contra su fecha planeada." />
      <KPIGrid etiqueta="Estado de las actividades">
        <KPI etiqueta="Atrasadas" tono={cuenta('atrasada') > 0 ? 'error' : 'ok'} valor={String(cuenta('atrasada'))} />
        <KPI etiqueta="En curso" tono="alerta" valor={String(cuenta('en_curso'))} />
        <KPI etiqueta="Pendientes" tono="neutro" valor={String(cuenta('pendiente'))} />
        <KPI etiqueta="Completadas" tono="ok" valor={String(cuenta('completada'))} />
      </KPIGrid>
      <div className="kv-filtros" style={{ marginTop: 16 }}>
        <div className="kv-campo"><label htmlFor="c-e">Mostrar</label><select id="c-e" value={estado} onChange={(e) => setEstado(e.target.value as 'abiertas' | 'todas')}><option value="abiertas">Sin completar</option><option value="todas">Todas</option></select></div>
      </div>
      {visibles.length === 0
        ? <EmptyState compacto titulo="Sin actividades" descripcion="No hay actividades con este filtro." />
        : <CronogramaTable actividades={visibles} proyectoDe={proyectoDe} />}
    </>
  );
}
