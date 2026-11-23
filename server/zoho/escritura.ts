import type { CompuertaId, EstadoCompuerta } from '../../src/domain/compuertas/compuerta';
import { seg, type ClienteZoho } from './cliente';
import { leerProyectos } from './lectura';
import { MAPEO_ZOHO as M, type MapeoZoho } from './mapeo';

export type CodigoSync =
  | 'proyecto_no_encontrado'
  | 'sin_proyecto_projects'
  | 'sin_trato_crm'
  | 'tarea_no_encontrada'
  | 'portal_no_configurado'
  | 'estado_sin_id'
  | 'respuesta_inesperada';

export class SyncError extends Error {
  constructor(readonly codigo: CodigoSync, message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export const COMPUERTAS: readonly CompuertaId[] = ['G0', 'G1', 'G2', 'G3'];
export const ESTADOS: readonly EstadoCompuerta[] = ['pendiente', 'en_revision', 'liberada', 'bloqueada'];

interface Peticion { metodo: 'PATCH' | 'POST'; servicio: 'Projects' | 'CRM'; ruta: string; cuerpo: unknown }

export type ResultadoSync =
  | { resultado: 'simulado'; peticion: Peticion }
  | { resultado: 'sin_cambios'; detalle: string }
  | { resultado: 'sincronizado'; detalle: string };

export interface CambioCompuerta { folio: string; compuerta: CompuertaId; estado: EstadoCompuerta; simular?: boolean }

/** Cambia el estado de la tarea de la compuerta en Zoho Projects. Con `simular` no escribe nada. */
export async function sincronizarCompuerta(cli: ClienteZoho, cambio: CambioCompuerta, mapeo: MapeoZoho = M): Promise<ResultadoSync> {
  if (!cli.portalId) throw new SyncError('portal_no_configurado', 'Falta ZOHO_PROJECTS_PORTAL_ID.');
  const [proyecto] = (await leerProyectos(cli, { folio: cambio.folio })).proyectos;
  if (!proyecto) throw new SyncError('proyecto_no_encontrado', `No hay proyecto ${cambio.folio} en Zoho.`);
  if (!proyecto.proyecto) throw new SyncError('sin_proyecto_projects', `${proyecto.folio} no tiene proyecto en Zoho Projects.`);
  const tarea = proyecto.compuertas.find((c) => c.compuerta === cambio.compuerta);
  if (!tarea) throw new SyncError('tarea_no_encontrada', `${proyecto.folio} no tiene una tarea para ${cambio.compuerta}.`);
  if (tarea.estado === cambio.estado) return { resultado: 'sin_cambios', detalle: `${cambio.compuerta} ya está en ${cambio.estado} en Zoho.` };

  // ID del estado destino: el configurado o el que ya use otra tarea con un estado equivalente.
  const destino = mapeo.projects.estadosCompuerta[cambio.estado];
  const nombres = destino.nombres.map((n) => n.toLowerCase());
  const idAprendido = proyecto.compuertas.find((c) => c.estadoZohoId && c.estadoZoho && nombres.includes(c.estadoZoho.toLowerCase()))?.estadoZohoId;
  const idEstado = destino.id ?? idAprendido ?? null;
  if (!idEstado) {
    throw new SyncError('estado_sin_id', `No se conoce el ID del estado "${cambio.estado}" en Zoho Projects. Complétalo en server/zoho/mapeo.ts (estadosCompuerta.${cambio.estado}.id).`);
  }

  const peticion: Peticion = {
    metodo: 'PATCH', servicio: 'Projects',
    ruta: `/api/v3/portal/${seg(cli.portalId)}/projects/${seg(proyecto.proyecto.id)}/tasks/${seg(tarea.tareaId)}`,
    cuerpo: mapeo.projects.cuerpoCambioEstado(idEstado),
  };
  if (cambio.simular) return { resultado: 'simulado', peticion };
  await cli.projects(peticion.metodo, peticion.ruta, peticion.cuerpo);
  return { resultado: 'sincronizado', detalle: `${cambio.compuerta}: ${tarea.estado} → ${cambio.estado} en Zoho Projects.` };
}

export interface ObservacionSync {
  folio: string;
  /** ID de la observación en KairóVolt; hace idempotente el envío. */
  observacionId: string;
  compuerta: CompuertaId;
  origen: string;
  estado: string;
  descripcion: string;
  fechaCompromiso?: string | null;
  responsable?: string | null;
  simular?: boolean;
}

/** Registra la observación como nota del trato en Zoho CRM. No duplica: la marca [KV-OBS:id:estado] identifica cada envío. */
export async function sincronizarObservacion(cli: ClienteZoho, obs: ObservacionSync): Promise<ResultadoSync> {
  const [proyecto] = (await leerProyectos(cli, { folio: obs.folio })).proyectos;
  if (!proyecto) throw new SyncError('proyecto_no_encontrado', `No hay proyecto ${obs.folio} en Zoho.`);
  if (!proyecto.deal) throw new SyncError('sin_trato_crm', `${proyecto.folio} no tiene trato en Zoho CRM.`);

  const marca = `[KV-OBS:${obs.observacionId}:${obs.estado}]`;
  const nc = M.crm.notas.campos;
  const modulo = M.crm.deals.modulo;
  const rutaNotas = `/crm/v6/${modulo}/${seg(proyecto.deal.id)}/Notes`;

  const existentes = await cli.crm<{ data?: Record<string, unknown>[] }>('GET', `${rutaNotas}?fields=${nc.titulo},${nc.contenido}&per_page=200`);
  if ((existentes.data ?? []).some((n) => typeof n[nc.contenido] === 'string' && (n[nc.contenido] as string).includes(marca))) {
    return { resultado: 'sin_cambios', detalle: 'La observación ya estaba registrada en Zoho con ese estado.' };
  }

  const contenido = [
    obs.descripcion,
    '',
    `Compuerta: ${obs.compuerta} · Origen: ${obs.origen} · Estado: ${obs.estado}`,
    `Responsable: ${obs.responsable ?? 'sin asignar'} · Compromiso: ${obs.fechaCompromiso ?? 'sin fecha'}`,
    marca,
  ].join('\n');
  const peticion: Peticion = {
    metodo: 'POST', servicio: 'CRM', ruta: rutaNotas,
    cuerpo: { data: [{ [nc.titulo]: `KairóVolt · Observación ${obs.compuerta} (${obs.estado})`, [nc.contenido]: contenido }] },
  };
  if (obs.simular) return { resultado: 'simulado', peticion };

  const res = await cli.crm<{ data?: { status?: string }[] }>('POST', peticion.ruta, peticion.cuerpo);
  if (res.data?.[0]?.status !== 'success') throw new SyncError('respuesta_inesperada', 'Zoho CRM no confirmó la creación de la nota.');
  return { resultado: 'sincronizado', detalle: 'Observación registrada como nota del trato en Zoho CRM.' };
}
