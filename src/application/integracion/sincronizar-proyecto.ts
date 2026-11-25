import { huellaEstable } from './huella';
import type {
  AccionSync, DependenciaTarea, DestinoSync, PuertoArchivos, PuertoCrm, PuertoGestionProyectos, ProyectoSincronizable, ReferenciaExterna,
  RegistroSync, RepositorioReferencias, RepositorioSincronizaciones, ResultadoAsegurar, Sistema,
} from './puertos';

export interface DependenciasSincronizacion {
  crm: PuertoCrm;
  proyectos: PuertoGestionProyectos;
  archivos: PuertoArchivos;
  referencias: RepositorioReferencias;
  registro: RepositorioSincronizaciones;
  /** Instante ISO y id nuevo: los pone quien llama, para que el resultado sea reproducible en pruebas. */
  ahora(): string;
  nuevoId(): string;
}

export interface OpcionesSincronizacion {
  /** true = lee pero NO escribe en ningún sistema externo; devuelve lo que se haría. */
  simular: boolean;
  /** true = ignora el registro de operaciones ya hechas y las ejecuta otra vez. */
  forzar?: boolean;
  /** Nombre de la lista de tareas del proyecto; null = usar la lista por defecto del servicio. */
  listaTareas?: string | null;
}

export interface ResultadoPasoSync {
  clave: string;
  destino: DestinoSync;
  operacion: string;
  estado: RegistroSync['estado'];
  accion: AccionSync | null;
  idExterno: string | null;
  error: string | null;
}

export interface ResultadoSincronizacionProyecto {
  folio: string;
  modo: 'real' | 'simulado';
  /** true = ningún paso falló (los omitidos por idempotencia cuentan como bien). */
  ok: boolean;
  pasos: ResultadoPasoSync[];
  advertencias: string[];
}

export const LISTA_TAREAS_POR_DEFECTO = 'Compuertas';

const SISTEMA_DE: Record<DestinoSync, Sistema> = { crm: 'zoho_crm', projects: 'zoho_projects', workdrive: 'zoho_workdrive' };

/**
 * Deja en el CRM, el gestor de proyectos y el almacén de archivos lo que KairóVolt necesita para el folio:
 * proyecto, lista y tareas (con fechas y responsables), dependencias, carpetas y referencias cruzadas.
 *
 * IDEMPOTENTE: cada paso lleva una clave (folio + destino + operación + contenido). Si ya se hizo con éxito, se OMITE. Repetir la
 * sincronización no crea duplicados; solo cambia lo que cambió. Cada paso (hecho, omitido, simulado o con error) queda registrado.
 * Un paso que falla no detiene a los demás, salvo los que dependen de él.
 */
