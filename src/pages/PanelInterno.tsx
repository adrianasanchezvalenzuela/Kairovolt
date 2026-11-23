import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { evaluarChecklist, progresoGlobal } from '@/domain/checklist/checklist';
import { resumirObservaciones } from '@/domain/observaciones/observacion';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { catalogoRequisitos } from '@/infrastructure';

export function PanelInterno() {
  const { repositorio, fuente } = useFuenteDatos();
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProyectos(null);
    setError(null);
    repositorio.listar().then(setProyectos).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error desconocido'));
  }, [repositorio]);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <h1>Proyectos</h1>
      <p className="kv-suave">Interconexión CFE · generación distribuida fotovoltaica · {fuente === 'zoho' ? 'datos de Zoho' : 'datos de prueba'}</p>
      {error && <p role="alert" style={{ color: 'var(--kv-error)' }}>No se pudieron cargar los proyectos: {error}</p>}
      {!error && !proyectos && <p>Cargando…</p>}
      {proyectos && proyectos.length === 0 && <p className="kv-suave">No hay proyectos con folio KV en la fuente de datos.</p>}
      {proyectos && proyectos.length > 0 && (
        <table>
          <thead><tr><th>Folio KV</th><th>Proyecto</th><th>Cliente</th><th>Ubicación</th><th>Expediente</th><th>Obs. abiertas</th></tr></thead>
          <tbody>
            {proyectos.map((p) => {
              const prog = progresoGlobal(evaluarChecklist(catalogoRequisitos, p.documentos));
              const obs = resumirObservaciones(p.observaciones, hoy);
              return (
                <tr key={p.id}>
                  <td className="kv-mono">{p.folio}</td>
                  <td><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link></td>
                  <td>{p.cliente}</td>
                  <td>{p.municipio}, {p.estado}</td>
                  <td>{p.documentosDisponibles ? `${prog.recibidos}/${prog.total} obligatorios` : <span className="kv-suave">No disponible</span>}</td>
                  <td>{obs.abiertas}{obs.vencidas > 0 && ` (${obs.vencidas} vencidas)`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
