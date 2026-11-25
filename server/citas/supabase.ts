import {
  construirIsoHermosillo,
  ESTADOS_CITA_ACTIVOS,
  fechaHoyHermosillo,
  INFO_TIPO_VISITA,
  seTraslapan,
  sumarMinutosHora,
  ZONA_HORARIA_IDC,
  type CambioHistorialCita,
  type CitaPortal,
  type ConfigAgendaIDC,
  type DiaDisponibilidad,
  type EstadoCita,
  type HorarioSlot,
  type TipoVisita,
} from '../../src/domain/citas/cita';
import type { EventoPublico, Notificacion } from '../../src/application/portal-cliente';
import { SupabaseError, type ClienteSupabase } from '../supabase/cliente';
import { ErrorCita, type ProveedorAgenda } from './proveedor';

interface FilaConfigAgenda {
  zona_horaria: string;
  dias_laborables: number[];
  horarios_inicio: string[];
  dias_no_laborables: string[];
  duracion_minutos: number;
  ubicacion_autorizada: string | null;
  tipos_habilitados: TipoVisita[];
  horas_anticipacion_cancelacion: number;
  disponibilidad_publicada: boolean;
  proveedor: 'manual_supabase' | 'zoho_pendiente';
}

interface FilaHistorial {
  id: string;
  creado_en: string;
  estado_anterior: EstadoCita | null;
  estado_nuevo: EstadoCita;
  actor_tipo: 'cliente' | 'idc' | 'sistema';
  detalle: string | null;
}

interface FilaCita {
  id: string;
  referencia: string;
  folio: string;
  tipo_visita: TipoVisita;
  estado: EstadoCita;
  inicio_en: string;
  fin_en: string;
  zona_horaria: string;
  duracion_minutos: number;
  ubicacion_autorizada: string | null;
  notas_cliente: string | null;
  motivo_cancelacion: string | null;
  propuesta_inicio_en: string | null;
  propuesta_fin_en: string | null;
  propuesta_por: 'cliente' | 'idc' | null;
  propuesta_nota: string | null;
  proveedor_externo: string | null;
  referencia_externa_id: string | null;
  creado_en: string;
  actualizado_en: string;
  portal_citas_historial?: FilaHistorial[];
}

function partesHermosillo(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONA_HORARIA_IDC }).format(d);
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA_HORARIA_IDC }).format(d);
  return { fecha: f, hora: h };
}

function mapearCita(f: FilaCita): CitaPortal {
  const ini = partesHermosillo(f.inicio_en);
  const fin = partesHermosillo(f.fin_en);
  const propIni = f.propuesta_inicio_en ? partesHermosillo(f.propuesta_inicio_en) : null;
  const propFin = f.propuesta_fin_en ? partesHermosillo(f.propuesta_fin_en) : null;
  const historial: CambioHistorialCita[] = (f.portal_citas_historial ?? [])
    .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
    .map((h) => ({
      id: h.id,
      fecha: h.creado_en,
      estadoAnterior: h.estado_anterior,
      estadoNuevo: h.estado_nuevo,
      actor: h.actor_tipo,
      detalle: h.detalle,
    }));
  return {
    id: f.id,
    referencia: f.referencia,
    folio: f.folio,
    tipoVisita: f.tipo_visita,
    estado: f.estado,
    fecha: ini.fecha,
    horaInicio: ini.hora,
    horaFin: fin.hora,
    inicioIso: f.inicio_en,
    finIso: f.fin_en,
    zonaHoraria: f.zona_horaria || ZONA_HORARIA_IDC,
    duracionMinutos: f.duracion_minutos,
    ubicacionAutorizada: f.ubicacion_autorizada,
    notasCliente: f.notas_cliente,
    motivoCancelacion: f.motivo_cancelacion,
    propuestaFecha: propIni?.fecha ?? null,
    propuestaHoraInicio: propIni?.hora ?? null,
    propuestaHoraFin: propFin?.hora ?? null,
    propuestaPor: f.propuesta_por,
    propuestaNota: f.propuesta_nota,
    proveedorExterno: f.proveedor_externo,
    referenciaExternaId: f.referencia_externa_id,
    simulada: false,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    historial,
  };
}

