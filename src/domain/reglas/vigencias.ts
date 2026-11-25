import { diasEntre } from '../fechas/fechas';
import { paramNum } from './configuracion';
import { crearResultado } from './resultado';
import type { Evaluador, ResultadoValidacion } from './tipos';

/**
 * VIG-001 a VIG-004. Solo usa fechas capturadas: nunca infiere un vencimiento. La vigencia se audita en los documentos cuyo
 * requisito del catálogo la exige; las fechas incoherentes se revisan en todos los documentos.
 */
export const evaluarVigencias: Evaluador = (ctx, r) => {
  const out: ResultadoValidacion[] = [];
  const origen = (d: (typeof ctx.documentos)[number]) => [{ id: d.id, nombre: d.nombre, valor: d.fechaVigencia }];

  const incoherente = r('VIG-004');
  for (const d of ctx.documentos) {
    if (d.fechaEmision && d.fechaVigencia && diasEntre(d.fechaEmision, d.fechaVigencia) < 0) {
      out.push(crearResultado(incoherente, {
        resultado: 'no_cumple', clave: d.id, documentosOrigen: origen(d), valorEncontrado: d.fechaVigencia, valorEsperado: `Posterior a ${d.fechaEmision}`,
        explicacion: `La vigencia (${d.fechaVigencia}) es anterior a la emisión (${d.fechaEmision}).`,
        accionRecomendada: 'Revisa las fechas del documento; una de las dos está mal capturada.',
      }));
    }
  }

  const tipos = new Set((ctx.requisitos ?? []).filter((q) => q.requiereVigencia).map((q) => q.tipo));
  const vencido = r('VIG-001');
  const porVencer = r('VIG-002');
  const sinFecha = r('VIG-003');
  const umbral = paramNum(porVencer, 'umbralDias', 30);
  const urgente = paramNum(porVencer, 'diasUrgente', 7);

  for (const d of ctx.documentos.filter((x) => tipos.has(x.tipo))) {
    if (!d.fechaVigencia) {
      out.push(crearResultado(sinFecha, {
        resultado: 'no_cumple', clave: d.id, documentosOrigen: origen(d),
        explicacion: 'No se puede verificar la vigencia sin la fecha de vencimiento.', accionRecomendada: 'Captura la fecha de vencimiento del documento.',
      }));
      continue;
    }
    const dias = diasEntre(ctx.hoy, d.fechaVigencia);
    if (dias < 0) {
      out.push(crearResultado(vencido, {
        resultado: 'no_cumple', clave: d.id, documentosOrigen: origen(d), valorEncontrado: d.fechaVigencia, valorEsperado: `Vigente al ${ctx.hoy}`,
        explicacion: `Venció el ${d.fechaVigencia} (hace ${-dias} día(s)).`, accionRecomendada: 'Solicita un documento vigente y súbelo como versión nueva.',
      }));
    } else if (dias <= umbral) {
      out.push(crearResultado(porVencer, {
        resultado: 'no_cumple', clave: d.id, documentosOrigen: origen(d), valorEncontrado: d.fechaVigencia, valorEsperado: `Más de ${umbral} días de vigencia`,
        severidadForzada: dias <= urgente ? 'mayor' : undefined,
        explicacion: `Vence el ${d.fechaVigencia} (en ${dias} día(s)).`, accionRecomendada: 'Ten listo un documento vigente antes de que venza.',
      }));
    } else {
      out.push(crearResultado(vencido, {
        resultado: 'cumple', clave: d.id, documentosOrigen: origen(d), valorEncontrado: d.fechaVigencia,
        explicacion: `Vigente hasta el ${d.fechaVigencia} (en ${dias} día(s)).`, accionRecomendada: 'Ninguna.',
      }));
    }
  }
  return out;
};
