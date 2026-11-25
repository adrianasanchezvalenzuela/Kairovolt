import type { CompuertaId, EstadoCompuerta } from '@/domain/compuertas/compuerta';

/**
 * PUERTOS de integración con sistemas externos. Esta capa no conoce a Zoho ni a ningún SDK: define QUÉ necesita KairóVolt
 * (crear proyectos, tareas, carpetas…) y los adaptadores de `server/` deciden CÓMO hacerlo contra cada servicio.
 */

export type Sistema = 'zoho_crm' | 'zoho_projects' | 'zoho_workdrive';
export type DestinoSync = 'crm' | 'projects' | 'workdrive';

/** `simulado` = no se escribió nada: es lo que SE HARÍA. */
export type AccionSync = 'creado' | 'actualizado' | 'sin_cambios' | 'simulado';

export interface OpcionesPaso {
  /** true = las lecturas sí se hacen (para decidir crear o actualizar), pero NO se escribe nada. */
  simular: boolean;
}

export interface ResultadoAsegurar {
  /** Id en el sistema externo. En una simulación de algo que no existe: un marcador, nunca un id real. */
  id: string;
  accion: AccionSync;
  detalle?: string;
}

/** Referencia a un objeto externo (proyecto de Projects, carpeta de WorkDrive, trato de CRM…) ligada al folio KairóVolt. */
export interface ReferenciaExterna {
  folio: string;
  sistema: Sistema;
  /** Qué es: 'proyecto', 'trato', 'carpeta', 'carpeta:G1', 'tarea:G2'… */
  tipo: string;
  idExterno: string;
  url?: string | null;
}

// ---- Lo que KairóVolt quiere tener en los sistemas externos ----

export interface TareaSincronizable {
  clave: CompuertaId;
  nombre: string;
  /** ISO YYYY-MM-DD; null = sin fecha (no se envía ni se borra la que haya). */
  inicioPlan: string | null;
  finPlan: string | null;
  responsableCorreo: string | null;
  predecesora: CompuertaId | null;
}

export interface ProyectoSincronizable {
  folio: string;
  nombre: string;
  descripcion: string | null;
  tareas: TareaSincronizable[];
  /** Subcarpetas de WorkDrive dentro de la carpeta del folio (p. ej. G0…G3). */
  subcarpetas: string[];
}

// ---- CRM ----

export interface ClienteExterno { id: string; nombre: string | null; telefono: string | null; ciudad: string | null; estado: string | null }
export interface ContactoExterno { id: string; nombre: string | null; correo: string | null; telefono: string | null; clienteId: string | null }
export interface OportunidadExterna {
  id: string;
  nombre: string | null;
  /** Folio KairóVolt reconocido en el trato (campo propio o inicio del nombre); null si no lo tiene. */
  folio: string | null;
  etapa: string | null;
  clienteId: string | null;
  contactoId: string | null;
  fechaCierre: string | null;
}

export interface PuertoCrm {
  consultarClientes(): Promise<ClienteExterno[]>;
  consultarContactos(): Promise<ContactoExterno[]>;
  consultarOportunidades(): Promise<OportunidadExterna[]>;
  /** Crea o actualiza el trato del proyecto usando el FOLIO como identificador externo (nunca duplica). */
  upsertProyecto(p: ProyectoSincronizable, o: OpcionesPaso): Promise<ResultadoAsegurar>;
  /** Deja el folio en el campo del trato destinado a ello. */
  sincronizarFolio(tratoId: string, folio: string, o: OpcionesPaso): Promise<ResultadoAsegurar>;
  /** Anota en el trato dónde vive el resto del proyecto (idempotente: la misma referencia no se anota dos veces). */
  registrarReferencia(tratoId: string, ref: ReferenciaExterna, o: OpcionesPaso): Promise<ResultadoAsegurar>;
}

// ---- Gestión de proyectos ----

export interface EstadoTareaExterna {
  id: string;
  nombre: string;
  clave: CompuertaId | null;
  estadoExterno: string | null;
  estado: EstadoCompuerta | null;
  inicioPlan: string | null;
  finPlan: string | null;
  finReal: string | null;
}

export interface DependenciaTarea { tareaId: string; predecesoraId: string }

export interface PuertoGestionProyectos {
  asegurarProyecto(p: ProyectoSincronizable, o: OpcionesPaso): Promise<ResultadoAsegurar>;
  asegurarListaTareas(proyectoId: string, nombre: string, o: OpcionesPaso): Promise<ResultadoAsegurar>;
  /** Crea la tarea de la compuerta o, si existe, sincroniza sus fechas. No toca su estado. */
  asegurarTarea(proyectoId: string, listaId: string | null, folio: string, t: TareaSincronizable, o: OpcionesPaso): Promise<ResultadoAsegurar>;
  asignarResponsable(proyectoId: string, tareaId: string, correo: string, o: OpcionesPaso): Promise<ResultadoAsegurar>;
  consultarEstados(proyectoId: string): Promise<EstadoTareaExterna[]>;
  /** Las dependencias solo se administran cuando el servicio las ofrece. */
  readonly soportaDependencias: boolean;
  administrarDependencias(proyectoId: string, dependencias: DependenciaTarea[], o: OpcionesPaso): Promise<ResultadoAsegurar>;
}

// ---- Archivos ----

export interface ArchivoExterno {
  id: string;
  nombre: string;
  carpetaId: string;
  version: number | null;
  tamano: number | null;
  url: string | null;
}

export interface CarpetaProyecto {
  carpetaId: string;
  subcarpetas: Record<string, string>;
  accion: AccionSync;
}

export interface PuertoArchivos {
  /** Carpeta del folio (y sus subcarpetas) dentro de la carpeta raíz configurada. Si existe, la reutiliza. */
  asegurarCarpetaProyecto(folio: string, subcarpetas: readonly string[], o: OpcionesPaso): Promise<CarpetaProyecto>;
  /** Sube un archivo; si ya existe uno con ese nombre en la carpeta, entra como versión nueva. */
  subirArchivo(carpetaId: string, nombre: string, contenido: Uint8Array, mime: string, o: OpcionesPaso): Promise<{ archivo: ArchivoExterno | null; accion: 'creado' | 'nueva_version' | 'simulado' }>;
  listarArchivos(carpetaId: string): Promise<ArchivoExterno[]>;
}

// ---- Registro e idempotencia ----

export interface RegistroSync {
  id: string;
  /** Identifica la operación + su contenido: la misma clave con un registro `ok` significa «ya está hecho». */
  clave: string;
  folio: string;
  destino: DestinoSync;
  operacion: string;
  estado: 'ok' | 'error' | 'omitido' | 'simulado';
  accion: AccionSync | null;
  idExterno: string | null;
  /** Mensaje ya sin secretos. */
  error: string | null;
  categoriaError: string | null;
  intentos: number;
  creadoEn: string;
}

export interface RepositorioSincronizaciones {
  buscarExitosa(clave: string): Promise<RegistroSync | null>;
  registrar(registro: RegistroSync): Promise<void>;
  recientes(opciones?: { folio?: string; limite?: number }): Promise<RegistroSync[]>;
}

export interface RepositorioReferencias {
  guardar(ref: ReferenciaExterna): Promise<void>;
  obtener(folio: string, sistema: Sistema, tipo: string): Promise<ReferenciaExterna | null>;
  listar(folio: string): Promise<ReferenciaExterna[]>;
}
