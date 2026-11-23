/** Error legible para el usuario (el backend no incluye secretos en sus mensajes). */
export class ErrorCuenta extends Error {}

export interface CuentaRepositorio {
  /** Pide el correo de recuperación. Responde igual exista o no la cuenta (no se revela). */
  solicitarRecuperacion(correo: string): Promise<void>;
  /** `token` es el access_token temporal que llega en el enlace del correo. */
  restablecer(token: string, contrasena: string): Promise<void>;
  /** Cambia la contraseña de la cuenta con sesión; exige la actual. */
  cambiarContrasena(actual: string, nueva: string): Promise<void>;
}
