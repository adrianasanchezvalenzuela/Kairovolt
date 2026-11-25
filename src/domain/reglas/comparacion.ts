import type { Coordenadas } from '../entidades/configuracion-tecnica';
import type { TipoValor } from '../validacion/campos';

export const vacio = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export const normalizarTexto = (v: string | number): string => String(v).trim().replace(/\s+/g, ' ').toUpperCase();

export const redondear = (n: number, decimales = 2): number => Math.round(n * 10 ** decimales) / 10 ** decimales;

/** Acepta "6921.31", "6,921.31" (coma de miles) y "6921,31" (coma decimal). Cualquier otra cosa → null. */
export function parseNumero(v: string | number | null | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s/g, '');
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  if (/^[+-]?\d+,\d{1,2}$/.test(t)) return Number(t.replace(',', '.'));
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

export function numerosIguales(a: number, b: number, toleranciaRelativa: number, toleranciaAbsoluta = 0): boolean {
  return Math.abs(a - b) <= Math.max(toleranciaAbsoluta, toleranciaRelativa * Math.max(Math.abs(a), Math.abs(b)));
}

/**
 * Si dos cantidades difieren casi exactamente en una potencia de 10 (≈×10, ×100…), devuelve ese factor:
 * suele indicar un punto decimal mal puesto. Es solo una PISTA para quien revisa; no corrige nada.
 */
export function ordenDeMagnitud(a: number, b: number, tolerancia: number): number | null {
  const menor = Math.min(Math.abs(a), Math.abs(b));
  const mayor = Math.max(Math.abs(a), Math.abs(b));
  if (menor === 0) return null;
  const razon = mayor / menor;
  const k = Math.round(Math.log10(razon));
  if (k < 1) return null;
  return Math.abs(razon / 10 ** k - 1) <= tolerancia ? 10 ** k : null;
}

/** "29.0729,-110.9559" o "29.0729, -110.9559". Fuera de rango o con otro formato → null. */
export function parseCoordenadas(v: string | number | null | undefined): Coordenadas | null {
  if (typeof v !== 'string') return null;
  const m = /^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(v);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

export const formatearCoordenadas = (c: Coordenadas): string => `${c.lat},${c.lon}`;

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Un valor declarado por una fuente (un documento o la configuración técnica). */
export interface Declaracion {
  origenId: string;
  origenNombre: string;
  valor: string | number;
}

export interface Grupo {
  representante: string | number;
  miembros: Declaracion[];
}

export interface Tolerancias {
  relativa: number;
  absoluta: number;
  metros: number;
}

/** Agrupa las declaraciones que significan lo mismo (según el tipo de valor y las tolerancias). Más de un grupo = discrepancia. */
export function agruparDeclaraciones(decl: readonly Declaracion[], tipo: TipoValor, tol: Tolerancias): Grupo[] {
  const grupos: Grupo[] = [];
  for (const d of decl) {
    const g = grupos.find((x) => coinciden(x.representante, d.valor, tipo, tol));
    if (g) g.miembros.push(d);
    else grupos.push({ representante: d.valor, miembros: [d] });
  }
  return grupos;
}

function coinciden(a: string | number, b: string | number, tipo: TipoValor, tol: Tolerancias): boolean {
  if (tipo === 'numero') {
    const x = parseNumero(a);
    const y = parseNumero(b);
    if (x !== null && y !== null) return numerosIguales(x, y, tol.relativa, tol.absoluta);
  }
  if (tipo === 'coordenadas') {
    const x = parseCoordenadas(typeof a === 'string' ? a : null);
    const y = parseCoordenadas(typeof b === 'string' ? b : null);
    if (x && y) return distanciaMetros(x, y) <= tol.metros;
  }
  return normalizarTexto(a) === normalizarTexto(b);
}
