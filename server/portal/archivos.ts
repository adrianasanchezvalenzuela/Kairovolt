/** Validación de archivos subidos por el cliente. El tipo se decide por el CONTENIDO, no por lo que declare el navegador. */

export const MAX_BYTES = 10 * 1024 * 1024;

export type TipoArchivo = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSION: Record<TipoArchivo, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const FORMATOS_ACEPTADOS = ['PDF', 'JPG', 'PNG', 'WEBP'] as const;

/** Tipo real según los primeros bytes; null si no es uno permitido. */
export function detectarTipo(b: Uint8Array): TipoArchivo | null {
  const ascii = (desde: number, texto: string) => texto.split('').every((c, i) => b[desde + i] === c.charCodeAt(0));
  if (b.length >= 5 && ascii(0, '%PDF-')) return 'application/pdf';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  return null;
}

/** Nombre seguro: sin rutas, sin caracteres raros, con la extensión del tipo real. */
export function sanearNombre(nombre: string, tipo: TipoArchivo): string {
  const base = nombre.split(/[\\/]/).pop() ?? '';
  const sinExt = base.replace(/\.[^.]*$/, '');
  const limpio = sinExt.normalize('NFC').replace(/[^\p{L}\p{N}._ ()-]/gu, '').replace(/\s+/g, ' ').replace(/^[.\s-]+|[.\s-]+$/g, '').slice(0, 80);
  return `${limpio === '' ? 'documento' : limpio}.${EXTENSION[tipo]}`;
}

export type ResultadoArchivo =
  | { ok: true; tipo: TipoArchivo; nombre: string; bytes: Uint8Array }
  | { ok: false; error: 'vacio' | 'demasiado_grande' | 'tipo_no_permitido' | 'tipo_no_coincide'; detalle: string };

export function validarArchivo(nombre: string, declarado: string, bytes: Uint8Array, max = MAX_BYTES): ResultadoArchivo {
  if (bytes.byteLength === 0) return { ok: false, error: 'vacio', detalle: 'El archivo está vacío.' };
  if (bytes.byteLength > max) return { ok: false, error: 'demasiado_grande', detalle: `El archivo pesa más de ${Math.round(max / 1024 / 1024)} MB.` };
  const tipo = detectarTipo(bytes);
  if (!tipo) return { ok: false, error: 'tipo_no_permitido', detalle: `Solo se aceptan archivos ${FORMATOS_ACEPTADOS.join(', ')}.` };
  const d = declarado.toLowerCase().split(';')[0]!.trim();
  const equivalentes = tipo === 'image/jpeg' ? ['image/jpeg', 'image/jpg', 'image/pjpeg'] : [tipo];
  if (d !== '' && d !== 'application/octet-stream' && !equivalentes.includes(d)) return { ok: false, error: 'tipo_no_coincide', detalle: 'El contenido del archivo no corresponde a su tipo.' };
  return { ok: true, tipo, nombre: sanearNombre(nombre, tipo), bytes };
}