const CONFIG_NO_PUBLICADA: ConfigAgendaIDC = {
  zonaHoraria: ZONA_HORARIA_IDC,
  diasLaborables: [],
  horariosInicio: [],
  diasNoLaborables: [],
  duracionMinutos: 45,
  ubicacionAutorizada: null,
  tiposHabilitados: ['entrega_expediente'],
  horasAnticipacionCancelacion: 2,
  disponibilidadPublicada: false,
  simulada: false,
  proveedor: 'manual_supabase',
};

const SELECT_CITA =
  'id,referencia,folio,tipo_visita,estado,inicio_en,fin_en,zona_horaria,duracion_minutos,ubicacion_autorizada,notas_cliente,motivo_cancelacion,propuesta_inicio_en,propuesta_fin_en,propuesta_por,propuesta_nota,proveedor_externo,referencia_externa_id,creado_en,actualizado_en,portal_citas_historial(id,creado_en,estado_anterior,estado_nuevo,actor_tipo,detalle)';

function mapearErrorSql(e: unknown): never {
  if (e instanceof SupabaseError) {
    if (e.codigo === '23P01') {
      throw new ErrorCita('horario_no_disponible', 'Ese horario acaba de ser reservado. Elige otro bloque disponible.', 409);
    }
    if (e.codigo === '23505') {
      throw new ErrorCita('cita_duplicada', 'Ya existe una cita activa para este expediente o solicitud.', 409);
    }
    if (e.codigo === '40001') {
      throw new ErrorCita('transicion_invalida', e.message || 'El estado de la cita cambió; recarga e intenta de nuevo.', 409);
    }
    if (e.codigo === '22023') {
      throw new ErrorCita('datos_invalidos', e.message || 'Revisa los datos de la cita.', 422);
    }
  }
  throw e;
}

/**
 * Adaptador real de citas sobre Supabase (migraciones 016 y 017).
 * No publica disponibilidad real hasta que IDC configure y active `portal_agenda_config.disponibilidad_publicada = true`.
 */
