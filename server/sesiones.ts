import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_SESION = 'kv_sesion';
export const DURACION_SESION_S = 8 * 3600;

/** Clave de firma derivada de un secreto del servidor: rotarlo invalida todas las sesiones. */
export const derivarSecreto = (base: string): string => createHmac('sha256', 'kairovolt-sesion').update(base).digest('hex');

/** `uid` = id del usuario en Supabase; `null` = sesión abierta con el token de emergencia (ADMIN_TOKEN). */
export interface DatosSesion {
  uid: string | null;
}

/**
 * Sesiones SIN estado: la cookie es `<carga en base64url>.<firma HMAC>` con el id del usuario y la expiración.
 * No hay nada en memoria, así que funcionan igual en un servidor normal que en serverless (Vercel).
 * La cookie NO lleva el rol: el backend consulta el perfil en cada petición (con una caché corta), así que desactivar a
 * alguien o cambiarle el rol surte efecto casi al instante.
 * Limitación: cerrar sesión solo borra la cookie del navegador; una cookie copiada vale hasta expirar o hasta rotar el secreto.
 */
export function crearSesiones(secreto: string, ahora: () => number = Date.now) {
  const firmar = (carga: string) => createHmac('sha256', secreto).update(carga).digest('hex');
  const segundos = () => Math.floor(ahora() / 1000);
  return {
    crear(uid: string | null): string {
      const carga = Buffer.from(JSON.stringify({ u: uid, e: segundos() + DURACION_SESION_S })).toString('base64url');
      return `${carga}.${firmar(carga)}`;
    },
    leer(valor: string | undefined): DatosSesion | null {
      if (!valor) return null;
      const [carga, firma, resto] = valor.split('.');
      if (!carga || !firma || resto !== undefined) return null;
      const esperada = firmar(carga);
      if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
      try {
        const d = JSON.parse(Buffer.from(carga, 'base64url').toString()) as { u?: unknown; e?: unknown };
        if (typeof d.e !== 'number' || d.e <= segundos()) return null;
        if (d.u !== null && typeof d.u !== 'string') return null;
        return { uid: d.u };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Bloquea el inicio de sesión tras `max` intentos fallidos dentro de `ventanaMs`, POR CLAVE (p. ej. por correo):
 * así un atacante solo puede bloquear la cuenta que ataca, no a todo el personal.
 * Vive en memoria: en serverless protege por instancia, no globalmente (Supabase Auth tiene además su propio límite).
 */
export function crearLimitadores(max = 5, ventanaMs = 60_000, ahora: () => number = Date.now) {
  const mapa = new Map<string, number[]>();
  const vigentes = (k: string) => {
    const v = (mapa.get(k) ?? []).filter((t) => ahora() - t < ventanaMs);
    if (v.length > 0) mapa.set(k, v); else mapa.delete(k);
    return v;
  };
  return {
    bloqueado: (k: string) => vigentes(k).length >= max,
    falla: (k: string) => {
      if (mapa.size > 5000) mapa.clear(); // cota de memoria ante un barrido de correos
      mapa.set(k, [...vigentes(k), ahora()]);
    },
    exito: (k: string) => { mapa.delete(k); },
  };
}
