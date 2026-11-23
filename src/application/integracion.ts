/** Estado verificable de la integración con Zoho; `backend_no_disponible` = no se pudo preguntar al servidor. */
export type EstadoZohoUi = 'no_configurado' | 'conectado' | 'error' | 'backend_no_disponible';

export interface EstadoIntegracion {
  zoho: EstadoZohoUi;
  detalle: string;
}

export interface IntegracionRepositorio {
  consultarEstado(): Promise<EstadoIntegracion>;
}

/** `adminHabilitado` = el backend tiene ADMIN_TOKEN y por tanto permite iniciar sesión. */
export interface EstadoSesion {
  adminHabilitado: boolean;
  autenticado: boolean;
}

export type ResultadoInicioSesion = 'ok' | 'token_invalido' | 'demasiados_intentos' | 'deshabilitado' | 'error';

export interface SesionRepositorio {
  consultar(): Promise<EstadoSesion>;
  iniciar(token: string): Promise<ResultadoInicioSesion>;
  cerrar(): Promise<void>;
}

export type FuenteDatos = 'zoho' | 'mock';
export type MotivoMock = 'sin_credenciales' | 'requiere_login' | 'login_deshabilitado' | 'backend_no_disponible' | 'error_zoho';

export interface EleccionFuente {
  fuente: FuenteDatos;
  /** Por qué se usan datos de prueba; null cuando la fuente es Zoho. */
  motivoMock: MotivoMock | null;
}

/** Datos reales solo si Zoho autenticó de verdad Y hay sesión iniciada; en cualquier otro caso, MOCK con el motivo explícito. */
export function elegirFuente(zoho: EstadoZohoUi, sesion: EstadoSesion): EleccionFuente {
  if (zoho === 'conectado') {
    if (sesion.autenticado) return { fuente: 'zoho', motivoMock: null };
    return { fuente: 'mock', motivoMock: sesion.adminHabilitado ? 'requiere_login' : 'login_deshabilitado' };
  }
  const motivo: Record<Exclude<EstadoZohoUi, 'conectado'>, MotivoMock> = {
    no_configurado: 'sin_credenciales',
    error: 'error_zoho',
    backend_no_disponible: 'backend_no_disponible',
  };
  return { fuente: 'mock', motivoMock: motivo[zoho] };
}
