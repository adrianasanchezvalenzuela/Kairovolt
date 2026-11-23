import type { CompuertaId, EstadoCompuerta } from '../../src/domain/compuertas/compuerta';
import { seg, type ClienteZoho } from './cliente';
import { MAPEO_ZOHO as M, type MapeoZoho } from './mapeo';

type Reg = Record<string, unknown>;

export interface TareaCompuertaZoho {
  tareaId: string;
  compuerta: CompuertaId;
  nombre: string;
  estadoZoho: string | null;
  estadoZohoId: string | null;
  estado: EstadoCompuerta;
  inicioPlan: string | null;
  finPlan: string | null;
  finReal: string | null;
}

export interface ProyectoZoho {
  folio: string;
  nombre: string;
  deal: { id: string; etapa: string | null; fechaCierre: string | null; descripcion: string | null } | null;
  cliente: { id: string; nombre: string | null; telefono: string | null; ciudad: string | null; estado: string | null } | null;
  contacto: { id: string; nombre: string | null; correo: string | null; telefono: string | null } | null;
  proyecto: { id: string; nombre: string; estado: string | null } | null;
  compuertas: TareaCompuertaZoho[];
}

export interface ResultadoLectura {
  proyectos: ProyectoZoho[];
  /** Cosas que no se pudieron leer o interpretar; nunca se ocultan. */
  advertencias: string[];
}

export interface ModuloCrm { apiName: string; etiqueta: string }

// ---- utilidades de lectura defensiva -------------------------------------------------------------------------
const texto = (v: unknown): string | null =>
  typeof v === 'string' ? (v.trim() || null) : typeof v === 'number' ? String(v) : null;
const registro = (v: unknown): Reg => (v && typeof v === 'object' ? (v as Reg) : {});
const lista = (v: unknown): Reg[] => (Array.isArray(v) ? v.map(registro) : []);
/** Zoho Projects a veces responde un arreglo directo y a veces { clave: [...] }; se aceptan ambos. */
const extraerLista = (data: unknown, clave: string): Reg[] => (Array.isArray(data) ? lista(data) : lista(registro(data)[clave]));
const refId = (v: unknown): string | null => texto(registro(v).id);
const refNombre = (v: unknown): string | null => texto(registro(v).name);
const campos = (c: Record<string, string>): string => Object.values(c).map(encodeURIComponent).join(',');

/**
 * Fecha local (YYYY-MM-DD) a partir de lo que devuelve Zoho: una marca de tiempo (UTC u otro offset) se convierte a la zona
 * del mapeo; YYYY-MM-DD y MM-DD-YYYY se toman tal cual; cualquier otra cosa → null.
 */
export function normalizarFecha(v: unknown, zona: string = M.zonaHoraria): string | null {
  const t = texto(v);
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
  if (iso) return iso[1] ?? null;
  const mdy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);
  return mdy ? `${mdy[3]}-${mdy[1]}-${mdy[2]}` : null;
}

export function estadoCompuertaDesdeZoho(nombre: string | null, mapeo: MapeoZoho = M): EstadoCompuerta | null {
  if (!nombre) return null;
  const n = nombre.trim().toLowerCase();
  for (const [estado, cfg] of Object.entries(mapeo.projects.estadosCompuerta) as [EstadoCompuerta, { nombres: string[] }][]) {
    if (cfg.nombres.some((x) => x.toLowerCase() === n)) return estado;
  }
  return null;
}

const folioDe = (nombre: string | null, personalizado: string | null): string | null => {
  const f = personalizado ?? (nombre ? M.folio.patronEnNombre.exec(nombre)?.[1] ?? null : null);
  return f ? f.toUpperCase() : null;
};

// ---- descubrimiento -------------------------------------------------------------------------------------------
export async function listarModulosCrm(cli: ClienteZoho): Promise<ModuloCrm[]> {
  const data = registro(await cli.crm('GET', '/crm/v6/settings/modules'));
  return lista(data.modules).flatMap((m) => {
    const apiName = texto(m.api_name);
    return apiName ? [{ apiName, etiqueta: texto(m.plural_label) ?? apiName }] : [];
  });
}

export async function listarPortales(cli: ClienteZoho): Promise<{ id: string; nombre: string | null }[]> {
  const data = await cli.projects('GET', '/api/v3/portals');
  return extraerLista(data, 'portals').flatMap((p) => {
    const id = texto(p.id);
    return id ? [{ id, nombre: texto(p.portal_name) ?? texto(p.name) }] : [];
  });
}

// ---- lectura de proyectos -------------------------------------------------------------------------------------
async function porIds(cli: ClienteZoho, modulo: string, cps: Record<string, string>, ids: string[]): Promise<Map<string, Reg>> {
  const mapa = new Map<string, Reg>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const data = registro(await cli.crm('GET', `/crm/v6/${modulo}?ids=${lote.join(',')}&fields=${campos(cps)}`));
    for (const r of lista(data.data)) {
      const id = texto(r.id);
      if (id) mapa.set(id, r);
    }
  }
  return mapa;
}

