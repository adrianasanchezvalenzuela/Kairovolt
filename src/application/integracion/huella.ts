/** JSON con las claves ordenadas: el mismo contenido da siempre el mismo texto, sin importar el orden en que se armó el objeto. */
export function jsonEstable(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'null';
  if (Array.isArray(valor)) return `[${valor.map(jsonEstable).join(',')}]`;
  const o = valor as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${jsonEstable(o[k])}`).join(',')}}`;
}

/** Hash no criptográfico de 53 bits (cyrb53) en hexadecimal: sirve para claves de idempotencia, NO para seguridad. */
export function hash53(texto: string, semilla = 0): string {
  let h1 = 0xdeadbeef ^ semilla;
  let h2 = 0x41c6ce57 ^ semilla;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export const huellaEstable = (valor: unknown): string => hash53(jsonEstable(valor));
