import { potenciaAcCalculadaKw, potenciaDcCalculadaKwp, totalPanelesEnStrings } from '../entidades/configuracion-tecnica';
import { type CampoDato } from '../validacion/campos';
import { normalizarTexto, numerosIguales, ordenDeMagnitud, parseCoordenadas, parseNumero, redondear, type Declaracion } from './comparacion';
import { paramLista, paramNum, paramTxt } from './configuracion';
import { declaracionesDe, ID_CONFIGURACION, NOMBRE_CONFIGURACION, unidadCampo } from './declaraciones';
import { crearResultado } from './resultado';
import type { ContextoValidacion, DefinicionRegla, DocumentoOrigen, Evaluador, ResultadoValidacion } from './tipos';

const origenDe = (d: Declaracion, campo: CampoDato): DocumentoOrigen => ({ id: d.origenId, nombre: d.origenNombre, valor: `${d.valor}${unidadCampo(campo)}` });
const nombreOrigen = (d: Declaracion) => (d.origenId === ID_CONFIGURACION ? NOMBRE_CONFIGURACION : `«${d.origenNombre}»`);

/** Compara cada valor declarado de `campo` contra un valor CALCULADO (la referencia). No modifica nada. */
function contraCalculo(
  regla: DefinicionRegla, ctx: ContextoValidacion, campo: CampoDato, calculado: number, formula: string,
): ResultadoValidacion[] {
  const fuentes = declaracionesDe(ctx, campo);
  if (fuentes.length === 0) {
    return [crearResultado(regla, {
      resultado: 'no_evaluable', valorEsperado: calculado,
      explicacion: `Nadie declara este valor para compararlo con el calculado (${formula} = ${calculado}).`,
      accionRecomendada: 'Captura el valor declarado en la configuración técnica o en los documentos.',
    })];
  }
  return fuentes.map((f) => {
    const v = parseNumero(f.valor);
    const ok = v !== null && numerosIguales(v, calculado, paramNum(regla, 'toleranciaRelativa', 0.005), paramNum(regla, 'toleranciaAbsoluta', 0));
    return crearResultado(regla, {
      resultado: ok ? 'cumple' : 'no_cumple', clave: f.origenId, documentosOrigen: [origenDe(f, campo)], valorEncontrado: v ?? String(f.valor), valorEsperado: calculado,
      explicacion: ok
        ? `${nombreOrigen(f)} declara ${f.valor}, igual al calculado (${formula} = ${calculado}).`
        : `${nombreOrigen(f)} declara ${f.valor}, pero el cálculo (${formula}) da ${calculado}. Requiere confirmación humana; el sistema no corrige ninguno de los dos.`,
      accionRecomendada: ok ? 'Ninguna.' : 'Revisa el número de equipos y la potencia por equipo; corrige el dato que esté mal y vuelve a cargar el documento.',
    });
  });
}

const tec001: Evaluador = (ctx, r) => {
  const regla = r('TEC-001');
  const dc = ctx.configuracion ? potenciaDcCalculadaKwp(ctx.configuracion) : null;
  const c = ctx.configuracion;
  if (dc === null || !c) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'Faltan el número de paneles o la potencia por panel para calcular la potencia DC.', accionRecomendada: 'Captura ambos datos en la configuración técnica.' })];
  }
  return contraCalculo(regla, ctx, 'potencia_dc_kwp', dc, `${c.numeroPaneles} paneles × ${c.potenciaPanelW} W ÷ 1000`);
};

const tec002: Evaluador = (ctx, r) => {
  const regla = r('TEC-002');
  const c = ctx.configuracion;
  const ac = c ? potenciaAcCalculadaKw(c) : null;
  if (ac === null || !c) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'Faltan el número de inversores o la potencia por inversor para calcular la potencia AC.', accionRecomendada: 'Captura ambos datos en la configuración técnica.' })];
  }
  return contraCalculo(regla, ctx, 'potencia_ac_kw', ac, `${c.numeroInversores} inversores × ${c.potenciaInversorKw} kW`);
};

const tec003: Evaluador = (ctx, r) => {
  const regla = r('TEC-003');
  const c = ctx.configuracion;
  const dc = c ? potenciaDcCalculadaKwp(c) : null;
  const ac = c ? (c.potenciaAcKw ?? potenciaAcCalculadaKw(c)) : null;
  if (dc === null || ac === null || ac === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'Faltan datos para calcular la relación DC/AC.', accionRecomendada: 'Completa la configuración técnica.' })];
  }
  const min = paramNum(regla, 'relacionMin', 1);
  const max = paramNum(regla, 'relacionMax', 1.5);
  const razon = redondear(dc / ac, 3);
  const ok = razon >= min && razon <= max;
  return [crearResultado(regla, {
    resultado: ok ? 'cumple' : 'no_cumple', valorEncontrado: razon, valorEsperado: `${min} – ${max}`,
    explicacion: `Relación DC/AC = ${dc} kWp ÷ ${ac} kW = ${razon}${ok ? ', dentro del rango de referencia' : `, fuera del rango de referencia ${min} – ${max}`}.`,
    accionRecomendada: ok ? 'Ninguna.' : 'Revisa el dimensionamiento con el proyectista; el rango es una referencia por confirmar con IDC.',
  })];
};