export function crearCitasSupabase(sb: ClienteSupabase, ahora: () => number = Date.now): ProveedorAgenda {
  const leerConfig = async (): Promise<ConfigAgendaIDC> => {
    try {
      const filas = await sb.rest<FilaConfigAgenda[]>('GET', '/portal_agenda_config?limit=1');
      const f = filas?.[0];
      if (!f) return CONFIG_NO_PUBLICADA;
      return {
        zonaHoraria: f.zona_horaria || ZONA_HORARIA_IDC,
        diasLaborables: f.dias_laborables ?? [],
        horariosInicio: f.horarios_inicio ?? [],
        diasNoLaborables: f.dias_no_laborables ?? [],
        duracionMinutos: f.duracion_minutos ?? 45,
        ubicacionAutorizada: f.ubicacion_autorizada ?? null,
        tiposHabilitados: f.tipos_habilitados ?? ['entrega_expediente'],
        horasAnticipacionCancelacion: f.horas_anticipacion_cancelacion ?? 2,
        disponibilidadPublicada: f.disponibilidad_publicada === true,
        simulada: false,
        proveedor: f.proveedor ?? 'manual_supabase',
      };
    } catch {
      return CONFIG_NO_PUBLICADA;
    }
  };

  return {
    obtenerConfig: leerConfig,

    async actualizarConfig(cambios, actorId) {
      await sb.rest('POST', '/rpc/configurar_agenda_idc', { p_datos: cambios, p_actor: actorId });
      return leerConfig();
    },

    async consultarDisponibilidad(mes, tipo) {
      const config = await leerConfig();
      if (!config.disponibilidadPublicada) {
        return { config, dias: [] };
      }
      const [yStr, mStr] = mes.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const inicioMes = construirIsoHermosillo(`${mes}-01`, '00:00');
      const finMes = construirIsoHermosillo(`${mes}-${String(total).padStart(2, '0')}`, '23:59');
      const ocupadas = await sb.rest<{ inicio_en: string; fin_en: string }[]>(
        'GET',
        `/portal_citas?select=inicio_en,fin_en&estado=in.(${ESTADOS_CITA_ACTIVOS.join(',')})&inicio_en=gte.${encodeURIComponent(inicioMes)}&inicio_en=lte.${encodeURIComponent(finMes)}`,
      );
      const hoy = fechaHoyHermosillo(ahora());
      const duracion = INFO_TIPO_VISITA[tipo]?.duracionPorDefectoMin ?? config.duracionMinutos;
      const dias: DiaDisponibilidad[] = Array.from({ length: total }, (_, i) => {
        const fecha = `${mes}-${String(i + 1).padStart(2, '0')}`;
        const pasado = fecha < hoy;
        const dowRaw = new Date(`${fecha}T12:00:00-07:00`).getUTCDay();
        const dow = dowRaw === 0 ? 7 : dowRaw;
        const laborable = config.diasLaborables.includes(dow) && !config.diasNoLaborables.includes(fecha);
        const slots: HorarioSlot[] = config.horariosInicio.map((horaInicio) => {
          const horaFin = sumarMinutosHora(horaInicio, duracion);
          const inicioIso = construirIsoHermosillo(fecha, horaInicio);
          const finIso = construirIsoHermosillo(fecha, horaFin);
          if (pasado || Date.parse(inicioIso) <= ahora()) {
            return { horaInicio, horaFin, inicioIso, finIso, disponible: false, motivoNoDisponible: 'pasado' };
          }
          if (!laborable) {
            return { horaInicio, horaFin, inicioIso, finIso, disponible: false, motivoNoDisponible: 'no_laborable' };
          }
          const ocupado = ocupadas.some((o) => seTraslapan(o.inicio_en, o.fin_en, inicioIso, finIso));
          if (ocupado) return { horaInicio, horaFin, inicioIso, finIso, disponible: false, motivoNoDisponible: 'ocupado' };
          return { horaInicio, horaFin, inicioIso, finIso, disponible: true };
        });
        const disponibles = slots.filter((s) => s.disponible).length;
        const ocupados = slots.filter((s) => s.motivoNoDisponible === 'ocupado').length;
        return { fecha, laborable, pasado, tieneDisponibilidad: disponibles > 0, disponibles, ocupados, slots };
      });
      return { config, dias };
    },

    async listarPorFolio(folio) {
      const filas = await sb.rest<FilaCita[]>(
        'GET',
        `/portal_citas?select=${SELECT_CITA}&folio=eq.${encodeURIComponent(folio)}&order=creado_en.desc&limit=20`,
      ).catch(() => []);
      return filas.map(mapearCita);
    },

    async obtenerActiva(folio) {
      const lista = await this.listarPorFolio(folio);
      return lista.find((c) => ESTADOS_CITA_ACTIVOS.includes(c.estado)) ?? lista[0] ?? null;
    },

    async obtenerPorId(citaId) {
      const filas = await sb.rest<FilaCita[]>('GET', `/portal_citas?select=${SELECT_CITA}&id=eq.${encodeURIComponent(citaId)}&limit=1`);
      return filas[0] ? mapearCita(filas[0]) : null;
    },

    async solicitar(entrada) {
      if (INFO_TIPO_VISITA[entrada.tipoVisita].requiereExpedienteListo && !entrada.expedienteListo) {
        throw new ErrorCita('expediente_no_listo', entrada.motivoNoListo ?? 'Completa tus requisitos obligatorios primero.', 409);
      }
      const config = await leerConfig();
      if (!config.disponibilidadPublicada) {
        throw new ErrorCita('agenda_no_publicada', 'La agenda aún no está publicada por IDC.', 503);
      }
      const duracion = INFO_TIPO_VISITA[entrada.tipoVisita].duracionPorDefectoMin ?? config.duracionMinutos;
      const inicioIso = construirIsoHermosillo(entrada.fecha, entrada.horaInicio);
      const finIso = construirIsoHermosillo(entrada.fecha, sumarMinutosHora(entrada.horaInicio, duracion));
      try {
        const res = await sb.rest<{ id: string; duplicada: boolean }>('POST', '/rpc/solicitar_cita_portal', {
          p_acceso: entrada.accesoId,
          p_folio: entrada.folio,
          p_tipo: entrada.tipoVisita,
          p_inicio: inicioIso,
          p_fin: finIso,
          p_duracion: duracion,
          p_notas: entrada.notasCliente,
          p_idempotency_key: entrada.idempotencyKey,
        });
        const cita = await this.obtenerPorId(res.id);
        if (!cita) throw new Error('No se pudo leer la cita creada.');
        return { cita, duplicada: res.duplicada === true };
      } catch (e) {
        mapearErrorSql(e);
      }
    },

    async accionCliente(entrada) {
      try {
        const inicio = entrada.nuevaFecha && entrada.nuevaHoraInicio ? construirIsoHermosillo(entrada.nuevaFecha, entrada.nuevaHoraInicio) : null;
        await sb.rest('POST', '/rpc/accion_cita_cliente', {
          p_folio: entrada.folio,
          p_cita_id: entrada.citaId,
          p_accion: entrada.accion,
          p_nuevo_inicio: inicio,
          p_motivo: entrada.motivo ?? null,
        });
        const cita = await this.obtenerPorId(entrada.citaId);
        if (!cita) throw new ErrorCita('cita_no_encontrada', 'No encontramos la cita.', 404);
        return cita;
      } catch (e) {
        mapearErrorSql(e);
      }
    },

    async listarAdmin(filtros) {
      const q = new URLSearchParams({ select: SELECT_CITA, order: 'inicio_en.asc', limit: '100' });
      if (filtros.folio) q.set('folio', `eq.${filtros.folio}`);
      if (filtros.estado) q.set('estado', `eq.${filtros.estado}`);
      if (filtros.fecha) {
        q.set('inicio_en', `gte.${construirIsoHermosillo(filtros.fecha, '00:00')}`);
      }
      const filas = await sb.rest<FilaCita[]>('GET', `/portal_citas?${q}`);
      return filas.map(mapearCita).filter((c) => !filtros.fecha || c.fecha === filtros.fecha);
    },

    async accionAdmin(entrada) {
      try {
        const inicio = entrada.nuevaFecha && entrada.nuevaHoraInicio ? construirIsoHermosillo(entrada.nuevaFecha, entrada.nuevaHoraInicio) : null;
        await sb.rest('POST', '/rpc/gestionar_cita_idc', {
          p_cita_id: entrada.citaId,
          p_actor: entrada.actorId,
          p_accion: entrada.accion,
          p_nuevo_inicio: inicio,
          p_motivo: entrada.motivo ?? null,
          p_ubicacion: entrada.ubicacionAutorizada ?? null,
        });
        const cita = await this.obtenerPorId(entrada.citaId);
        if (!cita) throw new ErrorCita('cita_no_encontrada', 'No encontramos la cita.', 404);
        return cita;
      } catch (e) {
        mapearErrorSql(e);
      }
    },

    async notificacionesDe(folio) {
      const lista = await this.listarPorFolio(folio);
      return lista.flatMap((c) =>
        c.historial.map((h): Notificacion => ({
          id: `n:cita:${h.id}`,
          citaId: c.id,
          eventoTipo: `cita_${h.estadoNuevo}`,
          tipo: h.estadoNuevo === 'cambio_solicitado' && h.actor === 'idc' ? 'accion' : 'cita',
          titulo:
            h.estadoNuevo === 'confirmada' ? 'Tu visita a IDC está confirmada'
            : h.estadoNuevo === 'cambio_solicitado' && h.actor === 'idc' ? 'IDC propuso un nuevo horario para tu visita'
            : h.estadoNuevo === 'reprogramada' ? 'Tu cita con IDC fue reprogramada'
            : h.estadoNuevo === 'cancelada' ? 'Tu cita fue cancelada'
            : h.estadoNuevo === 'realizada' ? 'Registramos tu visita en IDC'
            : 'Recibimos tu solicitud de cita',
          detalle: h.detalle,
          fecha: h.fecha,
        })),
      );
    },

    async historialDe(folio) {
      const lista = await this.listarPorFolio(folio);
      return lista.flatMap((c) =>
        c.historial.map((h): EventoPublico => ({
          id: `c:${h.id}`,
          fecha: h.fecha.slice(0, 10),
          titulo: `Cita ${h.estadoNuevo.replaceAll('_', ' ')} (${c.referencia})`,
        })),
      );
    },

    async obtenerChecklistVisita(folio) {
      try {
        const filas = await sb.rest<{ marcados: string[] }[]>(
          'GET',
          `/portal_visita_checklist?select=marcados,proyectos!inner()&proyectos.folio=eq.${encodeURIComponent(folio)}&limit=1`,
        );
        return filas[0]?.marcados ?? [];
      } catch {
        return [];
      }
    },

    async guardarChecklistVisita(folio, accesoId, marcados) {
      const res = await sb.rest<{ marcados: string[] }>('POST', '/rpc/guardar_checklist_visita_portal', {
        p_acceso: accesoId,
        p_folio: folio,
        p_marcados: marcados,
      });
      return res?.marcados ?? marcados;
    },
  };
}
