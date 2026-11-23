import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_SESION = 'kv_sesion';
export const DURACION_SESION_S = 8 * 3600;

/** Clave de firma derivada del ADMIN_TOKEN: rotar el token invalida todas las sesiones. */
export const derivarSecreto = (adminToken: string): string => createHmac('sha256', 'kairovolt-sesion').update(adminToken).digest('hex');

/**
 * Sesiones SIN estado: la cookie es `<expira>.<firma HMAC>`. No hay nada en memoria, así que funcionan igual en un
 * servidor normal que en serverless (Vercel), donde cada petición puede caer en otra instancia.
 * Limitación: cerrar sesión solo borra la cookie del navegador; una cookie copiada sigue valiendo hasta que expire
 * o hasta que cambies el ADMIN_TOKEN.
 */
export function crearSesiones(secreto: string, ahora: () => number = Date.now) {
  const firmar = (exp: string) => createHmac('sha256', secreto).update(exp).digest('hex');
  const segundos = () => Math.floor(ahora() / 1000);
  return {
    crear(): string {
      const exp = String(segundos() + DURACION_SESION_S);
      return `${exp}.${firmar(exp)}`;
    },
    valida(valor: string | undefined): boolean {
      if (!valor) return false;
      const [exp, firma, resto] = valor.split('.');
      if (!exp || !firma || resto !== undefined || !/^\d+$/.test(exp)) return false;
      const esperada = firmar(exp);
      if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return false;
      return Number(exp) > segundos();
    },
  };
}

/**
 * Bloquea el inicio de sesión tras `max` intentos fallidos dentro de `ventanaMs`.
 * Vive en memoria: en serverless protege por instancia, no globalmente.
 */
export function crearLimitador(max = 5, ventanaMs = 60_000, ahora: () => number = Date.now) {
  let fallos: number[] = [];
  const vigentes = () => (fallos = fallos.filter((t) => ahora() - t < ventanaMs));
  return {
    bloqueado: () => vigentes().length >= max,
    falla: () => { vigentes().push(ahora()); },
    exito: () => { fallos = []; },
  };
}
