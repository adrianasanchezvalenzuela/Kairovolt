import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Sin 0/O/1/I/L para que se pueda dictar sin errores. 32 símbolos = 5 bits por carácter. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código de acceso de 16 caracteres (~79 bits), con formato XXXX-XXXX-XXXX-XXXX. */
export function generarCodigo(bytes: (n: number) => Uint8Array = (n) => randomBytes(n)): string {
  const crudo = bytes(16);
  let s = '';
  for (const b of crudo) s += ALFABETO[b % ALFABETO.length];
  return s.match(/.{4}/g)!.join('-');
}

/** Mayúsculas y sin separadores ni espacios: «ab12 cd34» y «AB12-CD34» son el mismo código. */
export const normalizarCodigo = (c: string): string => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const huellaCodigo = (codigo: string): string => createHash('sha256').update(normalizarCodigo(codigo)).digest('hex');

export const FORMATO_CODIGO = /^[A-Za-z0-9]{4}([\s-]?[A-Za-z0-9]{4}){3}$/;

export const sonIguales = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