export async function sincronizarProyecto(
  deps: DependenciasSincronizacion, p: ProyectoSincronizable, opc: OpcionesSincronizacion,
): Promise<ResultadoSincronizacionProyecto> {
  const o = { simular: opc.simular };
  const pasos: ResultadoPasoSync[] = [];
  const advertencias: string[] = [];

  async function paso(
    destino: DestinoSync, operacion: string, contenido: unknown, ejecutar: () => Promise<ResultadoAsegurar>,
    guardarReferencia?: (id: string) => ReferenciaExterna,
  ): Promise<string | null> {
    const clave = `${p.folio}|${destino}|${operacion}|${huellaEstable(contenido)}`;
    const base = { id: deps.nuevoId(), clave, folio: p.folio, destino, operacion, creadoEn: deps.ahora() };
    const anotar = async (r: Omit<RegistroSync, 'id' | 'clave' | 'folio' | 'destino' | 'operacion' | 'creadoEn'>, extra: Partial<ResultadoPasoSync> = {}) => {
      await deps.registro.registrar({ ...base, ...r });
      pasos.push({ clave, destino, operacion, estado: r.estado, accion: r.accion, idExterno: r.idExterno, error: r.error, ...extra });
    };

    if (!opc.simular && !opc.forzar) {
      const previo = await deps.registro.buscarExitosa(clave);
      if (previo) {
        await anotar({ estado: 'omitido', accion: 'sin_cambios', idExterno: previo.idExterno, error: null, categoriaError: null, intentos: 0 });
        return previo.idExterno;
      }
    }
    try {
      const r = await ejecutar();
      await anotar({ estado: opc.simular ? 'simulado' : 'ok', accion: r.accion, idExterno: r.id, error: null, categoriaError: null, intentos: 1 });
      if (!opc.simular && guardarReferencia) await deps.referencias.guardar(guardarReferencia(r.id));
      return r.id;
    } catch (e) {
      const f = e as { message?: unknown; categoria?: unknown; intentos?: unknown };
      await anotar({
        estado: 'error', accion: null, idExterno: null,
        error: typeof f.message === 'string' ? f.message.slice(0, 300) : 'Error desconocido',
        categoriaError: typeof f.categoria === 'string' ? f.categoria : null,
        intentos: typeof f.intentos === 'number' ? f.intentos : 1,
      });
      return null;
    }
  }

  const omitirDependiente = async (destino: DestinoSync, operacion: string, motivo: string) => {
    const clave = `${p.folio}|${destino}|${operacion}|dependiente`;
    await deps.registro.registrar({ id: deps.nuevoId(), clave, folio: p.folio, destino, operacion, estado: 'omitido', accion: null, idExterno: null, error: motivo, categoriaError: null, intentos: 0, creadoEn: deps.ahora() });
    pasos.push({ clave, destino, operacion, estado: 'omitido', accion: null, idExterno: null, error: motivo });
  };
  const ref = (destino: DestinoSync, tipo: string) => (id: string): ReferenciaExterna => ({ folio: p.folio, sistema: SISTEMA_DE[destino], tipo, idExterno: id });

  // 1. Proyecto en el gestor de proyectos (identificado por el folio en su nombre)
  const proyectoId = await paso('projects', 'asegurar_proyecto', { nombre: p.nombre, descripcion: p.descripcion }, () => deps.proyectos.asegurarProyecto(p, o), ref('projects', 'proyecto'));

  // 2. Lista de tareas (si falla, p. ej. por permisos, las tareas van a la lista por defecto)
  let listaId: string | null = null;
  const nombreLista = opc.listaTareas === undefined ? LISTA_TAREAS_POR_DEFECTO : opc.listaTareas;
  if (proyectoId && nombreLista) {
    listaId = await paso('projects', 'asegurar_lista', { nombre: nombreLista }, () => deps.proyectos.asegurarListaTareas(proyectoId, nombreLista, o));
    if (listaId === null) advertencias.push(`No se pudo crear la lista «${nombreLista}»: las tareas se crean en la lista por defecto.`);
  }

  // 3. Tareas (fechas) y responsables
  const tareaIds: Partial<Record<string, string>> = {};
  for (const t of p.tareas) {
    if (!proyectoId) { await omitirDependiente('projects', `asegurar_tarea:${t.clave}`, 'Depende de que exista el proyecto'); continue; }
    const id = await paso('projects', `asegurar_tarea:${t.clave}`, { nombre: t.nombre, inicio: t.inicioPlan, fin: t.finPlan, lista: listaId }, () => deps.proyectos.asegurarTarea(proyectoId, listaId, p.folio, t, o), ref('projects', `tarea:${t.clave}`));
    if (id) tareaIds[t.clave] = id;
    if (id && t.responsableCorreo) await paso('projects', `asignar:${t.clave}`, { correo: t.responsableCorreo, tarea: id }, () => deps.proyectos.asignarResponsable(proyectoId, id, t.responsableCorreo!, o));
  }

  // 4. Dependencias (solo si el servicio las ofrece)
  const dependencias: DependenciaTarea[] = p.tareas.flatMap((t) => {
    const tareaId = tareaIds[t.clave];
    const predecesoraId = t.predecesora ? tareaIds[t.predecesora] : undefined;
    return tareaId && predecesoraId ? [{ tareaId, predecesoraId }] : [];
  });
  if (proyectoId && dependencias.length > 0) {
    if (deps.proyectos.soportaDependencias) await paso('projects', 'dependencias', dependencias, () => deps.proyectos.administrarDependencias(proyectoId, dependencias, o));
    else advertencias.push('El servicio no ofrece dependencias entre tareas: no se administraron.');
  }

  // 5. Carpeta del folio en el almacén de archivos
  let carpetaId: string | null = null;
  const idCarpeta = await paso('workdrive', 'asegurar_carpeta', { subcarpetas: p.subcarpetas }, async () => {
    const c = await deps.archivos.asegurarCarpetaProyecto(p.folio, p.subcarpetas, o);
    carpetaId = c.carpetaId;
    for (const [nombre, id] of Object.entries(c.subcarpetas)) {
      if (!opc.simular) await deps.referencias.guardar({ folio: p.folio, sistema: 'zoho_workdrive', tipo: `carpeta:${nombre}`, idExterno: id });
    }
    return { id: c.carpetaId, accion: c.accion };
  }, ref('workdrive', 'carpeta'));
  carpetaId = carpetaId ?? idCarpeta;

  // 6. CRM: trato por folio, folio sincronizado y referencias a lo creado
  const tratoId = await paso('crm', 'upsert_proyecto', { nombre: p.nombre }, () => deps.crm.upsertProyecto(p, o), ref('crm', 'trato'));
  if (tratoId) {
    await paso('crm', 'sincronizar_folio', { folio: p.folio, trato: tratoId }, () => deps.crm.sincronizarFolio(tratoId, p.folio, o));
    if (proyectoId) await paso('crm', 'referencia:proyecto', { id: proyectoId }, () => deps.crm.registrarReferencia(tratoId, ref('projects', 'proyecto')(proyectoId), o));
    if (carpetaId) await paso('crm', 'referencia:carpeta', { id: carpetaId }, () => deps.crm.registrarReferencia(tratoId, ref('workdrive', 'carpeta')(carpetaId!), o));
  } else {
    await omitirDependiente('crm', 'sincronizar_folio', 'Depende de que exista el trato');
  }

  return { folio: p.folio, modo: opc.simular ? 'simulado' : 'real', ok: pasos.every((x) => x.estado !== 'error'), pasos, advertencias };
}
