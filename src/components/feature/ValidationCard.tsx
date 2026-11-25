import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cx } from '@/components/ui/cx';
import { claseTono, type Tono } from '@/components/ui/tipos';

export type ResultadoVista = 'cumple' | 'no_cumple' | 'no_evaluable';
export type SeveridadVista = 'bloqueante' | 'mayor' | 'menor' | 'informativa';

export interface EvidenciaVista {
  /** Id del documento si se puede abrir su evidencia. */
  documentoId?: string;
  documento: string;
  /** `null` = el documento no declara el dato. */
  valor: string | null;
  campo?: string;
}

/** Modelo de vista de un resultado de validación. Espeja `ResultadoValidacion` sin depender del dominio. */
export interface ValidacionVista {
  id: string;
  titulo: string;
  resultado: ResultadoVista;
  severidad: SeveridadVista;
  /** Sustituye el texto estándar de la severidad (p. ej. «Advertencia»). */
  etiquetaSeveridad?: string;
  categoria?: string;
  reglaId?: string;
  explicacion?: string;
  esperado?: string | null;
  encontrado?: string | null;
  evidencias?: readonly EvidenciaVista[];
  accionRecomendada?: string;
  requiereAprobacionHumana?: boolean;
}

export const ETIQUETA_SEVERIDAD: Record<SeveridadVista, string> = { bloqueante: 'Bloqueante', mayor: 'Mayor', menor: 'Menor', informativa: 'Informativa' };
export const TONO_SEVERIDAD: Record<SeveridadVista, Tono> = { bloqueante: 'error', mayor: 'alerta', menor: 'info', informativa: 'neutro' };
const ETIQUETA_RESULTADO: Record<ResultadoVista, string> = { cumple: 'Cumple', no_cumple: 'No cumple', no_evaluable: 'No evaluable' };

export interface ValidationCardProps {
  validacion: ValidacionVista;
  /** Abre el detalle al inicio (por defecto solo los bloqueantes que no cumplen). */
  abierta?: boolean;
  /** Acciones al final del detalle (p. ej. «Registrar decisión»). Las decisiones las toma una persona. */
  acciones?: ReactNode;
  /** Insignias de seguimiento junto al título (observación abierta, excepción aprobada…). */
  seguimiento?: ReactNode;
  /** Si se da, cada documento de la evidencia con id muestra «Abrir». */
  onAbrirEvidencia?: (documentoId: string) => void;
}

/** Un hallazgo o resultado de regla, con la evidencia a la vista. Nunca decide cuál documento es el correcto. */
export function ValidationCard({ validacion: v, abierta, acciones, seguimiento, onAbrirEvidencia }: ValidationCardProps) {
  const tono: Tono = v.resultado === 'cumple' ? 'ok' : v.resultado === 'no_evaluable' ? 'neutro' : TONO_SEVERIDAD[v.severidad];
  const abierto = abierta ?? (v.resultado === 'no_cumple' && v.severidad === 'bloqueante');
  const hayComparacion = v.esperado != null || v.encontrado != null;
  return (
    <details className={cx('kv-validacion', claseTono(tono))} open={abierto}>
      <summary className="kv-validacion__resumen">
        <span className="kv-validacion__titulo">{v.titulo}</span>
        <span className="kv-validacion__badges">
          {v.resultado !== 'no_cumple' && <StatusBadge tono={v.resultado === 'cumple' ? 'ok' : 'neutro'}>{ETIQUETA_RESULTADO[v.resultado]}</StatusBadge>}
          {v.resultado !== 'cumple' && <StatusBadge tono={TONO_SEVERIDAD[v.severidad]} variante={v.severidad === 'bloqueante' ? 'solido' : 'contorno'}>{v.etiquetaSeveridad ?? ETIQUETA_SEVERIDAD[v.severidad]}</StatusBadge>}
          {v.categoria && <StatusBadge>{v.categoria}</StatusBadge>}
          {seguimiento}
        </span>
      </summary>
      <div className="kv-validacion__detalle">
        {v.explicacion && <p>{v.explicacion}</p>}
        {hayComparacion && (
          <p>
            <span className="kv-validacion__etiqueta">Esperado / encontrado</span>
            <span className="kv-mono">{v.esperado ?? '—'}</span> / <span className="kv-mono">{v.encontrado ?? '—'}</span>
          </p>
        )}
        {v.evidencias && v.evidencias.length > 0 && (
          <>
            <span className="kv-validacion__etiqueta">Lo que declara cada documento</span>
            <table className="kv-validacion__comparacion">
              <thead><tr><th scope="col">Documento</th><th scope="col">Valor</th>{onAbrirEvidencia && <th scope="col"><span className="kv-solo-lectores">Evidencia</span></th>}</tr></thead>
              <tbody>
                {v.evidencias.map((e, i) => (
                  <tr key={`${i}-${e.documento}`}>
                    <td>{e.documento}{e.campo && <span className="kv-doc__detalle">{e.campo}</span>}</td>
                    <td className="kv-mono">{e.valor ?? <span className="kv-suave">no declarado</span>}</td>
                    {onAbrirEvidencia && <td>{e.documentoId && <button type="button" className="kv-btn kv-btn--secundario kv-btn--sm" onClick={() => onAbrirEvidencia(e.documentoId!)}>Abrir evidencia<span className="kv-solo-lectores"> de {e.documento}</span></button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {v.accionRecomendada && <p><span className="kv-validacion__etiqueta">Acción recomendada</span>{v.accionRecomendada}</p>}
        {v.requiereAprobacionHumana && <p className="kv-validacion__aprobacion">Requiere decisión de una persona: el sistema no corrige ni elige la versión correcta.</p>}
        {v.reglaId && <p className="kv-suave" style={{ fontSize: 12 }}>Regla <span className="kv-mono">{v.reglaId}</span></p>}
        {acciones}
      </div>
    </details>
  );
}
