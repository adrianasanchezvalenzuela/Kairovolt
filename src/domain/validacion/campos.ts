/** Campos que se extraen de los documentos para auditoría. */
export type CampoDato =
  | 'nivel_tension'
  | 'modelo_modulo'
  | 'consumo_kwh_mes'
  | 'coordenadas_croquis'
  | 'referencia_croquis'
  | 'modelo_inversor'
  | 'numero_paneles'
  | 'potencia_dc_kwp'
  | 'potencia_ac_kw'
  | 'configuracion_strings'
  | 'rpu'
  | 'ubicacion'
  | 'generacion_kwh_mes';

/** Cómo se comparan dos valores del mismo campo: texto (normalizado), número (con tolerancia) o coordenadas "lat,lon" (con distancia). */
export type TipoValor = 'texto' | 'numero' | 'coordenadas';

export interface DefinicionCampo {
  etiqueta: string;
  unidad?: string;
  /** true: debe coincidir en todos los documentos que lo declaran. */
  cruzado: boolean;
  tipoValor: TipoValor;
}

export const CAMPOS: Record<CampoDato, DefinicionCampo> = {
  nivel_tension: { etiqueta: 'Nivel de tensión (MT/BT)', cruzado: true, tipoValor: 'texto' },
  modelo_modulo: { etiqueta: 'Modelo de módulo FV', cruzado: true, tipoValor: 'texto' },
  consumo_kwh_mes: { etiqueta: 'Consumo', unidad: 'kWh/mes', cruzado: true, tipoValor: 'numero' },
  coordenadas_croquis: { etiqueta: 'Coordenadas del croquis', cruzado: false, tipoValor: 'texto' },
  referencia_croquis: { etiqueta: 'Referencia de ubicación del croquis', cruzado: false, tipoValor: 'texto' },
  modelo_inversor: { etiqueta: 'Modelo de inversor', cruzado: true, tipoValor: 'texto' },
  numero_paneles: { etiqueta: 'Número de paneles', cruzado: true, tipoValor: 'numero' },
  potencia_dc_kwp: { etiqueta: 'Potencia DC', unidad: 'kWp', cruzado: true, tipoValor: 'numero' },
  potencia_ac_kw: { etiqueta: 'Potencia AC', unidad: 'kW', cruzado: true, tipoValor: 'numero' },
  configuracion_strings: { etiqueta: 'Configuración de strings', cruzado: true, tipoValor: 'texto' },
  rpu: { etiqueta: 'RPU', cruzado: true, tipoValor: 'texto' },
  ubicacion: { etiqueta: 'Ubicación geográfica (lat,lon)', cruzado: true, tipoValor: 'coordenadas' },
  generacion_kwh_mes: { etiqueta: 'Generación estimada', unidad: 'kWh/mes', cruzado: true, tipoValor: 'numero' },
};

/** Dato declarado en un documento. `valor` null/'' = campo presente pero vacío. */
export interface DatoDeclarado {
  campo: CampoDato;
  valor: string | number | null;
}
