import type {
  AccionClienteCita,
  AccionIdcCita,
  CitaPortal,
  ConfigAgendaIDC,
  DiaDisponibilidad,
  EstadoCita,
  TipoVisita,
} from '../../src/domain/citas/cita';
import type { EventoPublico, Notificacion } from '../../src/application/portal-cliente';

export type CodigoErrorCita =
  | 'horario_no_disponible'
  | 'cita_duplicada'
  | 'expediente_no_listo'
  | 'transicion_invalida'
  | 'cita_no_encontrada'
  | 'agenda_no_publicada'
  | 'datos_invalidos';

export class ErrorCita extends Error {
  constructor(
    readonly codigo: CodigoErrorCita,
    mensaje: string,
    readonly httpStatus: 400 | 404 | 409 | 422 | 503 = 409,
  ) {
    super(mensaje);
  }
}

export interface SolicitudNuevaCita {
  folio: string;
  accesoId: string | null;
  tipoVisita: TipoVisita;
  fecha: string;
  horaInicio: string;
  notasCliente: string | null;
  idempotencyKey: string | null;
  expedienteListo: boolean;
  motivoNoListo: string | null;
}

export interface EntradaAccionClienteCita {
  folio: string;
  citaId: string;
  accion: AccionClienteCita;
  nuevaFecha?: string | null;
  nuevaHoraInicio?: string | null;
  motivo?: string | null;
}

export interface EntradaAccionIdcCita {
  citaId: string;
  actorId: string | null;
  accion: AccionIdcCita;
  nuevaFecha?: string | null;
  nuevaHoraInicio?: string | null;
  motivo?: string | null;
  ubicacionAutorizada?: string | null;
}

export interface FiltrosAdminCitas {
  folio?: string;
  estado?: EstadoCita;
  fecha?: string;
}

/**
 * Contrato de proveedor de agenda (desacoplado de Zoho Calendar / Zoho Bookings).
 * - En modo DEMO: `crearCitasMemoria` provee agenda ficticia con horarios ocupados simulados y protección de concurrencia en memoria.
 * - En modo REAL (sin Zoho Calendar/Bookings conectado): `crearCitasSupabase` persiste solicitudes en Supabase con exclusión transaccional
 *   y confirmación manual por IDC sin publicar disponibilidad falsa.
 */
export interface ProveedorAgenda {
  obtenerConfig(): Promise<ConfigAgendaIDC>;
  actualizarConfig?(cambios: Partial<ConfigAgendaIDC>, actorId: string | null): Promise<ConfigAgendaIDC>;
  consultarDisponibilidad(mes: string, tipo: TipoVisita): Promise<{ config: ConfigAgendaIDC; dias: DiaDisponibilidad[] }>;
  listarPorFolio(folio: string): Promise<CitaPortal[]>;
  obtenerActiva(folio: string): Promise<CitaPortal | null>;
  obtenerPorId(citaId: string): Promise<CitaPortal | null>;
  solicitar(entrada: SolicitudNuevaCita): Promise<{ cita: CitaPortal; duplicada: boolean }>;
  accionCliente(entrada: EntradaAccionClienteCita): Promise<CitaPortal>;
  listarAdmin(filtros: FiltrosAdminCitas): Promise<CitaPortal[]>;
  accionAdmin(entrada: EntradaAccionIdcCita): Promise<CitaPortal>;
  notificacionesDe(folio: string): Promise<Notificacion[]>;
  historialDe(folio: string): Promise<EventoPublico[]>;
  obtenerChecklistVisita(folio: string): Promise<string[]>;
  guardarChecklistVisita(folio: string, accesoId: string | null, marcados: string[]): Promise<string[]>;
}
