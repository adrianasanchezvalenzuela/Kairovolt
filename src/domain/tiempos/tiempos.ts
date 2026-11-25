import type { CompuertaId } from '../compuertas/compuerta';
import { ORDEN_COMPUERTAS } from '../compuertas/compuerta';
import type { HitoProyecto, TipoHito } from '../entidades/hito';
import { diasEntre } from '../fechas/fechas';

/** Par de hitos cuyo tiempo se mide. Configurable: IDC puede definir los suyos. */
export interface ParHitos {
  id: string;
  etiqueta: string;
  desde: TipoHito;
  hasta: TipoHito;
}

/** Incluye el que más preocupa a IDC: el retraso entre obra terminada e interconexión. */
export const PARES_POR_DEFECTO: readonly ParHitos[] = [
  { id: 'obra_a_ingreso', etiqueta: 'Obra terminada → ingreso a CFE', desde: 'obra_terminada', hasta: 'ingreso_cfe' },
  { id: 'ingreso_a_dictamen', etiqueta: 'Ingreso a CFE → dictamen UVIE', desde: 'ingreso_cfe', hasta: 'dictamen_uvie' },
  { id: 'dictamen_a_contrato', etiqueta: 'Dictamen UVIE → contrato firmado', desde: 'dictamen_uvie', hasta: 'contrato_firmado' },
  { id: 'contrato_a_interconexion', etiqueta: 'Contrato firmado → interconexión', desde: 'contrato_firmado', hasta: 'interconexion' },
  { id: 'obra_a_interconexion', etiqueta: 'Obra terminada → interconexión', desde: 'obra_terminada', hasta: 'interconexion' },
];

/** Días hábiles (lunes a viernes, sin los festivos dados) en (desde, hasta]. Negativo si `hasta` es anterior a `desde`. */
export function diasHabiles(desde: string, hasta: string, festivos: readonly string[] = []): number {
  const signo = diasEntre(desde, hasta) < 0 ? -1 : 1;
  const [ini, fin] = signo === 1 ? [desde, hasta] : [hasta, desde];
  const exc = new Set(festivos);
  let n = 0;
  const base = Date.parse(ini);
  for (let i = 1, total = diasEntre(ini, fin); i <= total; i++) {
    const d = new Date(base + i * 86_400_000);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6 && !exc.has(d.toISOString().slice(0, 10))) n++;
  }
  return signo * n;
}

export interface TiempoEntreHitos {
  id: string;
  etiqueta: string;
  /** Fecha real (fin real) del hito de origen; null si aún no ocurre. */
  desde: string | null;
  hasta: string | null;
  /** Días naturales; si el hito final no ocurre, corren hasta hoy (`enCurso`). null si no hay hito de origen. */
  dias: number | null;
  diasHabiles: number | null;
  enCurso: boolean;
  /** true = las fechas se contradicen (el destino es anterior al origen): hay que revisar los datos, no se corrigen. */
  inconsistente: boolean;
}

export interface TiempoPorCompuerta {
  compuerta: CompuertaId;
  inicio: string | null;
  fin: string | null;
  dias: number | null;
  enCurso: boolean;
  /** Mayor atraso (días) contra el fin planeado entre los hitos de la compuerta; 0 si va en tiempo. */
  retrasoDias: number;
}

export interface TiemposProceso {
  entreHitos: TiempoEntreHitos[];
  porCompuerta: TiempoPorCompuerta[];
  /** Días desde el último hito terminado; null si no hay ninguno. */
  diasSinMovimiento: number | null;
  /** Días desde el inicio del proyecto (hito de inicio o primer inicio planeado) hasta hoy. */
  diasDesdeInicio: number | null;
}

export interface OpcionesTiempos {
  pares?: readonly ParHitos[];
  festivos?: readonly string[];
}

const minimo = (xs: readonly string[]): string | null => (xs.length === 0 ? null : [...xs].sort()[0]!);
const maximo = (xs: readonly string[]): string | null => (xs.length === 0 ? null : [...xs].sort().at(-1)!);

/** Tiempos de proceso a partir de los hitos reales (fin real). Solo lee: no corrige fechas contradictorias. */
export function calcularTiemposProceso(hitos: readonly HitoProyecto[], hoy: string, opciones: OpcionesTiempos = {}): TiemposProceso {
  const festivos = opciones.festivos ?? [];
  const fechaDe = (tipo: TipoHito): string | null =>
    minimo(hitos.filter((h) => h.tipo === tipo && h.finReal !== null).map((h) => h.finReal as string));

  const entreHitos = (opciones.pares ?? PARES_POR_DEFECTO).map((p): TiempoEntreHitos => {
    const desde = fechaDe(p.desde);
    const hasta = fechaDe(p.hasta);
    const base = { id: p.id, etiqueta: p.etiqueta, desde, hasta };
    if (desde === null) return { ...base, dias: null, diasHabiles: null, enCurso: false, inconsistente: false };
    const fin = hasta ?? hoy;
    const dias = diasEntre(desde, fin);
    return { ...base, dias, diasHabiles: diasHabiles(desde, fin, festivos), enCurso: hasta === null, inconsistente: hasta !== null && dias < 0 };
  });

  const porCompuerta = ORDEN_COMPUERTAS.map((compuerta): TiempoPorCompuerta => {
    const hs = hitos.filter((h) => h.compuerta === compuerta);
    const inicio = minimo(hs.map((h) => h.inicioPlan));
    const terminada = hs.length > 0 && hs.every((h) => h.finReal !== null);
    const fin = terminada ? maximo(hs.map((h) => h.finReal as string)) : null;
    const retraso = hs.reduce((m, h) => {
      const referencia = h.finReal ?? hoy;
      return Math.max(m, diasEntre(h.finPlan, referencia));
    }, 0);
    return {
      compuerta, inicio, fin,
      dias: inicio === null ? null : diasEntre(inicio, fin ?? hoy),
      enCurso: hs.length > 0 && !terminada && diasEntre(inicio ?? hoy, hoy) >= 0,
      retrasoDias: Math.max(0, retraso),
    };
  });

  const ultimo = maximo(hitos.filter((h) => h.finReal !== null).map((h) => h.finReal as string));
  const inicioProyecto = fechaDe('inicio_proyecto') ?? minimo(hitos.map((h) => h.inicioPlan));
  return {
    entreHitos, porCompuerta,
    diasSinMovimiento: ultimo === null ? null : diasEntre(ultimo, hoy),
    diasDesdeInicio: inicioProyecto === null ? null : diasEntre(inicioProyecto, hoy),
  };
}
