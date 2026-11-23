import type { Compuerta } from '../compuertas/compuerta';
import type { DocumentoExpediente } from '../documentos/documento';
import type { Observacion } from '../observaciones/observacion';
import type { AccionAcordada } from '../acciones/accion';
import type { Actividad } from '../cronograma/actividad';

export interface SistemaFotovoltaico {
  numeroPaneles: number;
  potenciaPanelW: number;
  potenciaAcKw: number;
  numeroInversores: number;
  marcaInversor: string;
  potenciaInversorKw: number;
  transformadorKva: number;
}

export interface Proyecto {
  id: string;
  /** Folio único KV para el portal de clientes. */
  folio: string;
  nombre: string;
  cliente: string;
  municipio: string;
  estado: string;
  /** null cuando la fuente (p. ej. Zoho) no tiene los datos técnicos del sistema. */
  sistema: SistemaFotovoltaico | null;
  compuertas: Compuerta[];
  documentos: DocumentoExpediente[];
  /** false = la fuente no trae el expediente: no se puede evaluar checklist, hallazgos ni carpeta física. */
  documentosDisponibles: boolean;
  observaciones: Observacion[];
  cronograma: Actividad[];
  /** Acuerdos del Sprint de Energización semanal (base del PAER). */
  acciones: AccionAcordada[];
  /** Marca explícita de datos no reales. */
  esMock: boolean;
}
