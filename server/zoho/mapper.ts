import type { CompuertaId } from '../../src/domain/compuertas/compuerta';
import type {
  ArchivoExterno, ClienteExterno, ContactoExterno, EstadoTareaExterna, OportunidadExterna, ProyectoSincronizable, ReferenciaExterna, TareaSincronizable,
} from '../../src/application/integracion/puertos';
import { estadoCompuertaDesdeZoho, extraerLista, lista, normalizarFecha, registro, texto } from './lectura';
import { MAPEO_ZOHO as M, type MapeoZoho } from './mapeo';

type Reg = Record<string, unknown>;

const refId = (v: unknown): string | null => texto(registro(v).id);

/**
 * ZohoMapper: traduce entre el vocabulario de KairóVolt (los puertos de `src/application/integracion`) y el de Zoho.
 * Es el ÚNICO lugar que conoce los nombres de campos y las formas de los cuerpos de Zoho: si la API de tu cuenta difiere,
 * se ajusta aquí y en `mapeo.ts`, sin tocar los adaptadores ni la lógica de negocio.
 * Las formas de ESCRITURA de Projects y WorkDrive están basadas en la documentación de Zoho y NO están verificadas contra la cuenta real
 * (el token actual no tiene esos permisos): por eso toda escritura masiva se simula primero.
 */

export const nombreProyecto = (p: ProyectoSincronizable): string => `${p.folio} - ${p.nombre}`;

/** Mediodía del día local → instante UTC ISO (Zoho muestra el día correcto). Hermosillo no tiene horario de verano: desfase fijo. */
export function fechaParaProjects(iso: string, desfaseHoras: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Fecha inválida: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12 - desfaseHoras)).toISOString();
}

export const marcaReferencia = (r: Pick<ReferenciaExterna, 'sistema' | 'tipo' | 'idExterno'>): string => `[KV-REF:${r.sistema}:${r.tipo}:${r.idExterno}]`;

