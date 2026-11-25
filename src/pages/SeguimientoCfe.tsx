import { Link } from 'react-router-dom';
import { useCartera } from '@/hooks/useExpediente';
import { TiemposTabla } from '@/components/feature/TiemposTabla';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

const SEGUIMIENTO = {
  cerrada: { texto: 'Cerrada', tono: 'ok' }, vencida: { texto: 'Vencida', tono: 'error' }, sin_compromiso: { texto: 'Sin fecha compromiso', tono: 'alerta' }, en_plazo: { texto: 'En plazo', tono: 'neutro' },
} as const;

/** Seguimiento de lo que depende de CFE y de la UVIE: sus observaciones y los tiempos del trámite (incluida la espera entre obra e ingreso). */
export function SeguimientoCfe() {
  const { items, error, recargar } = useCartera();
  if (error) return <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />;
  if (!items) return <LoadingState etiqueta="Cargando seguimiento…" />;

  const observaciones = items.flatMap(({ proyecto: p, analisis: a }) => a.seguimiento.observaciones.filter((x) => x.observacion.origen !== 'interna').map((x) => ({ p, ...x })));
  const abiertas = observaciones.filter((o) => o.seguimiento !== 'cerrada');
  const esperas = items.flatMap(({ proyecto: p, analisis: a }) => {
    const t = a.tiempos?.entreHitos.find((x) => x.id === 'obra_a_ingreso');
    return t && t.desde !== null && t.enCurso ? [{ p, t }] : [];
  });
  const conTiempos = items.filter((i) => i.analisis.tiempos?.entreHitos.some((t) => t.desde !== null));

  return (
    <>
      <PageHeader titulo="Seguimiento CFE" meta="Observaciones de CFE y UVIE y tiempos del trámite de interconexión." />
      <KPIGrid etiqueta="Resumen CFE y UVIE">
        <KPI etiqueta="Observaciones CFE/UVIE abiertas" tono={abiertas.length > 0 ? 'alerta' : 'ok'} valor={String(abiertas.length)} detalle={`${abiertas.filter((o) => o.seguimiento === 'vencida').length} vencidas`} />
        <KPI etiqueta="Obras esperando ingreso a CFE" tono={esperas.length > 0 ? 'alerta' : 'ok'} valor={String(esperas.length)} detalle={esperas[0] ? `${esperas[0].p.folio}: ${esperas[0].t.dias} días desde la obra terminada` : 'Ninguna'} />
      </KPIGrid>

      <h2>Observaciones de CFE y UVIE</h2>
      {observaciones.length === 0
        ? <EmptyState compacto titulo="Sin observaciones de CFE ni de UVIE" descripcion="Ningún proyecto tiene observaciones de estos orígenes (los proyectos aún no ingresan a CFE o no hay respuesta)." />
        : (
          <div className="kv-tabla-scroll">
            <table aria-label="Observaciones de CFE y UVIE">
              <thead><tr><th scope="col">Proyecto</th><th scope="col">Origen</th><th scope="col">Compuerta</th><th scope="col">Observación</th><th scope="col">Responsable</th><th scope="col">Compromiso</th><th scope="col">Seguimiento</th></tr></thead>
              <tbody>
                {observaciones.map(({ p, observacion: o, seguimiento }) => (
                  <tr key={`${p.id}:${o.id}`}>
                    <td className="kv-nowrap"><Link className="kv-mono" to={`/proyectos/${encodeURIComponent(p.id)}?tab=validaciones`}>{p.folio}</Link></td>
                    <td>{o.origen.toUpperCase()}</td><td>{o.compuerta}</td><td>{o.descripcion}</td>
                    <td>{o.responsable ?? <span className="kv-suave">Sin asignar</span>}</td>
                    <td className="kv-mono">{o.fechaCompromiso ?? '—'}</td>
                    <td><StatusBadge tono={SEGUIMIENTO[seguimiento].tono}>{SEGUIMIENTO[seguimiento].texto}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <h2>Tiempos del trámite</h2>
      {conTiempos.length === 0
        ? <EmptyState compacto titulo="Sin tiempos que medir" descripcion="Los proyectos no tienen hitos terminados que sirvan de punto de partida." />
        : conTiempos.map(({ proyecto: p, analisis: a }) => (
          <section key={p.id} aria-label={`Tiempos de ${p.folio}`} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px' }}><Link className="kv-mono" to={`/proyectos/${encodeURIComponent(p.id)}?tab=cronograma`}>{p.folio}</Link> <span className="kv-suave">{a.tiempos!.diasSinMovimiento != null && `${a.tiempos!.diasSinMovimiento} días desde el último hito terminado`}</span></h3>
            <TiemposTabla tiempos={a.tiempos!.entreHitos} etiqueta={`Tiempos de ${p.folio}`} />
          </section>
        ))}
    </>
  );
}
