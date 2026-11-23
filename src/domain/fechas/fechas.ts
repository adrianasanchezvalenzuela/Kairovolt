/** Días de `desde` a `hasta` (fechas ISO YYYY-MM-DD). Positivo si `hasta` es posterior. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}
