import type { DocumentoSolicitado, GuiaDocumentoCliente, VistaPortal } from '../../application/portal-cliente';
import type { ProgresoPreparacion, RequiereEntregaFisica } from '../checklist/preparacion';

export const ZONA_HORARIA_IDC = 'America/Hermosillo';
/** Hermosillo (Sonora) mantiene UTC-7 todo el año sin horario de verano. */
export const DESFASE_HERMOSILLO = '-07:00';

export type TipoVisita =
  | 'entrega_expediente'
  | 'firma_documentos'
  | 'visita_tecnica'
  | 'aclaracion_documental';

export const TIPOS_VISITA: readonly TipoVisita[] = [
  'entrega_expediente',
  'firma_documentos',
  'visita_tecnica',
  'aclaracion_documental',
];

export const INFO_TIPO_VISITA: Readonly<Record<TipoVisita, {
  titulo: string;
  descripcion: string;
  duracionPorDefectoMin: number;
  requiereExpedienteListo: boolean;
}>> = {
  entrega_expediente: {
    titulo: 'Entrega física del expediente',
    descripcion: 'Presenta los documentos preparados y firmados en oficinas de IDC para su cotejo e integración.',
    duracionPorDefectoMin: 45,
    requiereExpedienteListo: true,
  },
  firma_documentos: {
    titulo: 'Firma de documentos',
    descripcion: 'Acude a firmar formatos o cartas preparadas por IDC cuando el expediente lo requiera.',
    duracionPorDefectoMin: 30,
    requiereExpedienteListo: false,
  },
  visita_tecnica: {
    titulo: 'Visita técnica',
    descripcion: 'Revisión técnica coordinada con el equipo de ingeniería de IDC.',
    duracionPorDefectoMin: 60,
    requiereExpedienteListo: false,
  },
  aclaracion_documental: {
    titulo: 'Aclaración documental',
    descripcion: 'Resuelve dudas sobre requisitos, formatos o correcciones antes de tu entrega final.',
    duracionPorDefectoMin: 30,
    requiereExpedienteListo: false,
  },
};

export type EstadoCita =
  | 'solicitada'
  | 'pendiente_confirmacion'
  | 'confirmada'
  | 'cambio_solicitado'
  | 'reprogramada'
  | 'cancelada'
  | 'realizada';

export const ESTADOS_CITA: readonly EstadoCita[] = [
  'solicitada',
  'pendiente_confirmacion',
  'confirmada',
  'cambio_solicitado',
  'reprogramada',
  'cancelada',
  'realizada',
];

export const ESTADOS_CITA_ACTIVOS: readonly EstadoCita[] = [
  'solicitada',
  'pendiente_confirmacion',
  'confirmada',
  'cambio_solicitado',
  'reprogramada',
];

