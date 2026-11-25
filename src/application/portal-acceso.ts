import type { Recepcion, VistaPortal } from './portal-cliente';

export interface EstadoPortal {
  disponible: boolean;
  /** true = datos de demostración y todo en memoria. */
  demo: boolean;
  persistencia: { accesos: 'supabase' | 'memoria'; archivos: 'supabase' | 'no_se_guardan' };
  /** Solo en modo demo: código de ejemplo. */
  codigoDemo?: string;
}

export type VistaPortalConEstado = VistaPortal & { persistencia: EstadoPortal['persistencia'] };

export type CodigoErrorPortal =
  | 'acceso_invalido' | 'demasiados_intentos' | 'sin_sesion' | 'sin_permiso' | 'no_disponible' | 'proyecto_no_disponible'
  | 'documento_no_solicitado' | 'documento_no_admite_envio' | 'tipo_no_permitido' | 'tipo_no_coincide' | 'vacio' | 'demasiado_grande'
  | 'no_se_pudo_guardar' | 'sin_conexion' | 'desconocido';

/** Error con un mensaje ya redactado para el cliente. */
export class ErrorPortal extends Error {
  constructor(readonly codigo: CodigoErrorPortal, mensaje: string) {
    super(mensaje);
  }
}

export interface ResultadoSubida {
  recepcion: Recepcion;
  /** false = demo: el archivo se registró pero no se conserva. */
  archivosGuardados: boolean;
}

/** Puerto del portal: la interfaz depende de esto. Toda la protección está en el backend; aquí no se decide nada de seguridad. */
export interface PortalRepositorio {
  estado(): Promise<EstadoPortal>;
  /** Canjea folio + código por una sesión (cookie HttpOnly). */
  acceder(folio: string, codigo: string): Promise<void>;
  cerrar(): Promise<void>;
  vista(): Promise<VistaPortalConEstado>;
  subir(documentoId: string, archivo: File, onProgreso?: (porcentaje: number) => void): Promise<ResultadoSubida>;
}
