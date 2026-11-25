import { Link } from 'react-router-dom';
import { alertasOperativas, resumirCartera } from '@/application/cartera';
import { aVistaProyecto } from '@/application/vista-proyectos';
import { useCartera } from '@/hooks/useExpediente';
import { ProjectTable } from '@/components/feature/ProjectTable';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';

const MAX_ALERTAS = 8;

/** Dashboard operativo: primero los proyectos y lo que requiere acción hoy. Sin gráficas decorativas. */
export function Dashboard() {
  const { items, error, recargar, hoy } = useCartera();
  if (error) return <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />;
  if (!items) return <LoadingState etiqueta="Cargando panel…" />;
  if (items.length === 0) return <EmptyState titulo="No hay proyectos" descripcion="No hay proyectos con folio KV en la fuente de datos." />;

  const r = resumirCartera(items, hoy);
  const alertas = alertasOperativas(items);
  const demo = items.some((i) => i.proyecto.esMock);

  return (
    <>
      <PageHeader titulo="Panel operativo" meta={<>Interconexión CFE · {r.proyectos} proyecto(s) · al <span className="kv-mono">{hoy}</span></>} />
      {demo && <p className="kv-demo"><strong>Datos de demostración:</strong> el proyecto KV-2026-004 es un caso de prueba.</p>}

      <KPIGrid etiqueta="Resumen de la cartera">
        <KPI etiqueta="Proyectos con bloqueantes" tono={r.conBloqueantes > 0 ? 'error' : 'ok'} valor={String(r.conBloqueantes)} detalle={`${r.bloqueantesTotales} validaciones bloqueantes sin resolver`} />
        <KPI etiqueta="Observaciones vencidas" tono={r.observacionesVencidas > 0 ? 'error' : 'ok'} valor={String(r.observacionesVencidas)} detalle={`${r.observacionesAbiertas} abiertas`} />
        <KPI etiqueta="Actividades atrasadas" tono={r.actividadesAtrasadas > 0 ? 'alerta' : 'ok'} valor={String(r.actividadesAtrasadas)} />
        <KPI etiqueta="PPC acumulado" valor={r.ppc.porcentaje === null ? null : `${r.ppc.porcentaje}%`} detalle={`${r.ppc.cumplidas}/${r.ppc.planeadas} actividades a tiempo`} />
      </KPIGrid>
      {r.sinExpediente > 0 && <AlertPanel tono="info" variante="en-linea">{r.sinExpediente} proyecto(s) sin expediente en la fuente: no se pueden validar.</AlertPanel>}

      <h2>Proyectos</h2>
      <ProjectTable proyectos={items.map(aVistaProyecto)} />
      <p><Link to="/proyectos">Ver todos los proyectos</Link></p>

      <h2>Alertas operativas {alertas.length > 0 && <span className="kv-suave">({alertas.length})</span>}</h2>
      {alertas.length === 0
        ? <EmptyState compacto icono="✓" titulo="Sin alertas" descripcion="No hay validaciones bloqueantes, observaciones vencidas ni actividades atrasadas." />
        : (
          <>
            <ul className="kv-lista-alertas" aria-label="Alertas operativas">
              {alertas.slice(0, MAX_ALERTAS).map((a) => (
                <li key={a.id}>
                  <AlertPanel tono={a.severidad === 'bloqueante' ? 'error' : a.severidad === 'mayor' ? 'alerta' : 'info'} titulo={`${a.folio} · ${a.titulo}`} variante="en-linea" anunciar={false}>
                    {a.detalle} <Link to={a.to}>Atender</Link>
                  </AlertPanel>
                </li>
              ))}
            </ul>
            {alertas.length > MAX_ALERTAS && <p className="kv-suave">y {alertas.length - MAX_ALERTAS} alertas más. <Link to="/validaciones">Ver validaciones</Link></p>}
          </>
        )}
    </>
  );
}
