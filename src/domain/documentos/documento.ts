import type { DatoDeclarado } from '../validacion/campos';

export type TipoDocumento =
  // G0
  | 'consulta_capacidad_mt'
  | 'recibo_cfe'
  | 'datos_preliminares'
  // G1 (cliente)
  | 'identificacion_oficial'
  | 'constancia_situacion_fiscal'
  | 'carta_poder'
  | 'acta_constitutiva'
  // G1 (ingeniería)
  | 'croquis'
  | 'diagrama_unifilar'
  | 'memoria_calculo'
  | 'ficha_tecnica'
  | 'certificado'
  // G2
  | 'solicitud'
  | 'evidencia_fotografica'
  | 'checklist_consistencia'
  // G3
  | 'dictamen_uvie'
  | 'certificado_uiie'
  | 'oficio_resolutivo'
  | 'contrato_interconexion'
  | 'contrato_contraprestacion'
  | 'medidor_bidireccional';

/**
 * Documento recibido en el expediente (su existencia = recibido).
 * Fechas ISO (YYYY-MM-DD). `null` = no capturada; nunca se asume.
 * `fechaVigencia` es la fecha de vencimiento declarada en el documento.
 * A qué compuerta pertenece lo define el catálogo de requisitos, no el documento.
 */
export interface DocumentoExpediente {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  fechaEmision: string | null;
  fechaVigencia: string | null;
  datos: readonly DatoDeclarado[];
}