/** Lee tratos (CRM) y proyectos/tareas (Projects) y los une por folio KV. Con `folio` solo trae ese proyecto. */
export async function leerProyectos(cli: ClienteZoho, opts: { folio?: string } = {}): Promise<ResultadoLectura> {
  const advertencias: string[] = [];
  const filtro = opts.folio?.toUpperCase();
  const { deals: d, accounts: a, contacts: c } = M.crm;

  // CRM: tratos
  const campoFolio = M.folio.campoCrm;
  const cpsDeal = { ...d.campos, ...(campoFolio ? { folio: campoFolio } : {}) };
  const dealsRaw = lista(registro(await cli.crm('GET', `/crm/v6/${d.modulo}?fields=${campos(cpsDeal)}&per_page=200`)).data);
  const deals = new Map<string, Reg>();
  for (const r of dealsRaw) {
    const nombre = texto(r[d.campos.nombre]);
    const folio = folioDe(nombre, campoFolio ? texto(r[campoFolio]) : null);
    if (!folio) continue; // tratos que no son de KairóVolt
    if (filtro && folio !== filtro) continue;
    deals.set(folio, r);
  }

  const cuentas = await porIds(cli, a.modulo, a.campos, [...new Set([...deals.values()].flatMap((r) => refId(r[d.campos.cuenta]) ?? []))]);
  const contactos = await porIds(cli, c.modulo, c.campos, [...new Set([...deals.values()].flatMap((r) => refId(r[d.campos.contacto]) ?? []))]);

  // Projects
  const proyectosPorFolio = new Map<string, { id: string; nombre: string; estado: string | null; tareas: Reg[] }>();
  if (!cli.portalId) {
    advertencias.push('ZOHO_PROJECTS_PORTAL_ID no está configurado: se omiten proyectos, compuertas y cronograma de Zoho Projects.');
  } else {
    const p = M.projects.proyectos.campos;
    const portal = seg(cli.portalId);
    const lp = extraerLista(await cli.projects('GET', `/api/v3/portal/${portal}/projects?index=1&range=100`), 'projects');
    for (const r of lp) {
      const id = texto(r[p.id]);
      const nombre = texto(r[p.nombre]);
      const folio = folioDe(nombre, null);
      if (!id || !nombre || !folio || (filtro && folio !== filtro)) continue;
      const tareas = extraerLista(await cli.projects('GET', `/api/v3/portal/${portal}/projects/${seg(id)}/tasks?index=1&range=100`), 'tasks');
      proyectosPorFolio.set(folio, { id, nombre, estado: refNombre(r[p.estado]) ?? texto(r[p.estado]), tareas });
    }
  }

  // Unión por folio
  const folios = [...new Set([...deals.keys(), ...proyectosPorFolio.keys()])].sort();
  const proyectos = folios.map((folio): ProyectoZoho => {
    const deal = deals.get(folio) ?? null;
    const pz = proyectosPorFolio.get(folio) ?? null;
    const cuenta = deal ? cuentas.get(refId(deal[d.campos.cuenta]) ?? '') : undefined;
    const contacto = deal ? contactos.get(refId(deal[d.campos.contacto]) ?? '') : undefined;
    if (!deal) advertencias.push(`${folio}: existe en Projects pero no hay trato en CRM.`);
    if (!pz && cli.portalId) advertencias.push(`${folio}: existe en CRM pero no hay proyecto en Projects.`);

    const compuertas: TareaCompuertaZoho[] = [];
    for (const tarea of pz?.tareas ?? []) {
      const tc = M.projects.tareas.campos;
      const nombre = texto(tarea[tc.nombre]) ?? '';
      const comp = M.projects.tareas.patronCompuerta.exec(nombre)?.[1]?.toUpperCase() as CompuertaId | undefined;
      const tareaId = texto(tarea[tc.id]);
      if (!comp || !tareaId) continue;
      const estadoZoho = refNombre(tarea[tc.estado]) ?? texto(tarea[tc.estado]);
      const estado = estadoCompuertaDesdeZoho(estadoZoho);
      if (estado === null) advertencias.push(`${folio} ${comp}: estado de Zoho "${estadoZoho ?? '(vacío)'}" sin equivalencia en el mapeo; se toma como pendiente.`);
      compuertas.push({
        tareaId, compuerta: comp, nombre, estadoZoho,
        estadoZohoId: refId(tarea[tc.estado]),
        estado: estado ?? 'pendiente',
        inicioPlan: normalizarFecha(tarea[tc.inicioPlan]),
        finPlan: normalizarFecha(tarea[tc.finPlan]),
        finReal: estado === 'liberada' ? normalizarFecha(tarea[tc.finReal]) : null,
      });
    }
    compuertas.sort((x, y) => x.compuerta.localeCompare(y.compuerta));

    return {
      folio,
      nombre: texto(deal?.[d.campos.nombre]) ?? pz?.nombre ?? folio,
      deal: deal ? { id: texto(deal.id) ?? '', etapa: texto(deal[d.campos.etapa]), fechaCierre: normalizarFecha(deal[d.campos.fechaCierre]), descripcion: texto(deal[d.campos.descripcion]) } : null,
      cliente: cuenta ? { id: texto(cuenta.id) ?? '', nombre: texto(cuenta[a.campos.nombre]), telefono: texto(cuenta[a.campos.telefono]), ciudad: texto(cuenta[a.campos.ciudad]), estado: texto(cuenta[a.campos.estado]) } : null,
      contacto: contacto ? { id: texto(contacto.id) ?? '', nombre: texto(contacto[c.campos.nombre]), correo: texto(contacto[c.campos.correo]), telefono: texto(contacto[c.campos.telefono]) } : null,
      proyecto: pz ? { id: pz.id, nombre: pz.nombre, estado: pz.estado } : null,
      compuertas,
    };
  });

  return { proyectos, advertencias };
}