const tec004: Evaluador = (ctx, r) => {
  const regla = r('TEC-004');
  const c = ctx.configuracion;
  const enStrings = c ? totalPanelesEnStrings(c) : null;
  if (!c || enStrings === null || c.numeroPaneles === null) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'Falta la configuración de strings o el número de paneles.', accionRecomendada: 'Captura los strings (cuántos y de cuántos paneles) en la configuración técnica.' })];
  }
  const ok = enStrings === c.numeroPaneles;
  return [crearResultado(regla, {
    resultado: ok ? 'cumple' : 'no_cumple', valorEncontrado: enStrings, valorEsperado: c.numeroPaneles,
    explicacion: ok ? `Los strings suman ${enStrings} paneles, igual al total declarado.` : `Los strings suman ${enStrings} paneles pero el total declarado es ${c.numeroPaneles}. Requiere confirmación humana; el sistema no ajusta ninguno.`,
    accionRecomendada: ok ? 'Ninguna.' : 'Revisa el diagrama unifilar y la memoria de cálculo para ver cuál de los dos números es el correcto.',
  })];
};

const tec005: Evaluador = (ctx, r) => {
  const regla = r('TEC-005');
  const c = ctx.configuracion;
  const voc = c?.fichaPanel?.vocV ?? null;
  const coef = c?.fichaPanel?.coefTempVocPorCiento ?? null;
  const vmax = c?.fichaInversor?.vdcMaxV ?? null;
  const faltan = [voc === null && 'Voc del panel', coef === null && 'coeficiente de temperatura del Voc', vmax === null && 'tensión DC máxima del inversor', (!c?.strings || c.strings.length === 0) && 'configuración de strings'].filter(Boolean);
  if (!c || voc === null || coef === null || vmax === null || !c.strings || c.strings.length === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: `Faltan datos de las fichas técnicas: ${faltan.join(', ')}.`, accionRecomendada: 'Captura estos datos desde las fichas técnicas del módulo y del inversor.' })];
  }
  const tmin = paramNum(regla, 'temperaturaMinimaC', 0);
  const factorFrio = 1 + (Math.abs(coef) / 100) * (25 - tmin);
  const peor = Math.max(...c.strings.map((s) => s.panelesPorString));
  const vFrio = redondear(peor * voc * factorFrio, 1);
  const ok = vFrio <= vmax;
  return [crearResultado(regla, {
    resultado: ok ? 'cumple' : 'no_cumple', valorEncontrado: vFrio, valorEsperado: `≤ ${vmax} V`,
    explicacion: `String más largo: ${peor} paneles × ${voc} V × ${redondear(factorFrio, 3)} (frío ${tmin} °C) = ${vFrio} V frente a ${vmax} V del inversor.`,
    accionRecomendada: ok ? 'Ninguna.' : 'Reduce los paneles por string o usa otro inversor; confirma con el proyectista.',
  })];
};

const tec006: Evaluador = (ctx, r) => {
  const regla = r('TEC-006');
  const dc = ctx.configuracion ? potenciaDcCalculadaKwp(ctx.configuracion) : null;
  if (dc === null) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'Sin potencia DC calculada no hay referencia física de generación.', accionRecomendada: 'Completa la configuración técnica.' })];
  }
  const hsp = paramNum(regla, 'horasSolaresPico', 6);
  const pr = paramNum(regla, 'rendimiento', 0.8);
  const dias = paramNum(regla, 'diasMes', 30);
  const ref = redondear(dc * hsp * pr * dias, 2);
  const fuentes = declaracionesDe(ctx, 'generacion_kwh_mes');
  if (fuentes.length === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', valorEsperado: ref, explicacion: `Nadie declara la generación estimada (referencia física: ${ref} kWh/mes).`, accionRecomendada: 'Captura la generación estimada declarada.' })];
  }
  const tol = paramNum(regla, 'toleranciaRelativa', 0.15);
  return fuentes.map((f) => {
    const v = parseNumero(f.valor);
    const ok = v !== null && Math.abs(v - ref) <= tol * ref;
    const factor = v !== null && !ok ? ordenDeMagnitud(v, ref, 0.1) : null;
    const pista = factor !== null ? ` Difiere casi exactamente ×${factor} de la referencia: posible punto decimal mal ubicado (solo una pista).` : '';
    return crearResultado(regla, {
      resultado: ok ? 'cumple' : 'no_cumple', clave: f.origenId, documentosOrigen: [origenDe(f, 'generacion_kwh_mes')], valorEncontrado: v ?? String(f.valor), valorEsperado: ref,
      explicacion: `${nombreOrigen(f)} declara ${f.valor} kWh/mes; la referencia física es ${ref} kWh/mes (${dc} kWp × ${hsp} HSP × ${pr} × ${dias} días), con tolerancia ${redondear(tol * 100, 0)} %.${pista}${ok ? '' : ' Es solo una referencia: requiere confirmación humana y no se corrige ningún valor.'}`,
      accionRecomendada: ok ? 'Ninguna.' : 'Confirma cómo se calculó la generación estimada y corrige el documento si corresponde.',
    });
  });
};

