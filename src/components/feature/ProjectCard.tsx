import { Link } from 'react-router-dom';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ProyectoVista } from './ProyectoVista';

export interface ProjectCardProps { proyecto: ProyectoVista }

/** Tarjeta de un proyecto: toda la superficie es un único enlace (el del nombre), accesible por teclado. */
export function ProjectCard({ proyecto: p }: ProjectCardProps) {
  return (
    <article className="kv-tarjeta" aria-label={`Proyecto ${p.nombre}`}>
      <div className="kv-tarjeta__cabecera">
        <span className="kv-tarjeta__folio">{p.folio}</span>
        {p.estado && <StatusBadge tono={p.estado.tono}>{p.estado.texto}</StatusBadge>}
      </div>
      <h3 className="kv-tarjeta__titulo"><Link className="kv-tarjeta__enlace" to={p.to}>{p.nombre}</Link></h3>
      <p className="kv-tarjeta__linea">{p.cliente} · {p.ubicacion}{p.etapa ? ` · ${p.etapa}` : ''}</p>
      {p.avance
        ? <ProgressBar valor={p.avance.recibidos} total={p.avance.total} etiqueta={`Expediente de ${p.nombre}`} texto={`${p.avance.recibidos}/${p.avance.total} obligatorios`} />
        : <p className="kv-tarjeta__linea">Expediente no disponible</p>}
      <div className="kv-tarjeta__datos">
        <StatusBadge tono={p.observaciones.abiertas > 0 ? 'alerta' : 'ok'} variante="suave">{p.observaciones.abiertas} obs. abiertas</StatusBadge>
        {p.bloqueantes != null && p.bloqueantes > 0 && <StatusBadge tono="error" variante="solido">{p.bloqueantes} bloqueantes</StatusBadge>}
        {p.observaciones.vencidas > 0 && <StatusBadge tono="error" variante="suave">{p.observaciones.vencidas} vencidas</StatusBadge>}
      </div>
    </article>
  );
}
