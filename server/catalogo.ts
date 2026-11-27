import type { Requisito } from '../src/domain/checklist/checklist';
import type { TipoDocumento } from '../src/domain/documentos/documento';
import type { RequisitoDocumental, FilaCatalogoSupabase } from '../src/domain/checklist/catalogo';
import { comoRequisitoChecklist, mapearFilaCatalogo } from '../src/domain/checklist/catalogo';
import { catalogoRequisitosBase } from '../src/data/catalogo-requisitos.mock';
import { SupabaseError, type ClienteSupabase } from './supabase/cliente';
import {
  guiasDemo,
  type CategoriaPortal,
  type EmisorDocumento,
  type RequiereEntregaFisica,
} from '../src/domain/checklist/preparacion';

interface MetaMediaTension {
  nombre: string;
  categoriaPortal: CategoriaPortal;
  emisor: EmisorDocumento;
  requiereEntregaFisica: RequiereEntregaFisica;
  permiteMultiples?: boolean;
  orden: number;
}

/**
 * Los 11 requisitos del escenario de demostración de media tensión.
 * Reutiliza el catálogo canónico existente (no crea un catálogo independiente).
 * Todos permiten que el cliente los aporte digitalmente en el portal; se separa quién emite/elabora
 * de quién puede subir el archivo, y IDC conserva siempre la revisión y validación definitiva.
 */
export const CATALOGO_MEDIA_TENSION_DEMO: Partial<Record<TipoDocumento, MetaMediaTension>> = {
  recibo_cfe: {
    nombre: 'Recibo CFE del último corte, sin adeudos',
    categoriaPortal: 'servicio_electrico',
    emisor: 'cfe',
    requiereEntregaFisica: 'si',
    orden: 1,
  },
  identificacion_oficial: {
    nombre: 'Identificación oficial vigente del propietario o representante',
    categoriaPortal: 'identificacion_datos',
    emisor: 'cliente',
    requiereEntregaFisica: 'si',
    orden: 2,
  },
  constancia_situacion_fiscal: {
    nombre: 'Constancia de Situación Fiscal',
    categoriaPortal: 'identificacion_datos',
    emisor: 'sat',
    requiereEntregaFisica: 'si',
    orden: 3,
  },
  carta_poder: {
    nombre: 'Carta Poder con identificaciones correspondientes',
    categoriaPortal: 'identificacion_datos',
    emisor: 'cliente',
    requiereEntregaFisica: 'si',
    orden: 4,
  },
  croquis: {
    nombre: 'Croquis',
    categoriaPortal: 'ubicacion_instalacion',
    emisor: 'cliente',
    requiereEntregaFisica: 'si',
    orden: 5,
  },
  diagrama_unifilar: {
    nombre: 'Diagrama unifilar',
    categoriaPortal: 'documentacion_tecnica',
    emisor: 'especialista',
    requiereEntregaFisica: 'si',
    orden: 6,
  },
  ficha_tecnica: {
    nombre: 'Fichas técnicas de paneles e inversor',
    categoriaPortal: 'documentacion_tecnica',
    emisor: 'fabricante',
    requiereEntregaFisica: 'si',
    orden: 7,
  },
  certificado: {
    nombre: 'Certificados UL de paneles e inversor',
    categoriaPortal: 'documentacion_tecnica',
    emisor: 'fabricante',
    requiereEntregaFisica: 'si',
    orden: 8,
  },
  solicitud: {
    nombre: 'Formato de solicitud para interconexión',
    categoriaPortal: 'solicitudes_verificaciones',
    emisor: 'idc',
    requiereEntregaFisica: 'si',
    orden: 9,
  },
  evidencia_fotografica: {
    nombre: 'Fotos del sistema funcionando',
    categoriaPortal: 'ubicacion_instalacion',
    emisor: 'instalador',
    requiereEntregaFisica: 'si',
    permiteMultiples: true,
    orden: 10,
  },
  dictamen_uvie: {
    nombre: 'Dictamen de verificación UVIE',
    categoriaPortal: 'solicitudes_verificaciones',
    emisor: 'uvie',
    requiereEntregaFisica: 'si',
    orden: 11,
  },
};

export const TIPOS_MEDIA_TENSION_DEMO: readonly TipoDocumento[] = [
  'recibo_cfe',
  'identificacion_oficial',
  'constancia_situacion_fiscal',
  'carta_poder',
  'croquis',
  'diagrama_unifilar',
  'ficha_tecnica',
  'certificado',
  'solicitud',
  'evidencia_fotografica',
  'dictamen_uvie',
];

const CAMPOS_BASE =
  'id,codigo,tipo_documento,nombre,descripcion,categoria,compuerta,canal,obligatorio,condicion,condiciones_aplicacion,requiere_vigencia,aporta_cliente,quien_aporta,instrucciones_cliente,campos_esperados,ejemplos_autorizados,generacion_automatica,orden,activo,validacion_idc,guia_preparacion,revision_digital';
