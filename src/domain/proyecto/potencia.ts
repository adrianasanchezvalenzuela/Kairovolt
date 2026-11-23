/** Potencia DC instalada en kWp = módulos × potencia por módulo (W) / 1000. */
export function potenciaDcKwp(numeroPaneles: number, potenciaPanelW: number): number {
  return Math.round(numeroPaneles * potenciaPanelW) / 1000;
}