export const ETIQUETA_ESTADO_CITA: Readonly<Record<EstadoCita, { texto: string; tono: 'ok' | 'alerta' | 'info' | 'neutro' | 'error' }>> = {
  solicitada: { texto: 'Solicitada', tono: 'alerta' },
  pendiente_confirmacion: { texto: 'Pendiente de confirmación', tono: 'alerta' },
  confirmada: { texto: 'Confirmada', tono: 'ok' },
  cambio_solicitado: { texto: 'Cambio solicitado', tono: 'alerta' },
  reprogramada: { texto: 'Reprogramada', tono: 'ok' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
  realizada: { texto: 'Realizada', tono: 'info' },
};

export interface CambioHistorialCita {
  id: string;
  fecha: string;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  actor: 'cliente' | 'idc' | 'sistema';
  detalle: string | null;
}

export interface CitaPortal {
  id: string;
  referencia: string;
  folio: string;
  tipoVisita: TipoVisita;
  estado: EstadoCita;
  /** YYYY-MM-DD en America/Hermosillo */
  fecha: string;
  /** HH:mm en America/Hermosillo */
  horaInicio: string;
  /** HH:mm en America/Hermosillo */
  horaFin: string;
  /** ISO con offset -07:00 */
  inicioIso: string;
  /** ISO con offset -07:00 */
  finIso: string;
  zonaHoraria: string;
  duracionMinutos: number;
  ubicacionAutorizada: string | null;
  notasCliente: string | null;
  motivoCancelacion: string | null;
  propuestaFecha: string | null;
  propuestaHoraInicio: string | null;
  propuestaHoraFin: string | null;
  propuestaPor: 'cliente' | 'idc' | null;
  propuestaNota: string | null;
  proveedorExterno: string | null;
  referenciaExternaId: string | null;
  simulada: boolean;
  creadoEn: string;
  actualizadoEn: string;
  historial: CambioHistorialCita[];
}

export interface ConfigAgendaIDC {
  zonaHoraria: string;
  /** Días laborables: 1 = Lunes .. 7 = Domingo (ISO) */
  diasLaborables: number[];
  /** Horarios de inicio configurados (HH:mm en America/Hermosillo) */
  horariosInicio: string[];
  /** Fechas no laborables explícitas (YYYY-MM-DD) */
  diasNoLaborables: string[];
  duracionMinutos: number;
  ubicacionAutorizada: string | null;
  tiposHabilitados: TipoVisita[];
  horasAnticipacionCancelacion: number;
  disponibilidadPublicada: boolean;
  simulada: boolean;
  proveedor: 'demo' | 'manual_supabase' | 'zoho_pendiente';
}

export interface HorarioSlot {
  horaInicio: string;
  horaFin: string;
  inicioIso: string;
  finIso: string;
  disponible: boolean;
  motivoNoDisponible?: 'ocupado' | 'pasado' | 'no_laborable';
}

export interface DiaDisponibilidad {
  fecha: string;
  laborable: boolean;
  pasado: boolean;
  tieneDisponibilidad: boolean;
  disponibles: number;
  ocupados: number;
  slots: HorarioSlot[];
}

export interface ChecklistVisitaItem {
  documentoId: string;
  nombre: string;
  categoriaEntrega: 'fisica_confirmada' | 'fisica_por_confirmar' | 'ya_entregado' | 'solo_digital';
  instruccionFisica: string;
  requiereFirmas: boolean;
  originalOCopia: string | null;
  preparadoParaVisita: boolean;
  estadoDocumento: DocumentoSolicitado['estado'];
}

export interface ElegibilidadCita {
  permitida: boolean;
  /** Expresa «Documentación preparada para entrega física» sin afirmar aceptación de CFE ni liberación de compuertas. */
  etiquetaEstadoDocumental: string;
  motivoBloqueo: string | null;
  documentosPendientes: { id: string; nombre: string; estado: DocumentoSolicitado['estado'] }[];
  totalObligatorios: number;
  preparadosObligatorios: number;
}

export function fechaHoyHermosillo(ahoraMs: number = Date.now()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: ZONA_HORARIA_IDC,
  }).formatToParts(new Date(ahoraMs));
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function sumarMinutosHora(hora: string, minutos: number): string {
  const [hStr, mStr] = hora.split(':');
  const total = Number(hStr) * 60 + Number(mStr) + minutos;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function construirIsoHermosillo(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00${DESFASE_HERMOSILLO}`;
}

export function formatearFechaLargaHermosillo(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00${DESFASE_HERMOSILLO}`);
  const texto = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ZONA_HORARIA_IDC,
  }).format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Intervalos semiabiertos [inicio, fin): dos citas se traslapan si inicioA < finB && inicioB < finA. */
export function seTraslapan(inicioA: string, finA: string, inicioB: string, finB: string): boolean {
  const a0 = Date.parse(inicioA);
  const a1 = Date.parse(finA);
  const b0 = Date.parse(inicioB);
  const b1 = Date.parse(finB);
  if ([a0, a1, b0, b1].some(Number.isNaN)) return true;
  return a0 < b1 && b0 < a1;
}

export type AccionClienteCita = 'solicitar_cambio' | 'aceptar_propuesta' | 'cancelar';
export type AccionIdcCita = 'confirmar' | 'proponer_horario' | 'reprogramar' | 'cancelar' | 'realizada';

