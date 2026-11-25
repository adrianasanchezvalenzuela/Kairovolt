import { ErrorPortal, type CodigoErrorPortal, type EstadoPortal, type PortalRepositorio, type ResultadoSubida, type VistaPortalConEstado } from '@/application/portal-acceso';
import type { VersionParticipantes } from '@/application/participantes';
import type { ProgresoPreparacion } from '@/domain/checklist/preparacion';
import type {
  AccionIdcCita,
  ChecklistVisitaItem,
  CitaPortal,
  ConfigAgendaIDC,
  DiaDisponibilidad,
  ElegibilidadCita,
  TipoVisita,
} from '@/domain/citas/cita';

export interface ResumenVisitaPortal {
  elegibilidad: ElegibilidadCita;
  checklist: ChecklistVisitaItem[];
  citaActiva: CitaPortal | null;
  citas: CitaPortal[];
  config: ConfigAgendaIDC;
  correoContacto: string | null;
}

const CSRF = { 'X-Requested-With': 'kairovolt' };
const rutaPortal = () => import.meta.env.DEV && window.location.pathname.startsWith('/demo/portal')
  ? '/api/demo/portal' : '/api/portal';

export const archivoPortalUrl = (recibo: string, descargar = false) =>
  rutaPortal() + '/archivos/' + encodeURIComponent(recibo) + (descargar ? '?descargar=1' : '');

export async function simularRevisionPortal(recibo: string, estado: 'rechazado' | 'prevalidado', comentario: string) {
  const { status, data } = await llamar('POST', rutaPortal() + '/simular-revision/' + encodeURIComponent(recibo), { estado, comentario });
  if (status !== 200) throw errorDeRespuesta(status, data);
}
const CODIGOS: readonly CodigoErrorPortal[] = [
  'acceso_invalido', 'demasiados_intentos', 'sin_sesion', 'sin_permiso', 'no_disponible', 'proyecto_no_disponible', 'documento_no_solicitado',
  'documento_no_admite_envio', 'tipo_no_permitido', 'tipo_no_coincide', 'vacio', 'demasiado_grande', 'no_se_pudo_guardar',
];

/** Convierte la respuesta de error del backend en un ErrorPortal con un mensaje para el cliente. */
export function errorDeRespuesta(status: number, data: Record<string, unknown>): ErrorPortal {
  const codigo = CODIGOS.find((c) => c === data.error) ?? (status === 413 ? 'demasiado_grande' : 'desconocido');
  const detalle = typeof data.detalle === 'string' ? data.detalle : null;
  const porDefecto: Partial<Record<CodigoErrorPortal, string>> = {
    sin_sesion: 'Tu sesión terminó. Vuelve a entrar con tu código.',
    no_disponible: 'El portal no está disponible en este momento. Intenta de nuevo en unos minutos.',
    desconocido: `Algo salió mal (${status}). Intenta de nuevo.`,
  };
  return new ErrorPortal(codigo, detalle ?? porDefecto[codigo] ?? 'No se pudo completar la operación.');
}

