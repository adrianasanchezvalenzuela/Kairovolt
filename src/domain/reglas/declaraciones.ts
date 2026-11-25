import type { ConfiguracionStrings, ConfiguracionTecnica } from '../entidades/configuracion-tecnica';
import { CAMPOS, type CampoDato } from '../validacion/campos';
import { formatearCoordenadas, vacio, type Declaracion } from './comparacion';
import type { ContextoValidacion } from './tipos';

export const ID_CONFIGURACION = 'configuracion';
export const NOMBRE_CONFIGURACION = 'Configuración técnica del proyecto';

/**
 * Formato canónico de la configuración de strings: «NxM» (strings × paneles por string), ordenado y unido con «+».
 * Los documentos deben capturar el campo `configuracion_strings` en este mismo formato para poder compararse.
 */
export function serializarStrings(strings: readonly ConfiguracionStrings[]): string {
  return [...strings]
    .sort((a, b) => (a.mppt ?? 0) - (b.mppt ?? 0) || a.panelesPorString - b.panelesPorString)
    .map((s) => `${s.strings}x${s.panelesPorString}`)
    .join('+');
}

/** Valor que la configuración técnica del proyecto declara para un campo (null si no lo declara). */
export function valorDeConfiguracion(c: ConfiguracionTecnica | null | undefined, campo: CampoDato): string | number | null {
  if (!c) return null;
  switch (campo) {
    case 'nivel_tension': return c.nivelTension;
    case 'modelo_modulo': return c.modeloPanel;
    case 'modelo_inversor': return c.modeloInversor;
    case 'numero_paneles': return c.numeroPaneles;
    case 'potencia_dc_kwp': return c.potenciaDcKwpDeclarada;
    case 'potencia_ac_kw': return c.potenciaAcKw;
    case 'configuracion_strings': return c.strings && c.strings.length > 0 ? serializarStrings(c.strings) : null;
    case 'rpu': return c.rpu;
    case 'ubicacion': return c.coordenadas ? formatearCoordenadas(c.coordenadas) : null;
    case 'generacion_kwh_mes': return c.generacionEstimadaKwhMes;
    default: return null; // consumo y campos del croquis solo se declaran en documentos
  }
}

/** Todas las fuentes que declaran un valor NO vacío para el campo: documentos y, si existe, la configuración técnica. */
export function declaracionesDe(ctx: ContextoValidacion, campo: CampoDato): Declaracion[] {
  const deDocumentos = ctx.documentos.flatMap((d) =>
    d.datos.filter((x) => x.campo === campo && !vacio(x.valor)).map((x) => ({ origenId: d.id, origenNombre: d.nombre, valor: x.valor as string | number })),
  );
  const deConfig = valorDeConfiguracion(ctx.configuracion, campo);
  return vacio(deConfig) ? deDocumentos : [...deDocumentos, { origenId: ID_CONFIGURACION, origenNombre: NOMBRE_CONFIGURACION, valor: deConfig as string | number }];
}

export const etiquetaCampo = (campo: CampoDato): string => CAMPOS[campo].etiqueta;
export const unidadCampo = (campo: CampoDato): string => (CAMPOS[campo].unidad ? ` ${CAMPOS[campo].unidad}` : '');