export function transicionValidaCliente(
  cita: Pick<CitaPortal, 'estado' | 'propuestaPor' | 'inicioIso'>,
  accion: AccionClienteCita,
  ahoraMs: number = Date.now(),
  horasMinimasAnticipacion = 2,
): { ok: true } | { ok: false; motivo: string } {
  if (cita.estado === 'cancelada' || cita.estado === 'realizada') {
    return { ok: false, motivo: 'Esta cita ya cerró y no admite cambios.' };
  }
  const inicioMs = Date.parse(cita.inicioIso);
  if (accion === 'aceptar_propuesta') {
    if (cita.estado !== 'cambio_solicitado' || cita.propuestaPor !== 'idc') {
      return { ok: false, motivo: 'No hay una propuesta de horario pendiente de tu respuesta.' };
    }
    return { ok: true };
  }
  if (accion === 'solicitar_cambio') {
    if (!['solicitada', 'pendiente_confirmacion', 'confirmada', 'reprogramada', 'cambio_solicitado'].includes(cita.estado)) {
      return { ok: false, motivo: 'El estado actual no permite solicitar un cambio.' };
    }
    if (!Number.isNaN(inicioMs) && inicioMs - ahoraMs < horasMinimasAnticipacion * 3_600_000) {
      return { ok: false, motivo: `Los cambios deben solicitarse con al menos ${horasMinimasAnticipacion} horas de anticipación.` };
    }
    return { ok: true };
  }
  if (accion === 'cancelar') {
    if (!Number.isNaN(inicioMs) && inicioMs <= ahoraMs) {
      return { ok: false, motivo: 'No es posible cancelar una cita cuya hora de inicio ya pasó.' };
    }
    if (!Number.isNaN(inicioMs) && cita.estado === 'confirmada' && inicioMs - ahoraMs < horasMinimasAnticipacion * 3_600_000) {
      return { ok: false, motivo: `Para cancelar una cita confirmada se requieren al menos ${horasMinimasAnticipacion} horas de anticipación. Comunícate con IDC.` };
    }
    return { ok: true };
  }
  return { ok: false, motivo: 'Acción no reconocida.' };
}

export function transicionValidaIDC(
  estadoActual: EstadoCita,
  accion: AccionIdcCita,
): { ok: true; nuevoEstado: EstadoCita } | { ok: false; motivo: string } {
  if (estadoActual === 'cancelada' || estadoActual === 'realizada') {
    return { ok: false, motivo: 'Una cita cancelada o realizada no puede modificarse.' };
  }
  switch (accion) {
    case 'confirmar':
      if (!['solicitada', 'pendiente_confirmacion', 'cambio_solicitado'].includes(estadoActual)) {
        return { ok: false, motivo: 'La cita ya se encuentra confirmada o reprogramada.' };
      }
      return { ok: true, nuevoEstado: 'confirmada' };
    case 'proponer_horario':
      return { ok: true, nuevoEstado: 'cambio_solicitado' };
    case 'reprogramar':
      return { ok: true, nuevoEstado: 'reprogramada' };
    case 'cancelar':
      return { ok: true, nuevoEstado: 'cancelada' };
    case 'realizada':
      if (!['confirmada', 'reprogramada'].includes(estadoActual)) {
        return { ok: false, motivo: 'Solo una cita confirmada o reprogramada puede marcarse como realizada.' };
      }
      return { ok: true, nuevoEstado: 'realizada' };
  }
}

/**
 * Evalúa si el expediente cumple las condiciones para solicitar un tipo de cita.
 * Para «entrega_expediente», exige que TODOS los requisitos obligatorios aplicables cuenten con revisión
 * digital favorable (prevalidado/aceptado) o preparación autorizada sin bloqueos ni revisiones pendientes.
 */
