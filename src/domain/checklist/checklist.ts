import { evaluarBloqueoCompuerta } from '../compuertas/bloqueo';
import { ORDEN_COMPUERTAS, type Compuerta, type CompuertaId } from '../compuertas/compuerta';
import type { DocumentoExpediente, TipoDocumento } from '../documentos/documento';
import type { CategoriaPortal, EmisorDocumento, GuiaPreparacion, RequiereEntregaFisica, RevisionDigital } from './preparacion';

/** `fisico` = requiere impresión, firma autógrafa o entrega en oficina/ventanilla. */
export type CanalEntrega = 'digital' | 'fisico';
export type EstadoValidacionCatalogo = 'pendiente' | 'validado';
export type QuienAportaDocumento = 'cliente' | 'idc' | 'tercero' | 'pendiente';

export interface CondicionAplicacion {
  campo: 'modalidad' | 'tipo_instalacion' | 'tipo_titular' | 'zona_uvie';
  operador: 'igual' | 'distinto' | 'incluye' | 'existe';
  valor?: string | string[];
}

/** Requisito documental de una compuerta (definido por catálogo, no por proyecto). */
export interface Requisito {
  guiaPreparacion?: GuiaPreparacion;
  revisionDigital?: RevisionDigital;
  categoriaPortal?: CategoriaPortal;
  emisorDocumento?: EmisorDocumento;
  permiteMultiplesArchivos?: boolean;
  requiereEntregaFisica?: RequiereEntregaFisica;
  id: string;
  codigo?: string;
  tipo: TipoDocumento;
  nombre: string;
  descripcion?: string | null;
  categoria?: string;
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
  condicionesAplicacion?: readonly CondicionAplicacion[];
  quienAporta?: QuienAportaDocumento;
  instruccionesCliente?: string | null;
  camposEsperados?: readonly string[];
  ejemplosAutorizados?: readonly string[];
  generacionAutomatica?: boolean;
  orden?: number;
  activo?: boolean;
  validacionIdc?: EstadoValidacionCatalogo;
}

export type ResultadoAplicabilidad = 'aplica' | 'no_aplica' | 'pendiente_revision';

export type DatosCondicionAplicacion = Partial<Record<CondicionAplicacion['campo'], string | null>>;

/** Una condición incompleta nunca se interpreta como autorización ni como requisito confirmado. */
export function evaluarAplicabilidad(requisito: Requisito, datos: DatosCondicionAplicacion): ResultadoAplicabilidad {
  if (requisito.validacionIdc !== 'validado') return 'pendiente_revision';
  const condiciones = requisito.condicionesAplicacion ?? [];
  if (condiciones.length === 0) return requisito.condicion ? 'pendiente_revision' : 'aplica';
  let desconocida = false;
  for (const condicion of condiciones) {
    const actual = datos[condicion.campo];
    if (actual === undefined || actual === null || actual === '') { desconocida = true; continue; }
    const valores = Array.isArray(condicion.valor) ? condicion.valor : [condicion.valor];
    const coincide = condicion.operador === 'existe' ? true
      : condicion.operador === 'igual' ? actual === valores[0]
        : condicion.operador === 'distinto' ? actual !== valores[0]
          : valores.includes(actual);
    if (!coincide) return 'no_aplica';
  }
  return desconocida ? 'pendiente_revision' : 'aplica';
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
 * Envoltorio de `evaluarBloqueoCompuerta` (compuertas/bloqueo.ts), donde vive la lógica y las demás razones de bloqueo.
 */
export function puedeSolicitarCompuerta(
  id: CompuertaId,
  compuertas: readonly Compuerta[],
  resumenes: readonly ResumenCompuerta[],
  bloqueantesAbiertos = 0,
): DecisionCompuerta {
  const d = evaluarBloqueoCompuerta({
    compuerta: id, compuertas, resumenes,
    validacionesBloqueantes: Array.from({ length: bloqueantesAbiertos }, (_, i) => ({ reglaId: 'legado', huella: `legado:${i}`, titulo: 'hallazgo bloqueante' })),
  });
  return { permitido: !d.bloqueada, motivos: d.razones.map((r) => r.mensaje) };
}
