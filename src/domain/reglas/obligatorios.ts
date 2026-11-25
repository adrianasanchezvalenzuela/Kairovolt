import { evaluarChecklist } from '../checklist/checklist';
import { CAMPOS, type CampoDato } from '../validacion/campos';
import { vacio } from './comparacion';
import { paramLista, paramMapa } from './configuracion';
import { crearResultado } from './resultado';
import type { ConfiguracionTecnica } from '../entidades/configuracion-tecnica';
import type { Evaluador, ResultadoValidacion } from './tipos';

const etiquetas = (campos: readonly string[]) => campos.map((c) => CAMPOS[c as CampoDato]?.etiqueta ?? c).join('; ');

/** OBL-001: campos declarados pero vacíos, y campos obligatorios del tipo de documento que no se declararon. */
const obl001: Evaluador = (ctx, r) => {
  const regla = r('OBL-001');
  const requeridosPorTipo = paramMapa(regla, 'camposObligatoriosPorTipo');
  return ctx.documentos.flatMap((d): ResultadoValidacion[] => {
    const requeridos = (requeridosPorTipo[d.tipo] ?? []) as readonly string[];
    const vacios = d.datos.filter((x) => vacio(x.valor)).map((x) => x.campo);
    const faltantes = requeridos.filter((c) => !d.datos.some((x) => x.campo === c));
    if (vacios.length === 0 && faltantes.length === 0) {
      return d.datos.length === 0 && requeridos.length === 0 ? [] : [crearResultado(regla, {
        resultado: 'cumple', clave: d.id, campo: 'campos_obligatorios', documentosOrigen: [{ id: d.id, nombre: d.nombre, valor: null }],
        explicacion: `«${d.nombre}» no tiene campos vacíos.`, accionRecomendada: 'Ninguna.',
      })];
    }
    const partes = [
      vacios.length > 0 ? `Campos vacíos: ${etiquetas(vacios)}.` : '',
      faltantes.length > 0 ? `Campos obligatorios sin declarar: ${etiquetas(faltantes)}.` : '',
    ].filter(Boolean);
    return [crearResultado(regla, {
      resultado: 'no_cumple', clave: d.id, campo: 'campos_obligatorios', documentosOrigen: [{ id: d.id, nombre: d.nombre, valor: null }],
      valorEncontrado: [...new Set([...vacios, ...faltantes])].join(', '), valorEsperado: 'Todos los campos llenos',
      explicacion: partes.join(' '), accionRecomendada: 'Completa los campos y vuelve a cargar el documento.',
    })];
  });
};

/** OBL-002: documentos obligatorios del catálogo que faltan (el bloqueo de la compuerta lo decide `evaluarBloqueoCompuerta`). */
const obl002: Evaluador = (ctx, r) => {
  const regla = r('OBL-002');
  if (!ctx.requisitos || ctx.requisitos.length === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'No hay catálogo de requisitos para comparar.', accionRecomendada: 'Configura el catálogo de requisitos.' })];
  }
  const faltantes = evaluarChecklist(ctx.requisitos, ctx.documentos).flatMap((res) => res.faltantes);
  if (faltantes.length === 0) {
    return [crearResultado(regla, { resultado: 'cumple', explicacion: 'Están todos los documentos obligatorios.', accionRecomendada: 'Ninguna.' })];
  }
  return faltantes.map((f) => crearResultado(regla, {
    resultado: 'no_cumple', campo: `documento:${f.requisito.tipo}`, clave: f.requisito.tipo, compuerta: f.requisito.compuerta,
    valorEsperado: f.requisito.nombre,
    explicacion: `Falta el documento obligatorio «${f.requisito.nombre}» (${f.requisito.compuerta}).`,
    accionRecomendada: f.requisito.aportaCliente ? 'Solicítalo al cliente.' : 'Intégralo al expediente.',
  }));
};

/** OBL-003: datos técnicos que la configuración debe tener para poder validar el proyecto. */
const obl003: Evaluador = (ctx, r) => {
  const regla = r('OBL-003');
  const obligatorios = paramLista(regla, 'camposObligatorios') as readonly (keyof ConfiguracionTecnica)[];
  if (!ctx.configuracion) {
    return [crearResultado(regla, { resultado: 'no_cumple', valorEsperado: obligatorios.join(', '), explicacion: 'El proyecto no tiene configuración técnica.', accionRecomendada: 'Captura la configuración técnica.' })];
  }
  const c = ctx.configuracion;
  const faltantes = obligatorios.filter((k) => vacio(c[k]));
  return [crearResultado(regla, faltantes.length === 0
    ? { resultado: 'cumple', explicacion: 'La configuración técnica tiene todos los datos obligatorios.', accionRecomendada: 'Ninguna.' }
    : {
      resultado: 'no_cumple', valorEncontrado: faltantes.join(', '), valorEsperado: 'Todos los datos obligatorios',
      explicacion: `Faltan datos técnicos: ${faltantes.join(', ')}. Sin ellos algunas validaciones quedan «no evaluables».`,
      accionRecomendada: 'Captura estos datos desde los documentos del proyecto.',
    })];
};

export const evaluarObligatorios: Evaluador = (ctx, r) => [...obl001(ctx, r), ...obl002(ctx, r), ...obl003(ctx, r)];
