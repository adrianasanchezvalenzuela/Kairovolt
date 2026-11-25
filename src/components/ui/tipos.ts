/** Tono semántico compartido por insignias, KPI, alertas, pasos y línea de tiempo. El color nunca es la única señal: siempre va con texto. */
export type Tono = 'neutro' | 'ok' | 'alerta' | 'error' | 'info';

export const claseTono = (t: Tono): string => `kv-tono-${t}`;
