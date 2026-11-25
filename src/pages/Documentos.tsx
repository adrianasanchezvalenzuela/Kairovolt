import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentosVencidos } from '@/application/analizar-proyecto';
import { useCartera } from '@/hooks/useExpediente';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

type Estado = 'Faltante' | 'Vencido' | 'Recibido';
interface Fila { clave: string; folio: string; proyecto: string; to: string; documento: string; compuerta: string; obligatorio: boolean; canal: string; estado: Estado }

/** Documentos de todos los proyectos: qué falta, qué está vencido y qué se recibió. Parte del checklist de cada proyecto. */
export function Documentos() {
  const { items, error, recargar } = useCartera();
  const [estado, setEstado] = useState<'pendientes' | 'todos'>('pendientes');
  const [compuerta, setCompuerta] = useState('todas');

  const filas = useMemo<Fila[]>(() => (items ?? []).filter((i) => i.analisis.disponible).flatMap(({ proyecto: p, analisis: a }) => {
    const vencidos = documentosVencidos(a);
    return a.checklist.flatMap((r) => r.items.map(({ requisito, documento }): Fila => ({
      clave: `${p.id}:${requisito.id}`, folio: p.folio, proyecto: p.nombre, to: `/proyectos/${encodeURIComponent(p.id)}?tab=documentos`,
      documento: requisito.nombre, compuerta: r.compuerta, obligatorio: requisito.obligatorio, canal: requisito.canal === 'fisico' ? 'Físico / firma' : 'Digital',
      estado: !documento ? 'Faltante' : vencidos.has(documento.id) ? 'Vencido' : 'Recibido',
    })));
  }), [items]);

  if (error) return <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />;
  if (!items) return <LoadingState etiqueta="Cargando documentos…" />;

  const sinExpediente = items.filter((i) => !i.analisis.disponible);
  const visibles = filas.filter((f) => (estado === 'todos' || f.estado !== 'Recibido') && (compuerta === 'todas' || f.compuerta === compuerta) && (f.obligatorio || f.estado !== 'Faltante'));
  const tono = { Faltante: 'error', Vencido: 'error', Recibido: 'ok' } as const;

  return (
    <>
      <PageHeader titulo="Documentos" meta="Estado documental de todos los proyectos, según el checklist de cada compuerta." />
      {sinExpediente.length > 0 && <p className="kv-demo">{sinExpediente.map((i) => i.proyecto.folio).join(', ')}: la fuente no trae el expediente, no aparecen aquí.</p>}
      <div className="kv-filtros">
        <div className="kv-campo"><label htmlFor="d-e">Mostrar</label><select id="d-e" value={estado} onChange={(e) => setEstado(e.target.value as 'pendientes' | 'todos')}><option value="pendientes">Faltantes y vencidos</option><option value="todos">Todos</option></select></div>
        <div className="kv-campo"><label htmlFor="d-c">Compuerta</label><select id="d-c" value={compuerta} onChange={(e) => setCompuerta(e.target.value)}><option value="todas">Todas</option>{['G0', 'G1', 'G2', 'G3'].map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        <span className="kv-suave" role="status">{visibles.length} documento(s)</span>
      </div>
      {visibles.length === 0
        ? <EmptyState compacto icono="✓" titulo="Nada pendiente" descripcion="No hay documentos faltantes ni vencidos con este filtro." />
        : (
          <div className="kv-tabla-scroll">
            <table aria-label="Documentos de todos los proyectos">
              <thead><tr><th scope="col">Proyecto</th><th scope="col">Documento</th><th scope="col">Compuerta</th><th scope="col">Canal</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.clave}>
                    <td className="kv-nowrap"><Link to={f.to} className="kv-mono">{f.folio}</Link></td>
                    <td>{f.documento}{!f.obligatorio && <span className="kv-doc__detalle">Condicional</span>}</td>
                    <td>{f.compuerta}</td>
                    <td>{f.canal}</td>
                    <td><StatusBadge tono={tono[f.estado]}>{f.estado}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
