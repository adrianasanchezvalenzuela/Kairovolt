import type { Observacion, EstadoObservacion, OrigenObservacion } from '../../src/domain/observaciones/observacion';
import { seg, type ClienteZoho } from './cliente';
import { normalizarFecha } from './lectura';
import { MAPEO_ZOHO as M } from './mapeo';

export const ESTADOS_OBSERVACION: readonly EstadoObservacion[] = ['abierta', 'en_atencion', 'cerrada'];
export const ORIGENES_OBSERVACION: readonly OrigenObservacion[] = ['cfe', 'uvie', 'interna'];

// Formato escrito por `sincronizarObservacion` (escritura.ts). Si cambia allá, cambia aquí.
const FORMATO = /^(?<desc>[\s\S]*?)\n\nCompuerta: (?<comp>G[0-3]) · Origen: (?<origen>.+?) · Estado: (?<estado>.+)\nResponsable: (?<resp>.+?) · Compromiso: (?<compromiso>.+)\n\[KV-OBS:(?<id>[^:\]]+):(?<est>[^\]]+)\]\s*$/;

/**
 * Reconstruye las observaciones de KairóVolt a partir de las notas del trato.
 * Cada cambio de estado es una nota nueva: la más reciente define el estado; la primera, la fecha de registro.
 */
export async function leerObservaciones(cli: ClienteZoho, dealId: string): Promise<Observacion[]> {
  const nc = M.crm.notas.campos;
  const res = await cli.crm<{ data?: Record<string, unknown>[] }>(
    'GET', `/crm/v6/${M.crm.deals.modulo}/${seg(dealId)}/Notes?fields=${nc.titulo},${nc.contenido},Created_Time&per_page=200`,
  );

  const notas = (res.data ?? [])
    .map((n) => ({ contenido: typeof n[nc.contenido] === 'string' ? (n[nc.contenido] as string) : '', creada: typeof n.Created_Time === 'string' ? n.Created_Time : '' }))
    .sort((a, b) => a.creada.localeCompare(b.creada)); // de la más antigua a la más reciente

  const porId = new Map<string, Observacion>();
  for (const { contenido, creada } of notas) {
    const g = FORMATO.exec(contenido)?.groups;
    if (!g) continue; // notas que no son de KairóVolt
    const id = g.id!;
    const registro = porId.get(id)?.fechaRegistro ?? normalizarFecha(creada) ?? '';
    porId.set(id, {
      id,
      origen: (ORIGENES_OBSERVACION as readonly string[]).includes(g.origen!) ? (g.origen as OrigenObservacion) : 'interna',
      compuerta: g.comp as Observacion['compuerta'],
      descripcion: g.desc!.trim(),
      estado: (ESTADOS_OBSERVACION as readonly string[]).includes(g.estado!) ? (g.estado as EstadoObservacion) : 'abierta',
      fechaRegistro: registro,
      fechaCompromiso: g.compromiso === 'sin fecha' ? null : normalizarFecha(g.compromiso),
      responsable: g.resp === 'sin asignar' ? null : g.resp!,
    });
  }
  return [...porId.values()].sort((a, b) => a.fechaRegistro.localeCompare(b.fechaRegistro));
}
