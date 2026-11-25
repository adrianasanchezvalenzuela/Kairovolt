import type { Requisito } from '../src/domain/checklist/checklist';
import type { RequisitoDocumental, FilaCatalogoSupabase } from '../src/domain/checklist/catalogo';
import { comoRequisitoChecklist, mapearFilaCatalogo } from '../src/domain/checklist/catalogo';
import { catalogoRequisitosBase } from '../src/data/catalogo-requisitos.mock';
import type { ClienteSupabase } from './supabase/cliente';
import { guiasDemo } from '../src/domain/checklist/preparacion';

const CAMPOS = 'id,codigo,tipo_documento,nombre,descripcion,categoria,compuerta,canal,obligatorio,condicion,condiciones_aplicacion,requiere_vigencia,aporta_cliente,quien_aporta,instrucciones_cliente,campos_esperados,ejemplos_autorizados,generacion_automatica,orden,activo,validacion_idc,guia_preparacion,revision_digital';

/** Lee catálogo canónico con service_role. Cualquier error se propaga; producción nunca cae al catálogo demo. */
export async function leerCatalogoSupabase(sb: ClienteSupabase, soloActivos = true): Promise<RequisitoDocumental[]> {
  const filtro = soloActivos ? '&activo=eq.true' : '';
  const filas = await sb.rest<FilaCatalogoSupabase[]>(
    'GET', `/requisitos_documentales?select=${CAMPOS}${filtro}&order=orden.asc,codigo.asc`,
  );
  return (filas ?? []).map(mapearFilaCatalogo);
}

export function requisitosChecklist(catalogo: readonly RequisitoDocumental[]): Requisito[] {
  return catalogo.filter((r) => r.activo && r.tipo !== null && r.compuerta !== null).map(comoRequisitoChecklist);
}

/** Solo el modo de demostración usa las fixtures locales. */
export function catalogoDeDemostracion(): RequisitoDocumental[] {
  return catalogoRequisitosBase.map((r, i) => ({
    guiaPreparacion: guiasDemo[r.tipo], revisionDigital: r.aportaCliente ? 'opcional' : 'no_disponible',
    id: r.id, codigo: r.codigo ?? `KV_${r.tipo.toUpperCase()}`, tipo: r.tipo, nombre: r.nombre,
    descripcion: r.descripcion ?? r.nombre, categoria: r.categoria ?? 'pendiente', compuerta: r.compuerta,
    canal: r.canal, obligatorio: r.obligatorio, condicion: r.condicion ?? null, requiereVigencia: r.requiereVigencia === true,
    aportaCliente: r.aportaCliente === true, reubicablePorZona: r.reubicablePorZona === true, condicionesAplicacion: r.condicionesAplicacion ?? [],
    quienAporta: r.quienAporta ?? 'pendiente', instruccionesCliente: r.instruccionesCliente ?? null,
    camposEsperados: r.camposEsperados ?? [], ejemplosAutorizados: r.ejemplosAutorizados ?? [],
    generacionAutomatica: r.generacionAutomatica === true, orden: r.orden ?? i + 1, activo: r.activo !== false,
    validacionIdc: r.validacionIdc ?? 'pendiente',
  }));
}
