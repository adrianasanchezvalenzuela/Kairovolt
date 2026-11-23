import type { Requisito } from '../checklist/checklist';
import type { DocumentoExpediente } from '../documentos/documento';
import { diasEntre } from '../fechas/fechas';
import type { Hallazgo } from '../validacion/hallazgo';

/** Umbral por defecto (días) para avisar de vencimiento próximo. Parámetro configurable, no regla de CFE. */
export const UMBRAL_POR_VENCER_DIAS = 30;

/**
 * Audita vigencias contra la fecha `hoy` (ISO). Solo usa fechas capturadas: no infiere vencimientos.
 */
export function evaluarVigencias(
  requisitos: readonly Requisito[],
  documentos: readonly DocumentoExpediente[],
  hoy: string,
  umbralDias: number = UMBRAL_POR_VENCER_DIAS,
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const ev = (d: DocumentoExpediente) => [{ documentoId: d.id, documentoNombre: d.nombre, valor: d.fechaVigencia }];

  for (const d of documentos) {
    if (d.fechaEmision && d.fechaVigencia && diasEntre(d.fechaEmision, d.fechaVigencia) < 0) {
      hallazgos.push({
        id: `vigencia:incoherente:${d.id}`, categoria: 'vigencia', subtipo: 'incoherente', severidad: 'bloqueante',
        titulo: `${d.nombre}: fechas incoherentes`,
        detalle: `La vigencia (${d.fechaVigencia}) es anterior a la emisión (${d.fechaEmision}).`,
        evidencias: ev(d),
      });
    }
  }

  const tiposConVigencia = new Set(requisitos.filter((r) => r.requiereVigencia).map((r) => r.tipo));
  for (const d of documentos.filter((x) => tiposConVigencia.has(x.tipo))) {
    if (!d.fechaVigencia) {
      hallazgos.push({
        id: `vigencia:sin-fecha:${d.id}`, categoria: 'vigencia', subtipo: 'sin_fecha', severidad: 'advertencia',
        titulo: `${d.nombre}: vigencia no capturada`,
        detalle: 'No se puede verificar la vigencia sin la fecha de vencimiento.',
        evidencias: ev(d),
      });
      continue;
    }
    const dias = diasEntre(hoy, d.fechaVigencia);
    if (dias < 0) {
      hallazgos.push({
        id: `vigencia:vencido:${d.id}`, categoria: 'vigencia', subtipo: 'vencido', severidad: 'bloqueante',
        titulo: `${d.nombre}: vencido`,
        detalle: `Venció el ${d.fechaVigencia} (hace ${-dias} día(s)).`,
        evidencias: ev(d),
      });
    } else if (dias <= umbralDias) {
      hallazgos.push({
        id: `vigencia:por-vencer:${d.id}`, categoria: 'vigencia', subtipo: 'por_vencer', severidad: 'advertencia',
        titulo: `${d.nombre}: por vencer`,
        detalle: `Vence el ${d.fechaVigencia} (en ${dias} día(s)).`,
        evidencias: ev(d),
      });
    }
  }
  return hallazgos;
}
