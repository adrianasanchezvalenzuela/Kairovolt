import type { Hallazgo, SubtipoHallazgo } from '../validacion/hallazgo';
import { CAMPOS, type CampoDato } from '../validacion/campos';
import type { ResultadoValidacion } from './tipos';

/**
 * Compatibilidad: convierte los resultados del motor a la forma antigua `Hallazgo` que usa la interfaz actual.
 * La lógica vive SOLO en las reglas; aquí no se evalúa nada. Los ids y títulos son los de siempre.
 */

const VIGENCIA: Record<string, { sufijo: string; subtipo: SubtipoHallazgo; titulo: string }> = {
  'VIG-001': { sufijo: 'vencido', subtipo: 'vencido', titulo: 'vencido' },
  'VIG-002': { sufijo: 'por-vencer', subtipo: 'por_vencer', titulo: 'por vencer' },
  'VIG-003': { sufijo: 'sin-fecha', subtipo: 'sin_fecha', titulo: 'vigencia no capturada' },
  'VIG-004': { sufijo: 'incoherente', subtipo: 'incoherente', titulo: 'fechas incoherentes' },
};

const severidadAntigua = (r: ResultadoValidacion): Hallazgo['severidad'] => (r.severidad === 'bloqueante' ? 'bloqueante' : 'advertencia');

/** Solo los resultados que NO cumplen se convierten en hallazgos. Los de otras reglas (técnicas, documentos) no tienen forma antigua. */
export function aHallazgos(resultados: readonly ResultadoValidacion[]): Hallazgo[] {
  return resultados.flatMap((r): Hallazgo[] => {
    if (r.resultado !== 'no_cumple') return [];
    const doc = r.documentosOrigen[0];

    if (r.categoria === 'cruzada') {
      return [{
        id: `discrepancia:${r.campo}`, categoria: 'discrepancia', severidad: severidadAntigua(r),
        titulo: `${CAMPOS[r.campo as CampoDato].etiqueta}: valores distintos entre documentos`, detalle: r.explicacion,
        evidencias: r.documentosOrigen.map((d) => ({ documentoId: d.id, documentoNombre: d.nombre, valor: d.valor === null ? null : String(d.valor) })),
      }];
    }
    if (r.reglaId === 'OBL-001' && doc) {
      return [{
        id: `incompleto:${doc.id}`, categoria: 'campo_incompleto', severidad: severidadAntigua(r),
        titulo: `${doc.nombre}: campos incompletos`, detalle: r.explicacion,
        evidencias: [{ documentoId: doc.id, documentoNombre: doc.nombre, valor: null }],
      }];
    }
    const v = VIGENCIA[r.reglaId];
    if (v && doc) {
      return [{
        id: `vigencia:${v.sufijo}:${doc.id}`, categoria: 'vigencia', subtipo: v.subtipo, severidad: severidadAntigua(r),
        titulo: `${doc.nombre}: ${v.titulo}`, detalle: r.explicacion,
        evidencias: [{ documentoId: doc.id, documentoNombre: doc.nombre, valor: doc.valor === null ? null : String(doc.valor) }],
      }];
    }
    return [];
  });
}