const tec007: Evaluador = (ctx, r) => {
  const regla = r('TEC-007');
  const fuentes = declaracionesDe(ctx, 'rpu');
  if (fuentes.length === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'No hay RPU declarado.', accionRecomendada: 'Captura el RPU del recibo de CFE.' })];
  }
  const patron = new RegExp(paramTxt(regla, 'patron', '^[A-Za-z0-9]{12}$'));
  return fuentes.map((f) => {
    const ok = patron.test(String(f.valor).trim());
    return crearResultado(regla, {
      resultado: ok ? 'cumple' : 'no_cumple', clave: f.origenId, documentosOrigen: [origenDe(f, 'rpu')], valorEncontrado: String(f.valor), valorEsperado: `Formato ${patron.source}`,
      explicacion: ok ? `El RPU de ${nombreOrigen(f)} tiene el formato esperado.` : `El RPU de ${nombreOrigen(f)} («${f.valor}») no tiene el formato esperado (${patron.source}).`,
      accionRecomendada: ok ? 'Ninguna.' : 'Compara el RPU contra el recibo de CFE; el formato esperado es un supuesto por confirmar.',
    });
  });
};

const tec008: Evaluador = (ctx, r) => {
  const regla = r('TEC-008');
  const fuentes = declaracionesDe(ctx, 'ubicacion');
  if (fuentes.length === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'No hay coordenadas declaradas.', accionRecomendada: 'Captura las coordenadas del sitio.' })];
  }
  const area = paramLista(regla, 'areaEsperada').map(Number);
  const [latMin = -90, latMax = 90, lonMin = -180, lonMax = 180] = area;
  return fuentes.map((f) => {
    const c = parseCoordenadas(String(f.valor));
    const dentro = c !== null && c.lat >= latMin && c.lat <= latMax && c.lon >= lonMin && c.lon <= lonMax;
    return crearResultado(regla, {
      resultado: dentro ? 'cumple' : 'no_cumple', clave: f.origenId, documentosOrigen: [origenDe(f, 'ubicacion')], valorEncontrado: String(f.valor), valorEsperado: `lat ${latMin}–${latMax}, lon ${lonMin}–${lonMax}`,
      explicacion: c === null
        ? `Las coordenadas de ${nombreOrigen(f)} («${f.valor}») no tienen el formato «lat,lon».`
        : dentro ? `Las coordenadas de ${nombreOrigen(f)} están dentro del área esperada.` : `Las coordenadas de ${nombreOrigen(f)} (${f.valor}) quedan fuera del área esperada. Requiere confirmación humana.`,
      accionRecomendada: dentro ? 'Ninguna.' : 'Verifica las coordenadas contra el croquis y el domicilio; el área esperada es un supuesto por confirmar.',
    });
  });
};

const tec009: Evaluador = (ctx, r) => {
  const regla = r('TEC-009');
  const fuentes = declaracionesDe(ctx, 'nivel_tension');
  if (fuentes.length === 0) {
    return [crearResultado(regla, { resultado: 'no_evaluable', explicacion: 'No hay nivel de tensión declarado.', accionRecomendada: 'Captura el nivel de tensión (MT o BT).' })];
  }
  const permitidos = paramLista(regla, 'valoresPermitidos').map((v) => normalizarTexto(v));
  return fuentes.map((f) => {
    const ok = permitidos.includes(normalizarTexto(f.valor));
    return crearResultado(regla, {
      resultado: ok ? 'cumple' : 'no_cumple', clave: f.origenId, documentosOrigen: [origenDe(f, 'nivel_tension')], valorEncontrado: String(f.valor), valorEsperado: permitidos.join(' / '),
      explicacion: ok ? `${nombreOrigen(f)} declara un nivel de tensión válido (${f.valor}).` : `${nombreOrigen(f)} declara «${f.valor}», que no es un nivel de tensión válido (${permitidos.join(', ')}).`,
      accionRecomendada: ok ? 'Ninguna.' : 'Corrige el nivel de tensión en el documento.',
    });
  });
};

/** TEC-001 a TEC-009: coherencia técnica. Cada resultado trae el valor calculado o de referencia; nunca corrige el dato. */
export const evaluarTecnicas: Evaluador = (ctx, r) => [tec001, tec002, tec003, tec004, tec005, tec006, tec007, tec008, tec009].flatMap((e) => e(ctx, r));