async function llamar(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: metodo, credentials: 'same-origin',
      headers: { ...CSRF, ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }) },
      ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
    });
  } catch {
    throw new ErrorPortal('sin_conexion', 'No hay conexión. Revisa tu internet e intenta de nuevo.');
  }
  return { status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export async function datosPortal(entrada?: VersionParticipantes): Promise<VersionParticipantes | null> {
  const { status, data } = await llamar(entrada ? 'POST' : 'GET', rutaPortal() + '/participantes', entrada);
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data.actual as VersionParticipantes | null;
}

export async function listarPreparacionPortal(): Promise<ProgresoPreparacion[]> {
  const { status, data } = await llamar('GET', rutaPortal() + '/preparacion');
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data.progreso as ProgresoPreparacion[];
}

export async function guardarPreparacionPortal(p: ProgresoPreparacion): Promise<ProgresoPreparacion> {
  const { status, data } = await llamar('POST', rutaPortal() + '/preparacion/' + encodeURIComponent(p.documento), p);
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data as unknown as ProgresoPreparacion;
}

export async function descargarCartaDemo(): Promise<void> {
  const r = await fetch(rutaPortal() + '/carta-poder-demo', { method: 'POST', headers: CSRF, credentials: 'same-origin' });
  if (!r.ok) throw errorDeRespuesta(r.status, await r.json().catch(() => ({})) as Record<string, unknown>);
  const url = URL.createObjectURL(await r.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'carta-poder-demostracion.pdf';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function historialCartasPortal(): Promise<{ href: string; plantilla: string; generado_en: string }[]> {
  const { status, data } = await llamar('GET', rutaPortal() + '/carta-poder-demo');
  if (status !== 200) throw errorDeRespuesta(status, data);
  const historial = data.historial as { id: string; plantilla: string; generado_en: string }[];
  return historial.map((r) => ({ ...r, href: rutaPortal() + '/carta-poder-demo/' + encodeURIComponent(r.id) }));
}

export async function resumenVisitaPortal(): Promise<ResumenVisitaPortal> {
  const { status, data } = await llamar('GET', rutaPortal() + '/visita/resumen');
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data as unknown as ResumenVisitaPortal;
}

export async function guardarChecklistVisitaPortal(marcados: string[]): Promise<string[]> {
  const { status, data } = await llamar('POST', rutaPortal() + '/visita/checklist', { marcados });
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data.marcados as string[];
}

export async function disponibilidadVisitaPortal(
  mes: string,
  tipo: TipoVisita,
): Promise<{ config: ConfigAgendaIDC; dias: DiaDisponibilidad[] }> {
  const q = new URLSearchParams({ mes, tipo });
  const { status, data } = await llamar('GET', rutaPortal() + '/visita/disponibilidad?' + q);
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data as unknown as { config: ConfigAgendaIDC; dias: DiaDisponibilidad[] };
}

export async function solicitarCitaPortal(entrada: {
  tipoVisita: TipoVisita;
  fecha: string;
  horaInicio: string;
  notasCliente?: string;
  idempotencyKey: string;
}): Promise<{ cita: CitaPortal; duplicada: boolean }> {
  const { status, data } = await llamar('POST', rutaPortal() + '/visita/solicitar', entrada);
  if (status !== 201 && status !== 200) throw errorDeRespuesta(status, data);
  return data as unknown as { cita: CitaPortal; duplicada: boolean };
}

export async function reprogramarCitaPortal(
  id: string,
  entrada: { accion: 'solicitar_cambio' | 'aceptar_propuesta'; nuevaFecha?: string; nuevaHoraInicio?: string; motivo?: string },
): Promise<CitaPortal> {
  const { status, data } = await llamar('POST', rutaPortal() + '/visita/' + encodeURIComponent(id) + '/reprogramar', entrada);
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data.cita as CitaPortal;
}

export async function cancelarCitaPortal(id: string, motivo: string): Promise<CitaPortal> {
  const { status, data } = await llamar('POST', rutaPortal() + '/visita/' + encodeURIComponent(id) + '/cancelar', { motivo });
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data.cita as CitaPortal;
}

export const icsCitaPortalUrl = (id: string) => rutaPortal() + '/visita/' + encodeURIComponent(id) + '/ics';

export async function simularAccionCitaDemo(
  id: string,
  entrada: { accion: AccionIdcCita; nuevaFecha?: string; nuevaHoraInicio?: string; motivo?: string; ubicacionAutorizada?: string },
): Promise<CitaPortal> {
  const { status, data } = await llamar('POST', rutaPortal() + '/simular-cita/' + encodeURIComponent(id), entrada);
  if (status !== 200) throw errorDeRespuesta(status, data);
  return data.cita as CitaPortal;
}

export const portalHttp: PortalRepositorio = {
  async estado() {
    const { status, data } = await llamar('GET', rutaPortal() + '/estado');
    if (status !== 200) throw errorDeRespuesta(status, data);
    return data as unknown as EstadoPortal;
  },
  async acceder(folio, codigo) {
    const { status, data } = await llamar('POST', rutaPortal() + '/acceso', { folio, codigo });
    if (status !== 200) throw errorDeRespuesta(status, data);
  },
  async cerrar() {
    await llamar('DELETE', rutaPortal() + '/sesion').catch(() => undefined);
  },
  async vista() {
    const { status, data } = await llamar('GET', rutaPortal() + '/vista');
    if (status !== 200) throw errorDeRespuesta(status, data);
    return data as unknown as VistaPortalConEstado;
  },
  /** XMLHttpRequest (y no fetch) para poder mostrar el progreso real de la subida. */
  subir(documentoId, archivo, onProgreso) {
    return new Promise<ResultadoSubida>((resolver, rechazar) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${rutaPortal()}/documentos/${encodeURIComponent(documentoId)}`);
      xhr.withCredentials = true;
      for (const [k, v] of Object.entries(CSRF)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso?.(Math.round((e.loaded / e.total) * 100)); };
      xhr.onerror = () => rechazar(new ErrorPortal('sin_conexion', 'Se perdió la conexión mientras se subía el archivo. Intenta de nuevo.'));
      xhr.ontimeout = xhr.onerror;
      xhr.onload = () => {
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(xhr.responseText) as Record<string, unknown>; } catch { /* respuesta sin cuerpo */ }
        if (xhr.status === 201) resolver(data as unknown as ResultadoSubida);
        else rechazar(errorDeRespuesta(xhr.status, data));
      };
      const f = new FormData();
      f.set('archivo', archivo);
      xhr.send(f);
    });
  },
};
