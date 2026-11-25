import { decisionesVacias, type DecisionesProyecto, type DecisionesRepositorio } from '@/application/decisiones';

const PREFIJO = 'kairovolt:decisiones:';

/** Respaldo en memoria cuando el navegador no deja usar localStorage (modo privado, datos bloqueados). */
const memoria = new Map<string, string>();

const almacen = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const valida = (v: unknown): v is DecisionesProyecto => {
  const d = v as Partial<DecisionesProyecto> | null;
  return !!d && Array.isArray(d.observaciones) && Array.isArray(d.eventos) && Array.isArray(d.aprobaciones)
    && typeof d.cambios === 'object' && d.cambios !== null && typeof d.estadosCompuerta === 'object' && d.estadosCompuerta !== null;
};

/**
 * Decisiones guardadas en ESTE navegador. No es una base de datos compartida: otro equipo u otro navegador no las ve.
 * Existe porque el backend aún no tiene tabla de decisiones; la interfaz lo dice claramente.
 */
export const decisionesLocal: DecisionesRepositorio = {
  almacenamiento: 'local',
  async cargar(folio) {
    const clave = PREFIJO + folio.toUpperCase();
    let crudo: string | null | undefined;
    try { crudo = almacen()?.getItem(clave); } catch { crudo = undefined; }
    crudo ??= memoria.get(clave) ?? null;
    if (!crudo) return decisionesVacias();
    try {
      const v: unknown = JSON.parse(crudo);
      return valida(v) ? v : decisionesVacias();
    } catch {
      return decisionesVacias();
    }
  },
  async guardar(folio, decisiones) {
    const clave = PREFIJO + folio.toUpperCase();
    const texto = JSON.stringify(decisiones);
    memoria.set(clave, texto);
    try { almacen()?.setItem(clave, texto); } catch { /* sin espacio o bloqueado: queda en memoria */ }
  },
};
