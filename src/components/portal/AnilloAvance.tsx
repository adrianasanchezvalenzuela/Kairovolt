export interface AnilloAvanceProps {
  /** 0–100. */
  porcentaje: number;
  etiqueta?: string;
}

const R = 70;
const CIRCUNFERENCIA = 2 * Math.PI * R;

/** Porcentaje de avance en un anillo. Un solo número grande: pensado para leerse de un vistazo en el teléfono. */
export function AnilloAvance({ porcentaje, etiqueta = 'de avance' }: AnilloAvanceProps) {
  const p = Math.max(0, Math.min(100, Math.round(porcentaje)));
  return (
    <div className="kvp-anillo" role="img" aria-label={`Avance del trámite: ${p} por ciento`}>
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle className="kvp-anillo__pista" cx="84" cy="84" r={R} />
        <circle className="kvp-anillo__valor" cx="84" cy="84" r={R} strokeDasharray={CIRCUNFERENCIA} strokeDashoffset={CIRCUNFERENCIA * (1 - p / 100)} />
      </svg>
      <div className="kvp-anillo__texto" aria-hidden="true">
        <span className="kvp-anillo__numero">{p}%</span>
        <span className="kvp-anillo__etiqueta">{etiqueta}</span>
      </div>
    </div>
  );
}
