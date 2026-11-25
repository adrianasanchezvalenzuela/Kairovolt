import type { CanalEntrega, CondicionAplicacion, QuienAportaDocumento, Requisito, EstadoValidacionCatalogo } from './checklist';
import type { CompuertaId } from '../compuertas/compuerta';
import type { TipoDocumento } from '../documentos/documento';

export interface RequisitoDocumental {
  id: string;
  codigo: string;
  tipo: TipoDocumento | null;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  compuerta: CompuertaId | null;
  canal: CanalEntrega;
  obligatorio: boolean;
  condicion: string | null;
  requiereVigencia: boolean;
  aportaCliente: boolean;
  reubicablePorZona: boolean;
  condicionesAplicacion: readonly CondicionAplicacion[];
  quienAporta: QuienAportaDocumento;
  instruccionesCliente: string | null;
  camposEsperados: readonly string[];
  ejemplosAutorizados: readonly string[];
  generacionAutomatica: boolean;
  orden: number;
  activo: boolean;
  validacionIdc: EstadoValidacionCatalogo;
}

const TIPOS: readonly TipoDocumento[] = [
  'consulta_capacidad_mt', 'recibo_cfe', 'datos_preliminares', 'identificacion_oficial', 'constancia_situacion_fiscal',
  'carta_poder', 'acta_constitutiva', 'croquis', 'diagrama_unifilar', 'memoria_calculo', 'ficha_tecnica', 'certificado',
  'solicitud', 'evidencia_fotografica', 'checklist_consistencia', 'dictamen_uvie', 'certificado_uiie', 'oficio_resolutivo',
  'contrato_interconexion', 'contrato_contraprestacion', 'medidor_bidireccional',
];
const COMPUERTAS: readonly CompuertaId[] = ['G0', 'G1', 'G2', 'G3'];
const CANALES: readonly CanalEntrega[] = ['digital', 'fisico'];

export interface FilaCatalogoSupabase {
  id: string; codigo: string; tipo_documento: string | null; nombre: string; descripcion: string | null; categoria: string;
  compuerta: string | null; canal: string; obligatorio: boolean; condicion: string | null; condiciones_aplicacion: unknown;
  requiere_vigencia: boolean; aporta_cliente: boolean; quien_aporta: string; instrucciones_cliente: string | null;
  campos_esperados: unknown; ejemplos_autorizados: unknown; generacion_automatica: boolean; orden: number; activo: boolean;
  validacion_idc: string;
}

const arregloTexto = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const condiciones = (v: unknown): CondicionAplicacion[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is CondicionAplicacion => typeof x === 'object' && x !== null
    && ['modalidad', 'tipo_instalacion', 'tipo_titular', 'zona_uvie'].includes(String((x as CondicionAplicacion).campo))
    && ['igual', 'distinto', 'incluye', 'existe'].includes(String((x as CondicionAplicacion).operador)));
};

/** Traduce una fila validada por el esquema al contrato compartido del dominio. */
export function mapearFilaCatalogo(f: FilaCatalogoSupabase): RequisitoDocumental {
  const tipo = TIPOS.includes(f.tipo_documento as TipoDocumento) ? f.tipo_documento as TipoDocumento : null;
  const compuerta = COMPUERTAS.includes(f.compuerta as CompuertaId) ? f.compuerta as CompuertaId : null;
  const canal = CANALES.includes(f.canal as CanalEntrega) ? f.canal as CanalEntrega : 'digital';
  return {
    id: f.id, codigo: f.codigo, tipo, nombre: f.nombre, descripcion: f.descripcion, categoria: f.categoria,
    compuerta, canal, obligatorio: f.obligatorio, requiereVigencia: f.requiere_vigencia, aportaCliente: f.aporta_cliente,
    reubicablePorZona: false,
    condicion: f.condicion, condicionesAplicacion: condiciones(f.condiciones_aplicacion),
    quienAporta: f.quien_aporta as QuienAportaDocumento,
    instruccionesCliente: f.instrucciones_cliente, camposEsperados: arregloTexto(f.campos_esperados),
    ejemplosAutorizados: arregloTexto(f.ejemplos_autorizados), generacionAutomatica: f.generacion_automatica,
    orden: f.orden, activo: f.activo, validacionIdc: f.validacion_idc === 'validado' ? 'validado' : 'pendiente',
  };
}

export function comoRequisitoChecklist(r: RequisitoDocumental): Requisito {
  if (!r.tipo || !r.compuerta) throw new Error(`El requisito ${r.codigo} no está mapeado a checklist.`);
  return { ...r, tipo: r.tipo, compuerta: r.compuerta } as Requisito;
}

export function hayRequisitosPendientesDeIDC(catalogo: readonly RequisitoDocumental[]): boolean {
  return catalogo.some((r) => r.activo && r.tipo && r.compuerta && r.validacionIdc !== 'validado');
}
