import { ORDEN_COMPUERTAS, type Compuerta, type CompuertaId } from '../compuertas/compuerta';
import type { DocumentoExpediente, TipoDocumento } from '../documentos/documento';

/** `fisico` = requiere impresión, firma autógrafa o entrega en oficina/ventanilla. */
export type CanalEntrega = 'digital' | 'fisico';

/** Requisito documental de una compuerta (definido por catálogo, no por proyecto). */
export interface Requisito {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  compuerta: CompuertaId;
  obligatorio: boolean;
  canal: CanalEntrega;
  /** Texto de la condición cuando el requisito solo aplica en ciertos casos (no obligatorio por defecto). */
  condicion?: string;
  /** Lo entrega el cliente (visible como pendiente suyo en el portal). */
  aportaCliente?: boolean;
  /** El documento debe estar vigente: se audita su `fechaVigencia`. */
  requiereVigencia?: boolean;
  /** Su compuerta cambia según la política de la Zona de Distribución (ver `catalogoParaZona`). */
  reubicablePorZona?: boolean;
}

/** Parámetros que varían por Zona de Distribución. */
export interface ConfiguracionZona {
  /** true: el dictamen UVIE se exige antes del ingreso de la solicitud (pasa a G2). false: antes de formalizar/interconectar (G3). */
  uvieAntesDeIngreso: boolean;
}

export const CONFIGURACION_ZONA_POR_DEFECTO: ConfiguracionZona = { uvieAntesDeIngreso: false };

/** Aplica la política de zona al catálogo base sin duplicar requisitos. */
export function catalogoParaZona(base: readonly Requisito[], zona: ConfiguracionZona): Requisito[] {
  return base.map((r) =>
    r.reubicablePorZona && zona.uvieAntesDeIngreso ? { ...r, compuerta: 'G2' as const } : r,
  );
}

export interface CarpetaFisica {
  total: number;
  listos: number;
  pendientes: ItemChecklist[];
}

/** Documentos que requieren impresión/firma/entrega física y cuáles ya están disponibles. */
export function evaluarCarpetaFisica(resumenes: readonly ResumenCompuerta[]): CarpetaFisica {
  const items = resumenes.flatMap((r) => r.items).filter((i) => i.requisito.canal === 'fisico');
  const pendientes = items.filter((i) => i.documento === null);
  return { total: items.length, listos: items.length - pendientes.length, pendientes };
}

export interface ItemChecklist {
  requisito: Requisito;
  /** Documento que satisface el requisito; null = faltante. */
  documento: DocumentoExpediente | null;
}

export interface ResumenCompuerta {
  compuerta: CompuertaId;
  items: ItemChecklist[];
  totalObligatorios: number;
  recibidosObligatorios: number;
  faltantes: ItemChecklist[];
  completa: boolean;
}

export interface Progreso {
  recibidos: number;
  total: number;
}

/** Cruza el catálogo de requisitos con los documentos del proyecto. Un requisito se cubre por tipo de documento. */
export function evaluarChecklist(
  requisitos: readonly Requisito[],
  documentos: readonly DocumentoExpediente[],
): ResumenCompuerta[] {
  return ORDEN_COMPUERTAS.map((compuerta) => {
    const items: ItemChecklist[] = requisitos
      .filter((r) => r.compuerta === compuerta)
      .map((requisito) => ({
        requisito,
        documento: documentos.find((d) => d.tipo === requisito.tipo) ?? null,
      }));
    const obligatorios = items.filter((i) => i.requisito.obligatorio);
    const faltantes = obligatorios.filter((i) => i.documento === null);
    return {
      compuerta,
      items,
      totalObligatorios: obligatorios.length,
      recibidosObligatorios: obligatorios.length - faltantes.length,
      faltantes,
      completa: faltantes.length === 0,
    };
  });
}

export function progresoGlobal(resumenes: readonly ResumenCompuerta[]): Progreso {
  return resumenes.reduce<Progreso>(
    (acc, r) => ({ recibidos: acc.recibidos + r.recibidosObligatorios, total: acc.total + r.totalObligatorios }),
    { recibidos: 0, total: 0 },
  );
}

export interface DecisionCompuerta {
  permitido: boolean;
  motivos: string[];
}

/**
 * Una compuerta solo puede solicitarse si las anteriores están liberadas y su checklist obligatorio está completo.
 * Compuertas ya liberadas no se vuelven a solicitar.
 */
export function puedeSolicitarCompuerta(
  id: CompuertaId,
  compuertas: readonly Compuerta[],
  resumenes: readonly ResumenCompuerta[],
  bloqueantesAbiertos = 0,
): DecisionCompuerta {
  const motivos: string[] = [];
  // G2 es el filtro anti-reingresos: no pasa con hallazgos bloqueantes abiertos.
  if (id === 'G2' && bloqueantesAbiertos > 0) motivos.push(`${bloqueantesAbiertos} hallazgo(s) bloqueante(s) abierto(s)`);
  const estadoDe = (c: CompuertaId) => compuertas.find((x) => x.id === c)?.estado;

  if (estadoDe(id) === 'liberada') motivos.push(`${id} ya está liberada`);
  for (const previa of ORDEN_COMPUERTAS.slice(0, ORDEN_COMPUERTAS.indexOf(id))) {
    if (estadoDe(previa) !== 'liberada') motivos.push(`${previa} no está liberada`);
  }
  const resumen = resumenes.find((r) => r.compuerta === id);
  if (resumen && !resumen.completa) {
    motivos.push(`Faltan ${resumen.faltantes.length} documento(s) obligatorio(s) de ${id}`);
  }
  return { permitido: motivos.length === 0, motivos };
}
