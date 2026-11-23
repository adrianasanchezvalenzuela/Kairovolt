import { ErrorCuenta, type CuentaRepositorio } from '@/application/cuenta';
import { api, type RespuestaApi } from './http';

function mensaje({ status, data }: RespuestaApi): string {
  if (status === 401) return 'La sesión expiró. Vuelve a iniciar sesión.';
  if (status === 404) return 'Esta función no está habilitada en el backend.';
  if (status === 503) return 'No se pudo contactar al servicio de cuentas. Intenta de nuevo en un momento.';
  if (typeof data.detalle === 'string') return data.detalle;
  if (status === 429) return 'Demasiados intentos. Espera un momento.';
  return typeof data.error === 'string' ? data.error : `El backend respondió ${status}.`;
}

async function enviar(ruta: string, cuerpo: unknown, aceptados: number[]): Promise<void> {
  let r: RespuestaApi;
  try {
    r = await api('POST', ruta, cuerpo);
  } catch {
    throw new ErrorCuenta('No se pudo contactar al backend.');
  }
  if (!aceptados.includes(r.status)) throw new ErrorCuenta(mensaje(r));
}

export const cuentaHttp: CuentaRepositorio = {
  solicitarRecuperacion: (correo) => enviar('/api/recuperar', { correo }, [202]),
  restablecer: (token, contrasena) => enviar('/api/restablecer', { token, contrasena }, [200]),
  cambiarContrasena: (actual, nueva) => enviar('/api/cuenta/contrasena', { actual, nueva }, [200]),
};