export function evaluarElegibilidadCita(
  tipo: TipoVisita,
  vista: Pick<VistaPortal, 'documentos' | 'guiaDocumental'>,
  preparacion: readonly ProgresoPreparacion[] = [],
): ElegibilidadCita {
  const docs = (vista.documentos ?? []).filter((d) => d.estado !== 'no_aplica');
  const guias = new Map<string, GuiaDocumentoCliente>((vista.guiaDocumental ?? []).map((g) => [g.id, g]));
  const preparadosSet = new Set(preparacion.filter((p) => p.preparado).map((p) => p.documento));

  const pendientes: ElegibilidadCita['documentosPendientes'] = [];
  for (const d of docs) {
    const g = guias.get(d.id);
    const revObligatoria = g?.revisionDigital === 'obligatoria';
    const listoPorEstado =
      d.estado === 'aceptado' ||
      d.estado === 'prevalidado' ||
      (!revObligatoria && d.estado === 'pendiente' && preparadosSet.has(d.id));
    if (!listoPorEstado) {
      pendientes.push({ id: d.id, nombre: d.nombre, estado: d.estado });
    }
  }

  const totalObligatorios = docs.length;
  const preparadosObligatorios = totalObligatorios - pendientes.length;
  const expedienteListo = totalObligatorios > 0 && pendientes.length === 0;

  if (!INFO_TIPO_VISITA[tipo].requiereExpedienteListo) {
    return {
      permitida: true,
      etiquetaEstadoDocumental: expedienteListo
        ? 'Documentación preparada para entrega física'
        : `${preparadosObligatorios} de ${totalObligatorios} requisitos preparados`,
      motivoBloqueo: null,
      documentosPendientes: pendientes,
      totalObligatorios,
      preparadosObligatorios,
    };
  }

  if (totalObligatorios === 0) {
    return {
      permitida: false,
      etiquetaEstadoDocumental: 'Expediente documental no disponible',
      motivoBloqueo: 'Aún no hay requisitos documentales confirmados para agendar una entrega física completa.',
      documentosPendientes: [],
      totalObligatorios: 0,
      preparadosObligatorios: 0,
    };
  }

  if (!expedienteListo) {
    const correcciones = pendientes.filter((p) => p.estado === 'rechazado' || p.estado === 'vencido').length;
    const enRevision = pendientes.filter((p) => p.estado === 'en_revision' || p.estado === 'recibido').length;
    const partes: string[] = [];
    if (correcciones > 0) partes.push(`${correcciones} corrección${correcciones === 1 ? '' : 'es'} pendiente${correcciones === 1 ? '' : 's'}`);
    if (enRevision > 0) partes.push(`${enRevision} en revisión por IDC`);
    const faltantes = pendientes.length - correcciones - enRevision;
    if (faltantes > 0) partes.push(`${faltantes} por preparar`);
    return {
      permitida: false,
      etiquetaEstadoDocumental: `Preparación en curso (${preparadosObligatorios} de ${totalObligatorios})`,
      motivoBloqueo: `Todavía no es posible agendar la entrega física completa: tienes ${partes.join(', ')}.`,
      documentosPendientes: pendientes,
      totalObligatorios,
      preparadosObligatorios,
    };
  }

  return {
    permitida: true,
    etiquetaEstadoDocumental: 'Documentación preparada para entrega física',
    motivoBloqueo: null,
    documentosPendientes: [],
    totalObligatorios,
    preparadosObligatorios,
  };
}

/**
 * Construye dinámicamente la lista de preparación de visita según los requisitos aplicables,
 * las instrucciones físicas confirmadas (o pendientes de confirmación) y las entregas previas.
 * Nunca inventa requisitos de originales o copias si no están configurados.
 */
