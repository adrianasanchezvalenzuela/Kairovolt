import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_PORTAL = 'kv_portal';
/** Más corta que la del personal: es un acceso externo. */
export const DURACION_PORTAL_S = 2 * 3600;

/** Clave de firma del portal, DISTINTA de la del personal: una cookie de una no sirve en la otra. */
export const derivarSecretoPortal = (base: string): string => createHmac('sha256', 'kairovolt-portal').update(base).digest('hex');

export interface DatosSesionPortal {
  /** Id del acceso (se revalida en cada petición). */
  acceso: string;
  folio: string;
}

/** Cookie sin estado `<carga>.<firma>`. NO lleva permisos: se consultan en cada petición, así revocar surte efecto de inmediato. */
export function crearSesionesPortal(secreto: string, ahora: () => number = Date.now) {
  const firmar = (carga: string) => createHmac('sha256', secreto).update(carga).digest('hex');
  const segundos = () => Math.floor(ahora() / 1000);
  return {
    crear(d: DatosSesionPortal): string {
      const carga = Buffer.from(JSON.stringify({ a: d.acceso, f: d.folio, e: segundos() + DURACION_PORTAL_S })).toString('base64url');
      return `${carga}.${firmar(carga)}`;
    },
    leer(valor: string | undefined): DatosSesionPortal | null {
      if (!valor) return null;
      const [carga, firma, resto] = valor.split('.');
      if (!carga || !firma || resto !== undefined) return null;
      const esperada = firmar(carga);
      if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
      try {
        const d = JSON.parse(Buffer.from(carga, 'base64url').toString()) as { a?: unknown; f?: unknown; e?: unknown };
        if (typeof d.a !== 'string' || typeof d.f !== 'string' || typeof d.e !== 'number' || d.e <= segundos()) return null;
        return { acceso: d.a, folio: d.f };
      } catch {
        return null;
      }
    },
  };
}
