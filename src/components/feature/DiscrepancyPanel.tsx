import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/Estados';
import { TONO_SEVERIDAD, ValidationCard, type SeveridadVista, type ValidacionVista } from './ValidationCard';

const ORDEN: readonly SeveridadVista[] = ['bloqueante', 'mayor', 'menor', 'informativa'];

export interface DiscrepancyPanelProps {
  validaciones: readonly ValidacionVista[];
  etiqueta?: string;
  /** Texto cuando no hay nada que mostrar. */
  textoVacio?: string;
  /** Incluye también los resultados que cumplen (por defecto solo lo que requiere atención). */
  incluirCumplidas?: boolean;
  /** Reemplaza los nombres [singular, plural] del resumen (p. ej. mayor → «advertencia», «advertencias»). */
  nombresSeveridad?: Partial<Record<SeveridadVista, readonly [string, string]>>;
}

const NOMBRES: Record<SeveridadVista, readonly [string, string]> = {
  bloqueante: ['bloqueante', 'bloqueantes'], mayor: ['mayor', 'mayores'], menor: ['menor', 'menores'], informativa: ['informativa', 'informativas'],
};

/** Hallazgos agrupados por severidad: primero lo que bloquea. Cada uno se muestra como `ValidationCard`. */
export function DiscrepancyPanel({ validaciones, etiqueta = 'Hallazgos de validación', textoVacio = 'Sin hallazgos: los documentos son consistentes entre sí.', incluirCumplidas = false, nombresSeveridad }: DiscrepancyPanelProps) {
  const visibles = validaciones.filter((v) => incluirCumplidas || v.resultado !== 'cumple');
  if (visibles.length === 0) return <EmptyState compacto icono="✓" titulo="Sin hallazgos" descripcion={textoVacio} />;

  const ordenadas = [...visibles].sort((a, b) => ORDEN.indexOf(a.severidad) - ORDEN.indexOf(b.severidad));
  return (
    <section aria-label={etiqueta}>
      <p className="kv-panel-disc__resumen">
        {ORDEN.map((s) => {
          const n = visibles.filter((v) => v.severidad === s).length;
          const [uno, varios] = nombresSeveridad?.[s] ?? NOMBRES[s];
          return n > 0 ? <StatusBadge key={s} tono={TONO_SEVERIDAD[s]} variante="suave" tamano="md">{n} {n === 1 ? uno : varios}</StatusBadge> : null;
        })}
      </p>
      <ul className="kv-panel-disc__lista">
        {ordenadas.map((v) => <li key={v.id}><ValidationCard validacion={v} /></li>)}
      </ul>
    </section>
  );
}