export function construirChecklistVisita(
  vista: Pick<VistaPortal, 'documentos' | 'guiaDocumental'>,
  marcadosParaVisita: readonly string[] = [],
  entregasFisicasRegistradas: readonly string[] = [],
): ChecklistVisitaItem[] {
  const docs = (vista.documentos ?? []).filter((d) => d.estado !== 'no_aplica');
  const guias = new Map((vista.guiaDocumental ?? []).map((g) => [g.id, g]));
  const marcadosSet = new Set(marcadosParaVisita);
  const entregadosSet = new Set(entregasFisicasRegistradas);

  return docs.map((d) => {
    const g = guias.get(d.id);
    const guiaPrep = g?.guiaPreparacion;
    const yaEntregado = entregadosSet.has(d.id);
    const reqFisica: RequiereEntregaFisica =
      g?.requiereEntregaFisica ??
      guiaPrep?.requiereEntregaFisica ??
      (g?.canal === 'fisico' ? 'si' : 'por_confirmar');

    let categoriaEntrega: ChecklistVisitaItem['categoriaEntrega'];
    let instruccionFisica: string;
    if (yaEntregado) {
      categoriaEntrega = 'ya_entregado';
      instruccionFisica = 'Ya registrado como recibido físicamente en IDC.';
    } else if (reqFisica === 'si') {
      categoriaEntrega = 'fisica_confirmada';
      instruccionFisica =
        guiaPrep?.entrega ??
        'Requiere entrega física en IDC. Confirma detalles de ejemplares antes de acudir.';
    } else if (reqFisica === 'no') {
      categoriaEntrega = 'solo_digital';
      instruccionFisica =
        guiaPrep?.entrega ??
        'No requiere entrega física; se gestiona de forma digital salvo instrucción distinta de IDC.';
    } else {
      categoriaEntrega = 'fisica_por_confirmar';
      instruccionFisica =
        guiaPrep?.entrega ??
        'IDC aún no ha confirmado si requiere copia física u original para este documento.';
    }

    return {
      documentoId: d.id,
      nombre: d.nombre,
      categoriaEntrega,
      instruccionFisica,
      requiereFirmas: guiaPrep?.requiereFirmas === true || !!guiaPrep?.firmas,
      originalOCopia: guiaPrep?.originalOCopia ?? null,
      preparadoParaVisita: marcadosSet.has(d.id),
      estadoDocumento: d.estado,
    };
  });
}

function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function aFechaIcsUtc(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Genera un archivo .ics (RFC 5545) únicamente para citas confirmadas o reprogramadas.
 * No incluye datos personales del cliente ni códigos de acceso.
 */
export function generarICS(cita: CitaPortal): string | null {
  if (cita.estado !== 'confirmada' && cita.estado !== 'reprogramada') return null;
  const info = INFO_TIPO_VISITA[cita.tipoVisita];
  const ubicacion = cita.ubicacionAutorizada ?? 'Oficinas IDC Sistemas Eléctricos (ubicación confirmada por IDC)';
  const descripcion = [
    `Folio del proyecto: ${cita.folio}`,
    `Referencia de cita: ${cita.referencia}`,
    `Motivo: ${info.titulo}`,
    'Consulta en tu portal KairóVolt la lista de documentos que debes llevar.',
    ...(cita.simulada ? ['Nota: Cita generada en modo demostración.'] : []),
  ].join('\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KairoVolt//IDC Sistemas Electricos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${cita.referencia}@kairovolt.local`,
    `DTSTAMP:${aFechaIcsUtc(cita.actualizadoEn)}`,
    `DTSTART:${aFechaIcsUtc(cita.inicioIso)}`,
    `DTEND:${aFechaIcsUtc(cita.finIso)}`,
    `SUMMARY:${escaparIcs(`KairóVolt | ${info.titulo} (${cita.folio})`)}`,
    `LOCATION:${escaparIcs(ubicacion)}`,
    `DESCRIPTION:${escaparIcs(descripcion)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Genera lista imprimible / descargable sin datos personales innecesarios. */
export function generarTextoChecklistVisita(folio: string, items: readonly ChecklistVisitaItem[]): string {
  const lineas: string[] = [
    'KairóVolt · Lista de preparación para tu visita a IDC',
    `Folio: ${folio}`,
    'Nota: Lista de apoyo personal. No incluye datos personales ni sustituye la recepción física de IDC.',
    '',
  ];
  const grupos: { titulo: string; lista: ChecklistVisitaItem[] }[] = [
    { titulo: 'TU CARPETA FÍSICA', lista: items.filter((i) => i.categoriaEntrega !== 'solo_digital') },
  ];
  for (const g of grupos) {
    if (!g.lista.length) continue;
    lineas.push(g.titulo);
    for (const item of g.lista) {
      const marca = item.preparadoParaVisita ? '[x]' : '[ ]';
      const extras = [
        item.requiereFirmas ? 'Requiere firmas' : null,
        item.originalOCopia ? item.originalOCopia : null,
      ].filter(Boolean).join(' · ');
      lineas.push(`  ${marca} ${item.nombre}${extras ? ` (${extras})` : ''}`);
    }
    lineas.push('');
  }
  return lineas.join('\n');
}
