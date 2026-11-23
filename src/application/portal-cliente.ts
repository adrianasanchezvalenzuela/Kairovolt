import { NOMBRE_COMPUERTA, type CompuertaId, type EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { evaluarChecklist, progresoGlobal, type Progreso, type Requisito } from '@/domain/checklist/checklist';
import { evaluarActividad, type EstadoActividad } from '@/domain/cronograma/actividad';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { evaluarVigencias } from '@/domain/vigencias/vigencias';

export interface PendienteCliente {
  id: string;
  titulo: string;
  motivo: 'faltante' | 'vencido' | 'por_vencer';
  detalle: string;
}

/**
 * Proyección de solo lectura para el cliente. Es lo ÚNICO que debe llegar al portal:
 * no incluye hallazgos internos, valores discrepantes, observaciones, PAER/PPC ni responsables.
 */
export interface VistaPortalCliente {
  folio: string;
  nombre: string;
  ubicacion: string;
  esMock: boolean;
  avance: Progreso;
  compuertas: { id: CompuertaId; nombre: string; estado: EstadoCompuerta; recibidos: number; total: number }[];
  pendientesCliente: PendienteCliente[];
  proximosHitos: { id: string; nombre: string; compuerta: CompuertaId; finPlan: string; estado: Exclude<EstadoActividad, 'completada'> }[];
}

/** Puerto del portal: un adaptador real debe devolver directamente esta proyección desde el backend. */
export interface PortalClienteRepositorio {
  readonly origen: 'mock' | 'zoho';
  /** `hoy` ISO (YYYY-MM-DD). null = folio no encontrado. */
  consultar(folio: string, hoy: string): Promise<VistaPortalCliente | null>;
}

export const normalizarFolio = (folio: string): string => folio.trim().toUpperCase();

const MAX_HITOS = 4;

export function construirVistaPortal(proyecto: Proyecto, catalogo: readonly Requisito[], hoy: string): VistaPortalCliente {
  const resumenes = evaluarChecklist(catalogo, proyecto.documentos);
  const requisitosCliente = catalogo.filter((r) => r.aportaCliente);

  const faltantes: PendienteCliente[] = resumenes
    .flatMap((r) => r.faltantes)
    .filter((i) => i.requisito.aportaCliente)
    .map((i) => ({ id: `faltante:${i.requisito.id}`, titulo: i.requisito.nombre, motivo: 'faltante', detalle: 'Pendiente de entrega.' }));

  const vigencias = evaluarVigencias(requisitosCliente, proyecto.documentos, hoy).flatMap((h): PendienteCliente[] => {
    const nombre = h.evidencias[0]?.documentoNombre ?? h.titulo;
    if (h.subtipo === 'vencido') return [{ id: h.id, titulo: nombre, motivo: 'vencido', detalle: 'Documento vencido: entregue uno actualizado.' }];
    if (h.subtipo === 'por_vencer') return [{ id: h.id, titulo: nombre, motivo: 'por_vencer', detalle: 'Próximo a vencer: tenga listo uno actualizado.' }];
    return [];
  });

  const proximosHitos = proyecto.cronograma
    .map((a) => evaluarActividad(a, hoy))
    .flatMap((e) => (e.estado === 'completada' ? [] : [{
      id: e.actividad.id, nombre: e.actividad.nombre, compuerta: e.actividad.compuerta, finPlan: e.actividad.finPlan, estado: e.estado,
    }]))
    .sort((a, b) => a.finPlan.localeCompare(b.finPlan))
    .slice(0, MAX_HITOS);

  return {
    folio: proyecto.folio,
    nombre: proyecto.nombre,
    ubicacion: `${proyecto.municipio}, ${proyecto.estado}`,
    esMock: proyecto.esMock,
    avance: progresoGlobal(resumenes),
    compuertas: proyecto.compuertas.map((c) => {
      const r = resumenes.find((x) => x.compuerta === c.id);
      return { id: c.id, nombre: NOMBRE_COMPUERTA[c.id], estado: c.estado, recibidos: r?.recibidosObligatorios ?? 0, total: r?.totalObligatorios ?? 0 };
    }),
    pendientesCliente: [...faltantes, ...vigencias],
    proximosHitos,
  };
}