export const ZohoMapper = {
  // ===== Lecturas: Zoho → vocabulario de KairóVolt =====
  cliente(r: Reg, m: MapeoZoho = M): ClienteExterno {
    const c = m.crm.accounts.campos;
    return { id: texto(r.id) ?? '', nombre: texto(r[c.nombre]), telefono: texto(r[c.telefono]), ciudad: texto(r[c.ciudad]), estado: texto(r[c.estado]) };
  },

  contacto(r: Reg, m: MapeoZoho = M): ContactoExterno {
    const c = m.crm.contacts.campos;
    return { id: texto(r.id) ?? '', nombre: texto(r[c.nombre]), correo: texto(r[c.correo]), telefono: texto(r[c.telefono]), clienteId: refId(r.Account_Name) };
  },

  oportunidad(r: Reg, m: MapeoZoho = M): OportunidadExterna {
    const d = m.crm.deals.campos;
    const nombre = texto(r[d.nombre]);
    const propio = m.folio.campoCrm ? texto(r[m.folio.campoCrm]) : null;
    const folio = (propio ?? (nombre ? m.folio.patronEnNombre.exec(nombre)?.[1] ?? null : null))?.toUpperCase() ?? null;
    return {
      id: texto(r.id) ?? '', nombre, folio, etapa: texto(r[d.etapa]), clienteId: refId(r[d.cuenta]), contactoId: refId(r[d.contacto]),
      fechaCierre: normalizarFecha(r[d.fechaCierre]),
    };
  },

  estadoTarea(r: Reg, m: MapeoZoho = M): EstadoTareaExterna {
    const c = m.projects.tareas.campos;
    const nombre = texto(r[c.nombre]) ?? '';
    const estado = registro(r[c.estado]);
    const estadoExterno = texto(estado.name) ?? (typeof r[c.estado] === 'string' ? (r[c.estado] as string) : null);
    const clave = (m.projects.tareas.patronCompuerta.exec(nombre)?.[1]?.toUpperCase() ?? null) as CompuertaId | null;
    const mapeado = estadoCompuertaDesdeZoho(estadoExterno, m);
    return {
      id: texto(r[c.id]) ?? '', nombre, clave, estadoExterno, estado: mapeado,
      inicioPlan: normalizarFecha(r[c.inicioPlan]), finPlan: normalizarFecha(r[c.finPlan]), finReal: mapeado === 'liberada' ? normalizarFecha(r[c.finReal]) : null,
    };
  },

  /** Respuesta de listas de Zoho Projects v3: arreglo directo o `{ clave: [...] }`. */
  listaProjects: (data: unknown, clave: string): Reg[] => extraerLista(data, clave),

  /** Id del objeto recién creado en Projects (v3 responde el objeto, un arreglo o `{ clave: [objeto] }`). */
  idCreado(data: unknown, clave: string): string | null {
    if (Array.isArray(data)) return texto(registro(data[0]).id);
    const d = registro(data);
    return texto(d.id) ?? texto(registro(lista(d[clave])[0]).id);
  },

  // ===== Escrituras en Projects =====
  cuerpoProyecto(p: ProyectoSincronizable): Reg {
    return { name: nombreProyecto(p), ...(p.descripcion ? { description: p.descripcion } : {}) };
  },

  cuerpoLista: (nombre: string): Reg => ({ name: nombre }),

  cuerpoTarea(t: TareaSincronizable, listaId: string | null, m: MapeoZoho = M): Reg {
    const d = m.projects.escritura.desfaseHorasFechas;
    return {
      name: t.nombre,
      ...(listaId ? { tasklist: { id: listaId } } : {}),
      ...(t.inicioPlan ? { start_date: fechaParaProjects(t.inicioPlan, d) } : {}),
      ...(t.finPlan ? { end_date: fechaParaProjects(t.finPlan, d) } : {}),
    };
  },

  /** Solo las fechas que KairóVolt define: lo que viene null no se envía (nunca se borra una fecha de Zoho). */
  parcheFechas(t: TareaSincronizable, m: MapeoZoho = M): Reg {
    const d = m.projects.escritura.desfaseHorasFechas;
    return {
      ...(t.inicioPlan ? { start_date: fechaParaProjects(t.inicioPlan, d) } : {}),
      ...(t.finPlan ? { end_date: fechaParaProjects(t.finPlan, d) } : {}),
    };
  },

  cuerpoResponsable: (zpuid: string): Reg => ({ owners_and_work: { owners: [{ zpuid }] } }),

  /** Dependencia «esta tarea va después de…». Forma por confirmar en la cuenta real. */
  cuerpoDependencia: (predecesoraId: string): Reg => ({ dependency: { predecessors: [{ id: predecesoraId }] } }),

  // ===== Escrituras en CRM =====
  cuerpoUpsertDeal(p: ProyectoSincronizable, m: MapeoZoho = M): { cuerpo: Reg; verificarDuplicados: string[] } | null {
    const d = m.crm.deals;
    if (!d.crear.etapaInicial) return null;
    const cierre = new Date(Date.now() + d.crear.diasHastaCierre * 86_400_000).toISOString().slice(0, 10);
    const campoFolio = m.folio.campoCrm;
    return {
      cuerpo: {
        [d.campos.nombre]: nombreProyecto(p),
        [d.campos.etapa]: d.crear.etapaInicial,
        [d.campos.fechaCierre]: cierre,
        ...(p.descripcion ? { [d.campos.descripcion]: p.descripcion } : {}),
        ...(campoFolio ? { [campoFolio]: p.folio } : {}),
      },
      // El identificador externo es el folio: el campo propio si existe; si no, el nombre del trato (que empieza con el folio).
      verificarDuplicados: [campoFolio ?? d.campos.nombre],
    };
  },

  notaReferencia(r: ReferenciaExterna, m: MapeoZoho = M): Reg {
    const nc = m.crm.notas.campos;
    return { [nc.titulo]: `KairóVolt · Referencia ${r.sistema}`, [nc.contenido]: `${r.tipo}: ${r.idExterno}\n${marcaReferencia(r)}` };
  },

  // ===== WorkDrive (JSON:API) =====
  cuerpoCarpeta: (nombre: string, padreId: string): Reg => ({ data: { type: 'files', attributes: { name: nombre, parent_id: padreId } } }),

  archivo(r: Reg, carpetaId: string): ArchivoExterno {
    const a = registro(r.attributes);
    return {
      id: texto(r.id) ?? texto(a.resource_id) ?? '',
      nombre: texto(a.name) ?? texto(a.FileName) ?? '',
      carpetaId,
      version: typeof a.version === 'number' ? a.version : typeof a.version_id === 'number' ? a.version_id : null,
      tamano: typeof a.storage_info === 'object' && a.storage_info !== null && typeof registro(a.storage_info).size_in_bytes === 'number' ? (registro(a.storage_info).size_in_bytes as number) : typeof a.size === 'number' ? a.size : null,
      url: texto(a.permalink) ?? texto(a.download_url),
    };
  },

  esCarpeta: (r: Reg): boolean => registro(r.attributes).type === 'folder',
};
