import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartera } from '@/hooks/useExpediente';
import { ValidationCard } from '@/components/feature/ValidationCard';
import { aValidacionVistaResultado } from '@/components/feature/validacion-vista';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ORDEN_SEVERIDAD, type Severidad } from '@/domain/reglas/tipos';

/** Validaciones que no cumplen en todos los proyectos. Las decisiones se toman dentro de cada proyecto. */
export function Validaciones() {
  const { items, error, recargar } = useCartera();
  const [severidad, setSeveridad] = useState<'todas' | Severidad>('todas');
  const [soloPendientes, setSoloPendientes] = useState(true);

  const filas = useMemo(() => (items ?? []).flatMap(({ proyecto: p, analisis: a }) => {
    const ids = new Set(p.documentos.map((d) => d.id));
    const pendientes = new Set(a.pendientes.map((x) => x.huella));
    return a.resultados.filter((r) => r.resultado === 'no_cumple').map((r) => ({ p, r, ids, pendiente: pendientes.has(r.huella), excepcion: a.excepciones.has(r.huella), obs: a.vinculos.get(r.huella) }));
  }).sort((x, y) => ORDEN_SEVERIDAD[x.r.severidad] - ORDEN_SEVERIDAD[y.r.severidad] || x.p.folio.localeCompare(y.p.folio)), [items]);

  if (error) return <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />;
  if (!items) return <LoadingState etiqueta="Cargando validaciones…" />;

  const visibles = filas.filter((f) => (severidad === 'todas' || f.r.severidad === severidad) && (!soloPendientes || f.pendiente || f.r.severidad !== 'bloqueante'));
  const bloqueantes = filas.filter((f) => f.pendiente).length;

  return (
    <>
      <PageHeader titulo="Validaciones" meta="Resultados del motor de reglas en todos los proyectos. El sistema reporta; las decisiones las toma una persona en cada proyecto." />
      <p className="kv-suave">ReadyCheck evalúa la preparación interna del expediente. CFE determina la aceptación del trámite.</p>
      <KPIGrid etiqueta="Resumen">
        <KPI etiqueta="Bloqueantes sin resolver" tono={bloqueantes > 0 ? 'error' : 'ok'} valor={String(bloqueantes)} />
        <KPI etiqueta="No cumplen" tono="alerta" valor={String(filas.length)} />
        <KPI etiqueta="Con observación asignada" tono="info" valor={String(filas.filter((f) => f.obs && f.obs.estado !== 'cerrada').length)} />
      </KPIGrid>
      <div className="kv-filtros" style={{ marginTop: 16 }}>
        <div className="kv-campo">
          <label htmlFor="v-s">Severidad</label>
          <select id="v-s" value={severidad} onChange={(e) => setSeveridad(e.target.value as 'todas' | Severidad)}>
            <option value="todas">Todas</option>
            {(Object.keys(ORDEN_SEVERIDAD) as Severidad[]).map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <label><input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Ocultar bloqueantes ya resueltos o con excepción</label>
        <span className="kv-suave" role="status">{visibles.length} resultado(s)</span>
      </div>
      {visibles.length === 0
        ? <EmptyState icono="✓" titulo="Sin validaciones pendientes" descripcion="No hay resultados que no cumplan con este filtro." />
        : (
          <ul className="kv-lista-alertas" aria-label="Validaciones que no cumplen">
            {visibles.map(({ p, r, ids, pendiente, excepcion, obs }) => (
              <li key={`${p.id}:${r.huella}`}>
                <p style={{ margin: '0 0 4px' }}>
                  <Link className="kv-mono" to={`/proyectos/${encodeURIComponent(p.id)}?tab=validaciones&huella=${encodeURIComponent(r.huella)}`}>{p.folio}</Link>{' '}
                  <span className="kv-suave">{p.nombre}</span>
                </p>
                <ValidationCard
                  validacion={aValidacionVistaResultado(r, ids)}
                  seguimiento={<>
                    {pendiente && <StatusBadge tono="error" variante="suave">Sin resolver</StatusBadge>}
                    {excepcion && <StatusBadge tono="alerta" variante="suave">Excepción aprobada</StatusBadge>}
                    {obs && obs.estado !== 'cerrada' && <StatusBadge tono="info" variante="suave">{obs.responsable ?? 'Sin responsable'}</StatusBadge>}
                  </>}
                />
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
