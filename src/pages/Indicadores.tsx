import { Link } from 'react-router-dom';
import { resumirCartera } from '@/application/cartera';
import { cumpleMetaPaer, META_PAER_PORCENTAJE } from '@/domain/indicadores/paer';
import { useCartera } from '@/hooks/useExpediente';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

const pct = (v: number | null) => (v === null ? null : `${v}%`);

/** PPC y PAER por proyecto y de toda la cartera. Un periodo sin datos se muestra «—», nunca 0 %. */
export function Indicadores() {
  const { items, error, recargar, hoy } = useCartera();
  if (error) return <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />;
  if (!items) return <LoadingState etiqueta="Calculando indicadores…" />;
  if (items.length === 0) return <EmptyState titulo="No hay proyectos" descripcion="Sin proyectos no hay indicadores que calcular." />;

  const r = resumirCartera(items, hoy);
  const meta = cumpleMetaPaer(r.paer);

  return (
    <>
      <PageHeader titulo="Indicadores" meta={<>PPC (plan cumplido) y PAER (acciones efectivamente realizadas). Meta PAER: mayor a {META_PAER_PORCENTAJE}%.</>} />
      <KPIGrid etiqueta="Indicadores de la cartera">
        <KPI etiqueta="PPC acumulado" valor={pct(r.ppc.porcentaje)} detalle={`${r.ppc.cumplidas} de ${r.ppc.planeadas} actividades terminadas a tiempo`} />
        <KPI etiqueta="PAER acumulado" tono={meta === false ? 'alerta' : 'ok'} valor={pct(r.paer.porcentaje)} detalle={`${r.paer.completadas} de ${r.paer.total} acciones · ${meta === null ? 'sin acciones' : meta ? 'cumple la meta' : 'no cumple la meta'}`} />
        <KPI etiqueta="Actividades atrasadas" tono={r.actividadesAtrasadas > 0 ? 'alerta' : 'ok'} valor={String(r.actividadesAtrasadas)} />
      </KPIGrid>

      <h2>Por proyecto</h2>
      <div className="kv-tabla-scroll">
        <table aria-label="Indicadores por proyecto">
          <thead><tr><th scope="col">Proyecto</th><th scope="col">PPC</th><th scope="col">PAER (última sesión)</th><th scope="col">PAER acumulado</th><th scope="col">Atrasadas</th><th scope="col">Sin movimiento</th></tr></thead>
          <tbody>
            {items.map(({ proyecto: p, analisis: a }) => {
              const ultima = a.seguimiento.paerSemanal.at(-1);
              const acumulado = a.seguimiento.paerSemanal.reduce((s, x) => ({ t: s.t + x.resultado.total, c: s.c + x.resultado.completadas }), { t: 0, c: 0 });
              const atrasadas = a.seguimiento.actividades.filter((e) => e.estado === 'atrasada').length;
              return (
                <tr key={p.id}>
                  <td><Link className="kv-mono" to={`/proyectos/${encodeURIComponent(p.id)}?tab=cronograma`}>{p.folio}</Link></td>
                  <td>{pct(a.seguimiento.ppc.porcentaje) ?? <span className="kv-suave">—</span>} <span className="kv-suave">({a.seguimiento.ppc.cumplidas}/{a.seguimiento.ppc.planeadas})</span></td>
                  <td>{ultima ? <>{pct(ultima.resultado.porcentaje) ?? '—'} {cumpleMetaPaer(ultima.resultado) === false && <StatusBadge tono="alerta" variante="suave">Bajo la meta</StatusBadge>}{cumpleMetaPaer(ultima.resultado) === true && <StatusBadge tono="ok" variante="suave">Cumple</StatusBadge>}</> : <span className="kv-suave">Sin acciones</span>}</td>
                  <td>{acumulado.t === 0 ? <span className="kv-suave">—</span> : `${Math.round((acumulado.c / acumulado.t) * 1000) / 10}% (${acumulado.c}/${acumulado.t})`}</td>
                  <td>{atrasadas > 0 ? <StatusBadge tono="error" variante="suave">{atrasadas}</StatusBadge> : 0}</td>
                  <td>{a.tiempos?.diasSinMovimiento == null ? <span className="kv-suave">—</span> : `${a.tiempos.diasSinMovimiento} d`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