const CAMPOS_EXTENDIDOS =
  CAMPOS_BASE + ',categoria_portal,emisor_documento,permite_multiples_archivos,requiere_entrega_fisica';

/** Lee catálogo canónico con service_role. Soporta esquemas antes y después de la migración 016. */
export async function leerCatalogoSupabase(sb: ClienteSupabase, soloActivos = true): Promise<RequisitoDocumental[]> {
  const filtro = soloActivos ? '&activo=eq.true' : '';
  try {
    const filas = await sb.rest<FilaCatalogoSupabase[]>(
      'GET',
      `/requisitos_documentales?select=${CAMPOS_EXTENDIDOS}${filtro}&order=orden.asc,codigo.asc`,
    );
    return (filas ?? []).map(mapearFilaCatalogo);
  } catch (error) {
    if (error instanceof SupabaseError && error.codigo === '42703') {
      const filas = await sb.rest<FilaCatalogoSupabase[]>(
        'GET',
        `/requisitos_documentales?select=${CAMPOS_BASE}${filtro}&order=orden.asc,codigo.asc`,
      );
      return (filas ?? []).map(mapearFilaCatalogo);
    }
    throw error;
  }
}

export function requisitosChecklist(catalogo: readonly RequisitoDocumental[]): Requisito[] {
  return catalogo.filter((r) => r.activo && r.tipo !== null && r.compuerta !== null).map(comoRequisitoChecklist);
}

/** Solo el modo de demostración usa las fixtures locales. */
export function catalogoDeDemostracion(mediaTension = false): RequisitoDocumental[] {
  return catalogoRequisitosBase.map((r, i) => {
    const metaMt = CATALOGO_MEDIA_TENSION_DEMO[r.tipo];
    const esCondicionalMoral = r.tipo === 'acta_constitutiva';
    const base: RequisitoDocumental = {
      guiaPreparacion: guiasDemo[r.tipo],
      revisionDigital: r.aportaCliente ? 'opcional' : 'no_disponible',
      ...(metaMt && {
        categoriaPortal: metaMt.categoriaPortal,
        emisorDocumento: metaMt.emisor,
        requiereEntregaFisica: metaMt.requiereEntregaFisica,
        permiteMultiplesArchivos: metaMt.permiteMultiples === true,
      }),
      ...(esCondicionalMoral && {
        categoriaPortal: 'identificacion_datos' as CategoriaPortal,
        emisorDocumento: 'cliente' as EmisorDocumento,
        requiereEntregaFisica: 'por_confirmar' as RequiereEntregaFisica,
      }),
      id: r.id,
      codigo: r.codigo ?? `KV_${r.tipo.toUpperCase()}`,
      tipo: r.tipo,
      nombre: r.nombre,
      descripcion: r.descripcion ?? r.nombre,
      categoria: r.categoria ?? 'pendiente',
      compuerta: r.compuerta,
      canal: r.canal,
      obligatorio: r.obligatorio,
      condicion: r.condicion ?? null,
      requiereVigencia: r.requiereVigencia === true,
      aportaCliente: r.aportaCliente === true,
      reubicablePorZona: r.reubicablePorZona === true,
      condicionesAplicacion: r.condicionesAplicacion ?? [],
      quienAporta: r.quienAporta ?? 'pendiente',
      instruccionesCliente: r.instruccionesCliente ?? null,
      camposEsperados: r.camposEsperados ?? [],
      ejemplosAutorizados: r.ejemplosAutorizados ?? [],
      generacionAutomatica: r.generacionAutomatica === true,
      orden: r.orden ?? i + 1,
      activo: r.activo !== false,
      validacionIdc: r.validacionIdc ?? 'pendiente',
    };

    if (!mediaTension) return base;

    if (metaMt) {
      return {
        ...base,
        nombre: metaMt.nombre,
        categoriaPortal: metaMt.categoriaPortal,
        emisorDocumento: metaMt.emisor,
        requiereEntregaFisica: metaMt.requiereEntregaFisica,
        permiteMultiplesArchivos: metaMt.permiteMultiples === true,
        aportaCliente: true,
        quienAporta: 'cliente',
        revisionDigital: 'opcional',
        generacionAutomatica: r.tipo === 'carta_poder',
        validacionIdc: 'validado',
        orden: metaMt.orden,
        activo: true,
      };
    }

    if (esCondicionalMoral) {
      // Se conserva en el catálogo global con aplicabilidad explícita: para persona física resulta no_aplica.
      return {
        ...base,
        obligatorio: false,
        condicion: 'Solo aplica cuando el titular es persona moral o requiere acreditar propiedad/posesión',
        condicionesAplicacion: [{ campo: 'tipo_titular', operador: 'igual', valor: 'moral' }],
        aportaCliente: true,
        quienAporta: 'cliente',
        revisionDigital: 'opcional',
        validacionIdc: 'validado',
        activo: true,
        orden: 12,
      };
    }

    return { ...base, activo: false };
  });
}
