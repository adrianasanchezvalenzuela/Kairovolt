/** Campos que se extraen de los documentos para auditoría. */
export type CampoDato =
  | 'nivel_tension'
  | 'modelo_modulo'
  | 'consumo_kwh_mes'
  | 'coordenadas_croquis'
  | 'referencia_croquis';

export interface DefinicionCampo {
  etiqueta: string;
  unidad?: string;
  /** true: debe coincidir en todos los documentos que lo declaran. */
  cruzado: boolean;
}

export const CAMPOS: Record<CampoDato, DefinicionCampo> = {
  nivel_tension: { etiqueta: 'Nivel de tensión (MT/BT)', cruzado: true },
  modelo_modulo: { etiqueta: 'Modelo de módulo FV', cruzado: true },
  consumo_kwh_mes: { etiqueta: 'Consumo', unidad: 'kWh/mes', cruzado: true },
  coordenadas_croquis: { etiqueta: 'Coordenadas del croquis', cruzado: false },
  referencia_croquis: { etiqueta: 'Referencia de ubicación del croquis', cruzado: false },
};

/** Dato declarado en un documento. `valor` null/'' = campo presente pero vacío. */
export interface DatoDeclarado {
  campo: CampoDato;
  valor: string | number | null;
}
