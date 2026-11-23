export const LONGITUD_MINIMA_CONTRASENA = 12;
/** bcrypt solo considera los primeros 72 bytes. */
export const LONGITUD_MAXIMA_CONTRASENA = 72;

/** Devuelve el motivo del rechazo, o null si la contraseña es aceptable. */
export function validarContrasena(contrasena: string): string | null {
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) return `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`;
  if (contrasena.length > LONGITUD_MAXIMA_CONTRASENA) return `La contraseña no puede pasar de ${LONGITUD_MAXIMA_CONTRASENA} caracteres.`;
  if (!/[A-Za-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) return 'La contraseña debe combinar letras y números.';
  return null;
}

/** Devuelve el correo normalizado (minúsculas, sin espacios) o null si no parece un correo. */
export function normalizarCorreo(correo: string): string | null {
  const c = correo.trim().toLowerCase();
  return c.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : null;
}

// Sin caracteres ambiguos (0/O, 1/l/I) para poder dictarla o copiarla sin errores.
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITOS = '23456789';
const ALFABETO = LETRAS + DIGITOS;

/**
 * Contraseña aleatoria. `aleatorio(n)` debe devolver n bytes criptográficamente seguros
 * (en el navegador: `crypto.getRandomValues`). Descarta los bytes que sesgarían el alfabeto y, si el resultado
 * quedó sin letras o sin dígitos, reemplaza un carácter (sin bucles: termina siempre).
 */
export function generarContrasena(aleatorio: (n: number) => Uint8Array, longitud = 16): string {
  const limite = 256 - (256 % ALFABETO.length);
  const chars: string[] = [];
  for (let intento = 0; chars.length < longitud && intento < 50; intento++) {
    for (const b of aleatorio(longitud * 2)) {
      if (b < limite && chars.length < longitud) chars.push(ALFABETO[b % ALFABETO.length]!);
    }
  }
  if (chars.length < longitud) throw new Error('La fuente aleatoria no entregó suficientes bytes');

  const [p, q, r] = aleatorio(3);
  const forzar = (conjunto: string, existe: RegExp, pos: number, b: number) => {
    if (!existe.test(chars.join(''))) chars[pos % longitud] = conjunto[b % conjunto.length]!;
  };
  forzar(DIGITOS, /[0-9]/, p ?? 0, q ?? 0);
  forzar(LETRAS, /[A-Za-z]/, (p ?? 0) + 1, r ?? 0);
  return chars.join('');
}
