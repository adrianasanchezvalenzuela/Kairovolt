import { potenciaDcKwp } from '../proyecto/potencia';
import type { SistemaFotovoltaico } from '../proyecto/proyecto';

export interface Coordenadas {
  lat: number;
  lon: number;
}

/** Un renglón de la configuración de strings: `strings` cadenas de `panelesPorString` módulos en serie, en un MPPT. */
export interface ConfiguracionStrings {
  mppt: number | null;
  strings: number;
  panelesPorString: number;
}

/** Datos de la ficha técnica del módulo (solo los que usan las reglas). `coefTempVocPorCiento` en %/°C (negativo). */
export interface FichaPanel {
  vocV: number | null;
  coefTempVocPorCiento: number | null;
}

export interface FichaInversor {
  vdcMaxV: number | null;
}

/**
 * Configuración técnica de la instalación FV tal como la declara el proyecto. Cualquier dato desconocido es `null`:
 * nunca se rellena ni se infiere (las reglas lo reportan como "no evaluable").
 * La potencia DC NO se almacena como dato propio: se calcula (ver `potenciaDcCalculadaKwp`); `potenciaDcKwpDeclarada`
 * es lo que dicen los documentos, para compararlo con el cálculo.
 */
export interface ConfiguracionTecnica {
  nivelTension: 'MT' | 'BT' | null;
  numeroPaneles: number | null;
  potenciaPanelW: number | null;
  modeloPanel: string | null;
  numeroInversores: number | null;
  marcaInversor: string | null;
  modeloInversor: string | null;
  potenciaInversorKw: number | null;
  potenciaAcKw: number | null;
  transformadorKva: number | null;
  potenciaDcKwpDeclarada: number | null;
  strings: ConfiguracionStrings[] | null;
  rpu: string | null;
  coordenadas: Coordenadas | null;
  generacionEstimadaKwhMes: number | null;
  fichaPanel: FichaPanel | null;
  fichaInversor: FichaInversor | null;
}

/** Configuración vacía: todo desconocido. Base para construir casos parciales. */
export const configuracionVacia = (): ConfiguracionTecnica => ({
  nivelTension: null, numeroPaneles: null, potenciaPanelW: null, modeloPanel: null, numeroInversores: null, marcaInversor: null,
  modeloInversor: null, potenciaInversorKw: null, potenciaAcKw: null, transformadorKva: null, potenciaDcKwpDeclarada: null,
  strings: null, rpu: null, coordenadas: null, generacionEstimadaKwhMes: null, fichaPanel: null, fichaInversor: null,
});

/** Compatibilidad: convierte el `SistemaFotovoltaico` existente; lo que ese tipo no trae queda en null. */
export const desdeSistema = (s: SistemaFotovoltaico): ConfiguracionTecnica => ({
  ...configuracionVacia(),
  numeroPaneles: s.numeroPaneles,
  potenciaPanelW: s.potenciaPanelW,
  numeroInversores: s.numeroInversores,
  marcaInversor: s.marcaInversor,
  potenciaInversorKw: s.potenciaInversorKw,
  potenciaAcKw: s.potenciaAcKw,
  transformadorKva: s.transformadorKva,
});

/** DC = paneles × W / 1000. null si falta un dato. */
export const potenciaDcCalculadaKwp = (c: ConfiguracionTecnica): number | null =>
  c.numeroPaneles && c.potenciaPanelW ? potenciaDcKwp(c.numeroPaneles, c.potenciaPanelW) : null;

/** AC = inversores × kW por inversor. null si falta un dato. */
export const potenciaAcCalculadaKw = (c: ConfiguracionTecnica): number | null =>
  c.numeroInversores && c.potenciaInversorKw ? Math.round(c.numeroInversores * c.potenciaInversorKw * 1000) / 1000 : null;

/** Total de módulos según la configuración de strings. null si no hay strings. */
export const totalPanelesEnStrings = (c: ConfiguracionTecnica): number | null =>
  c.strings && c.strings.length > 0 ? c.strings.reduce((acc, s) => acc + s.strings * s.panelesPorString, 0) : null;
