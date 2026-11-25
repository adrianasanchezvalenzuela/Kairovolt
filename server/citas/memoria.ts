import { randomUUID } from 'node:crypto';
import {
  construirIsoHermosillo,
  ESTADOS_CITA_ACTIVOS,
  fechaHoyHermosillo,
  formatearFechaLargaHermosillo,
  INFO_TIPO_VISITA,
  seTraslapan,
  sumarMinutosHora,
  transicionValidaCliente,
  transicionValidaIDC,
  ZONA_HORARIA_IDC,
  type CitaPortal,
  type ConfigAgendaIDC,
  type DiaDisponibilidad,
  type HorarioSlot,
} from '../../src/domain/citas/cita';
import type { EventoPublico, Notificacion } from '../../src/application/portal-cliente';
import { ErrorCita, type ProveedorAgenda } from './proveedor';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;

function diaSemanaIso(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00-07:00`).getUTCDay();
  return d === 0 ? 7 : d;
}

function diasDelMes(mes: string): string[] {
  const [yStr, mStr] = mes.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

/** Determina horarios ficticios ocupados de forma estable para la demostración. */
function esOcupadoSimulado(fecha: string, hora: string): boolean {
  const dia = Number(fecha.slice(8, 10));
  const dow = diaSemanaIso(fecha);
  if (dow === 2 && (hora === '10:00' || hora === '15:00')) return true;
  if (dow === 4 && (hora === '09:00' || hora === '12:00')) return true;
  if (dia % 5 === 0 && hora === '11:00') return true;
  if (dia % 7 === 0 && (hora === '09:00' || hora === '10:00' || hora === '11:00' || hora === '12:00' || hora === '15:00' || hora === '16:00')) {
    return true;
  }
  return false;
}

function fechasNoLaborablesDemo(hoy: string): string[] {
  // Marca un día hábil próximo (12 días adelante si cae entre semana) como día no laborable configurado de ejemplo.
  const base = Date.parse(`${hoy}T12:00:00-07:00`);
  for (let i = 10; i <= 16; i++) {
    const f = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    const dow = diaSemanaIso(f);
    if (dow >= 1 && dow <= 5) return [f];
  }
  return [];
}

/**
 * Proveedor de agenda en memoria para modo DEMO.
 * Incluye protección síncrona contra traslapes, doble reserva concurrente e idempotencia.
 */
export function crearCitasMemoria(ahora: () => number = Date.now): ProveedorAgenda {
  const hoyInicial = fechaHoyHermosillo(ahora());
  let config: ConfigAgendaIDC = {
    zonaHoraria: ZONA_HORARIA_IDC,
    diasLaborables: [1, 2, 3, 4, 5],
    horariosInicio: ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00'],
    diasNoLaborables: fechasNoLaborablesDemo(hoyInicial),
    duracionMinutos: 45,
    ubicacionAutorizada: null,
    tiposHabilitados: ['entrega_expediente', 'aclaracion_documental'],
    horasAnticipacionCancelacion: 2,
    disponibilidadPublicada: true,
    simulada: true,
    proveedor: 'demo',
  };

  const citas: CitaPortal[] = [];
  const porIdempotencia = new Map<string, string>();
  const checklists = new Map<string, string[]>();

  const activas = () => citas.filter((c) => ESTADOS_CITA_ACTIVOS.includes(c.estado));

  function validarHorarioDisponible(fecha: string, horaInicio: string, duracionMinutos: number, excluirCitaId?: string) {
    if (!FECHA_RE.test(fecha) || !HORA_RE.test(horaInicio)) {
      throw new ErrorCita('datos_invalidos', 'Selecciona una fecha y un horario válidos.', 422);
    }
    const hoy = fechaHoyHermosillo(ahora());
    if (fecha < hoy) {
      throw new ErrorCita('horario_no_disponible', 'No es posible elegir una fecha pasada.', 409);
    }
    const dow = diaSemanaIso(fecha);
    if (!config.diasLaborables.includes(dow) || config.diasNoLaborables.includes(fecha)) {
      throw new ErrorCita('horario_no_disponible', 'Ese día no tiene atención disponible en la agenda.', 409);
    }
    if (!config.horariosInicio.includes(horaInicio)) {
      throw new ErrorCita('horario_no_disponible', 'El horario seleccionado no forma parte de los bloques configurados.', 409);
    }
    const horaFin = sumarMinutosHora(horaInicio, duracionMinutos);
    const inicioIso = construirIsoHermosillo(fecha, horaInicio);
    const finIso = construirIsoHermosillo(fecha, horaFin);
    if (Date.parse(inicioIso) <= ahora()) {
      throw new ErrorCita('horario_no_disponible', 'Ese horario ya pasó. Elige un bloque posterior.', 409);
    }
    if (config.simulada && esOcupadoSimulado(fecha, horaInicio)) {
      throw new ErrorCita('horario_no_disponible', 'Ese horario ya está ocupado. Selecciona otro bloque disponible.', 409);
    }
    const hayTraslape = activas().some(
      (c) => c.id !== excluirCitaId && seTraslapan(c.inicioIso, c.finIso, inicioIso, finIso),
    );
    if (hayTraslape) {
      throw new ErrorCita('horario_no_disponible', 'Otro expediente reservó ese horario mientras confirmabas. Elige otro bloque.', 409);
    }
    return { horaFin, inicioIso, finIso };
  }

  function construirDia(fecha: string, duracion: number): DiaDisponibilidad {
    const hoy = fechaHoyHermosillo(ahora());
    const pasado = fecha < hoy;
    const dow = diaSemanaIso(fecha);
    const laborable = config.diasLaborables.includes(dow) && !config.diasNoLaborables.includes(fecha);
    const citasActivas = activas();
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
      const ocupadoPorSim = config.simulada && esOcupadoSimulado(fecha, horaInicio);
      const ocupadoPorCita = citasActivas.some((c) => seTraslapan(c.inicioIso, c.finIso, inicioIso, finIso));
      if (ocupadoPorSim || ocupadoPorCita) {
        return { horaInicio, horaFin, inicioIso, finIso, disponible: false, motivoNoDisponible: 'ocupado' };
      }
      return { horaInicio, horaFin, inicioIso, finIso, disponible: true };
    });
    const disponibles = slots.filter((s) => s.disponible).length;
    const ocupados = slots.filter((s) => s.motivoNoDisponible === 'ocupado').length;
    return { fecha, laborable, pasado, tieneDisponibilidad: disponibles > 0, disponibles, ocupados, slots };
  }

  return {
    async obtenerConfig() {
      return { ...config, diasLaborables: [...config.diasLaborables], horariosInicio: [...config.horariosInicio], diasNoLaborables: [...config.diasNoLaborables], tiposHabilitados: [...config.tiposHabilitados] };
    },

    async actualizarConfig(cambios) {
      config = {
        ...config,
        ...(cambios.diasLaborables && { diasLaborables: cambios.diasLaborables }),
        ...(cambios.horariosInicio && { horariosInicio: cambios.horariosInicio }),
        ...(cambios.diasNoLaborables && { diasNoLaborables: cambios.diasNoLaborables }),
        ...(typeof cambios.duracionMinutos === 'number' && { duracionMinutos: cambios.duracionMinutos }),
        ...(cambios.ubicacionAutorizada !== undefined && { ubicacionAutorizada: cambios.ubicacionAutorizada }),
        ...(cambios.tiposHabilitados && { tiposHabilitados: cambios.tiposHabilitados }),
        ...(typeof cambios.disponibilidadPublicada === 'boolean' && { disponibilidadPublicada: cambios.disponibilidadPublicada }),
      };
      return this.obtenerConfig();
    },

    async consultarDisponibilidad(mes, tipo) {
      if (!MES_RE.test(mes)) throw new ErrorCita('datos_invalidos', 'Mes inválido (usa AAAA-MM).', 422);
      const duracion = INFO_TIPO_VISITA[tipo]?.duracionPorDefectoMin ?? config.duracionMinutos;
      const dias = diasDelMes(mes).map((f) => construirDia(f, duracion));
      return { config: await this.obtenerConfig(), dias };
    },

    async listarPorFolio(folio) {
      return citas
        .filter((c) => c.folio === folio)
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
        .map((c) => ({ ...c, historial: [...c.historial] }));
    },

    async obtenerActiva(folio) {
      const lista = await this.listarPorFolio(folio);
      return lista.find((c) => ESTADOS_CITA_ACTIVOS.includes(c.estado)) ?? lista[0] ?? null;
    },

    async obtenerPorId(citaId) {
      const c = citas.find((x) => x.id === citaId);
      return c ? { ...c, historial: [...c.historial] } : null;
    },

    async solicitar(entrada) {
      if (!config.disponibilidadPublicada) {
        throw new ErrorCita('agenda_no_publicada', 'La disponibilidad de citas aún no ha sido publicada por IDC.', 503);
      }
      if (!config.tiposHabilitados.includes(entrada.tipoVisita)) {
        throw new ErrorCita('datos_invalidos', 'Ese tipo de visita no está habilitado actualmente.', 422);
      }
      if (entrada.idempotencyKey) {
        const previaId = porIdempotencia.get(`${entrada.folio}:${entrada.idempotencyKey}`);
        if (previaId) {
          const previa = citas.find((c) => c.id === previaId);
          if (previa) return { cita: { ...previa, historial: [...previa.historial] }, duplicada: true };
        }
      }
      if (INFO_TIPO_VISITA[entrada.tipoVisita].requiereExpedienteListo && !entrada.expedienteListo) {
        throw new ErrorCita(
          'expediente_no_listo',
          entrada.motivoNoListo ?? 'Completa la preparación de tus documentos obligatorios antes de agendar la entrega física.',
          409,
        );
      }
      const activaMisma = activas().find((c) => c.folio === entrada.folio && c.tipoVisita === entrada.tipoVisita);
      if (activaMisma) {
        throw new ErrorCita(
          'cita_duplicada',
          `Ya tienes una solicitud activa (${activaMisma.referencia}) para este tipo de visita. Consúltala o solicita un cambio.`,
          409,
        );
      }

      const duracion = INFO_TIPO_VISITA[entrada.tipoVisita].duracionPorDefectoMin ?? config.duracionMinutos;
      const { horaFin, inicioIso, finIso } = validarHorarioDisponible(entrada.fecha, entrada.horaInicio, duracion);
      const sello = new Date(ahora()).toISOString();
      const id = randomUUID();
      const referencia = `CITA-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
      const nueva: CitaPortal = {
        id,
        referencia,
        folio: entrada.folio,
        tipoVisita: entrada.tipoVisita,
        estado: 'solicitada',
        fecha: entrada.fecha,
        horaInicio: entrada.horaInicio,
        horaFin,
        inicioIso,
        finIso,
        zonaHoraria: config.zonaHoraria,
        duracionMinutos: duracion,
        ubicacionAutorizada: config.ubicacionAutorizada,
        notasCliente: entrada.notasCliente,
        motivoCancelacion: null,
        propuestaFecha: null,
        propuestaHoraInicio: null,
        propuestaHoraFin: null,
        propuestaPor: null,
        propuestaNota: null,
        proveedorExterno: config.proveedor,
        referenciaExternaId: null,
        simulada: config.simulada,
        creadoEn: sello,
        actualizadoEn: sello,
        historial: [
          {
            id: randomUUID(),
            fecha: sello,
            estadoAnterior: null,
            estadoNuevo: 'solicitada',
            actor: 'cliente',
            detalle: `Solicitud registrada para el ${formatearFechaLargaHermosillo(entrada.fecha)} a las ${entrada.horaInicio} (Hermosillo).`,
          },
        ],
      };
      citas.push(nueva);
      if (entrada.idempotencyKey) porIdempotencia.set(`${entrada.folio}:${entrada.idempotencyKey}`, id);
      return { cita: { ...nueva, historial: [...nueva.historial] }, duplicada: false };
    },

    async accionCliente(entrada) {
      const cita = citas.find((c) => c.id === entrada.citaId && c.folio === entrada.folio);
      if (!cita) throw new ErrorCita('cita_no_encontrada', 'No encontramos esa cita en tu expediente.', 404);

      const check = transicionValidaCliente(cita, entrada.accion, ahora(), config.horasAnticipacionCancelacion);
      if (!check.ok) throw new ErrorCita('transicion_invalida', check.motivo, 409);

      const sello = new Date(ahora()).toISOString();
      const estadoAnterior = cita.estado;

      if (entrada.accion === 'cancelar') {
        const motivo = entrada.motivo?.trim() || 'Cancelada por el cliente desde el portal.';
        cita.estado = 'cancelada';
        cita.motivoCancelacion = motivo;
        cita.propuestaFecha = null;
        cita.propuestaHoraInicio = null;
        cita.propuestaHoraFin = null;
        cita.propuestaPor = null;
        cita.actualizadoEn = sello;
        cita.historial.push({
          id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'cancelada', actor: 'cliente', detalle: motivo,
        });
        return { ...cita, historial: [...cita.historial] };
      }

      if (entrada.accion === 'aceptar_propuesta') {
        if (!cita.propuestaFecha || !cita.propuestaHoraInicio) {
          throw new ErrorCita('transicion_invalida', 'No hay un horario propuesto válido.', 409);
        }
        const { horaFin, inicioIso, finIso } = validarHorarioDisponible(
          cita.propuestaFecha, cita.propuestaHoraInicio, cita.duracionMinutos, cita.id,
        );
        cita.fecha = cita.propuestaFecha;
        cita.horaInicio = cita.propuestaHoraInicio;
        cita.horaFin = horaFin;
        cita.inicioIso = inicioIso;
        cita.finIso = finIso;
        cita.estado = 'reprogramada';
        cita.propuestaFecha = null;
        cita.propuestaHoraInicio = null;
        cita.propuestaHoraFin = null;
        cita.propuestaPor = null;
        cita.propuestaNota = null;
        cita.actualizadoEn = sello;
        cita.historial.push({
          id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'reprogramada', actor: 'cliente',
          detalle: `Propuesta aceptada: ${formatearFechaLargaHermosillo(cita.fecha)} · ${cita.horaInicio} (Hermosillo).`,
        });
        return { ...cita, historial: [...cita.historial] };
      }

      // solicitar_cambio: nunca modifica directamente una cita confirmada; registra solicitud para revisión de IDC.
      if (!entrada.nuevaFecha || !entrada.nuevaHoraInicio) {
        throw new ErrorCita('datos_invalidos', 'Indica la nueva fecha y horario que prefieres proponer.', 422);
      }
      const { horaFin } = validarHorarioDisponible(entrada.nuevaFecha, entrada.nuevaHoraInicio, cita.duracionMinutos, cita.id);
      cita.estado = 'cambio_solicitado';
      cita.propuestaFecha = entrada.nuevaFecha;
      cita.propuestaHoraInicio = entrada.nuevaHoraInicio;
      cita.propuestaHoraFin = horaFin;
      cita.propuestaPor = 'cliente';
      cita.propuestaNota = entrada.motivo?.trim() || null;
      cita.actualizadoEn = sello;
      cita.historial.push({
        id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'cambio_solicitado', actor: 'cliente',
        detalle: `Solicitud de cambio al ${formatearFechaLargaHermosillo(entrada.nuevaFecha)} a las ${entrada.nuevaHoraInicio} (Hermosillo).${cita.propuestaNota ? ' ' + cita.propuestaNota : ''}`,
      });
      return { ...cita, historial: [...cita.historial] };
    },

    async listarAdmin(filtros) {
      return citas
        .filter((c) => (!filtros.folio || c.folio === filtros.folio)
          && (!filtros.estado || c.estado === filtros.estado)
          && (!filtros.fecha || c.fecha === filtros.fecha))
        .sort((a, b) => a.inicioIso.localeCompare(b.inicioIso))
        .map((c) => ({ ...c, historial: [...c.historial] }));
    },

    async accionAdmin(entrada) {
      const cita = citas.find((c) => c.id === entrada.citaId);
      if (!cita) throw new ErrorCita('cita_no_encontrada', 'No encontramos esa solicitud de cita.', 404);

      const check = transicionValidaIDC(cita.estado, entrada.accion);
      if (!check.ok) throw new ErrorCita('transicion_invalida', check.motivo, 409);

      const sello = new Date(ahora()).toISOString();
      const estadoAnterior = cita.estado;

      if (entrada.accion === 'confirmar') {
        // Si el cliente había solicitado un cambio de horario, al confirmar IDC aplica ese horario tras revalidar.
        if (estadoAnterior === 'cambio_solicitado' && cita.propuestaPor === 'cliente' && cita.propuestaFecha && cita.propuestaHoraInicio) {
          const { horaFin, inicioIso, finIso } = validarHorarioDisponible(
            cita.propuestaFecha, cita.propuestaHoraInicio, cita.duracionMinutos, cita.id,
          );
          cita.fecha = cita.propuestaFecha;
          cita.horaInicio = cita.propuestaHoraInicio;
          cita.horaFin = horaFin;
          cita.inicioIso = inicioIso;
          cita.finIso = finIso;
          cita.estado = 'reprogramada';
        } else {
          cita.estado = 'confirmada';
        }
        if (entrada.ubicacionAutorizada !== undefined) {
          cita.ubicacionAutorizada = entrada.ubicacionAutorizada?.trim() || null;
        }
        cita.propuestaFecha = null;
        cita.propuestaHoraInicio = null;
        cita.propuestaHoraFin = null;
        cita.propuestaPor = null;
        cita.propuestaNota = null;
        cita.actualizadoEn = sello;
        cita.historial.push({
          id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: cita.estado, actor: 'idc',
          detalle: `IDC confirmó la visita para el ${formatearFechaLargaHermosillo(cita.fecha)} a las ${cita.horaInicio} (Hermosillo).`,
        });
        return { ...cita, historial: [...cita.historial] };
      }

      if (entrada.accion === 'proponer_horario') {
        if (!entrada.nuevaFecha || !entrada.nuevaHoraInicio) {
          throw new ErrorCita('datos_invalidos', 'Indica la fecha y horario propuestos.', 422);
        }
        const { horaFin } = validarHorarioDisponible(entrada.nuevaFecha, entrada.nuevaHoraInicio, cita.duracionMinutos, cita.id);
        cita.estado = 'cambio_solicitado';
        cita.propuestaFecha = entrada.nuevaFecha;
        cita.propuestaHoraInicio = entrada.nuevaHoraInicio;
        cita.propuestaHoraFin = horaFin;
        cita.propuestaPor = 'idc';
        cita.propuestaNota = entrada.motivo?.trim() || 'IDC propone este horario alternativo para atender tu visita.';
        cita.actualizadoEn = sello;
        cita.historial.push({
          id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'cambio_solicitado', actor: 'idc',
          detalle: `IDC propuso el ${formatearFechaLargaHermosillo(entrada.nuevaFecha)} a las ${entrada.nuevaHoraInicio} (Hermosillo). ${cita.propuestaNota}`,
        });
        return { ...cita, historial: [...cita.historial] };
      }

      if (entrada.accion === 'reprogramar') {
        if (!entrada.nuevaFecha || !entrada.nuevaHoraInicio) {
          throw new ErrorCita('datos_invalidos', 'Indica la fecha y horario para reprogramar.', 422);
        }
        const { horaFin, inicioIso, finIso } = validarHorarioDisponible(
          entrada.nuevaFecha, entrada.nuevaHoraInicio, cita.duracionMinutos, cita.id,
        );
        cita.fecha = entrada.nuevaFecha;
        cita.horaInicio = entrada.nuevaHoraInicio;
        cita.horaFin = horaFin;
        cita.inicioIso = inicioIso;
        cita.finIso = finIso;
        cita.estado = 'reprogramada';
        cita.propuestaFecha = null;
        cita.propuestaHoraInicio = null;
        cita.propuestaHoraFin = null;
        cita.propuestaPor = null;
        cita.propuestaNota = null;
        cita.actualizadoEn = sello;
        cita.historial.push({
          id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'reprogramada', actor: 'idc',
          detalle: `IDC reprogramó la cita al ${formatearFechaLargaHermosillo(cita.fecha)} a las ${cita.horaInicio} (Hermosillo).`,
        });
        return { ...cita, historial: [...cita.historial] };
      }

      if (entrada.accion === 'cancelar') {
        const motivo = entrada.motivo?.trim();
        if (!motivo) throw new ErrorCita('datos_invalidos', 'Indica el motivo de cancelación para informar al cliente.', 422);
        cita.estado = 'cancelada';
        cita.motivoCancelacion = motivo;
        cita.propuestaFecha = null;
        cita.propuestaHoraInicio = null;
        cita.propuestaHoraFin = null;
        cita.propuestaPor = null;
        cita.actualizadoEn = sello;
        cita.historial.push({
          id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'cancelada', actor: 'idc', detalle: motivo,
        });
        return { ...cita, historial: [...cita.historial] };
      }

      // realizada: NO marca documentos como recibidos físicamente (se registran por acciones documentales autorizadas).
      cita.estado = 'realizada';
      cita.actualizadoEn = sello;
      cita.historial.push({
        id: randomUUID(), fecha: sello, estadoAnterior, estadoNuevo: 'realizada', actor: 'idc',
        detalle: entrada.motivo?.trim() || 'IDC registró que la visita ocurrió. La recepción física de cada documento se registra por separado.',
      });
      return { ...cita, historial: [...cita.historial] };
    },

    async notificacionesDe(folio) {
      const lista = await this.listarPorFolio(folio);
      const out: Notificacion[] = [];
      for (const c of lista) {
        const resumen = {
          referencia: c.referencia,
          fecha: c.propuestaPor === 'idc' && c.propuestaFecha ? c.propuestaFecha : c.fecha,
          horaInicio: c.propuestaPor === 'idc' && c.propuestaHoraInicio ? c.propuestaHoraInicio : c.horaInicio,
          horaFin: c.propuestaPor === 'idc' && c.propuestaHoraFin ? c.propuestaHoraFin : c.horaFin,
          ubicacion: c.ubicacionAutorizada,
          tipoVisita: INFO_TIPO_VISITA[c.tipoVisita].titulo,
        };
        for (const h of c.historial) {
          let eventoTipo = 'cita_solicitada';
          let titulo = 'Recibimos tu solicitud de cita';
          let tipo: Notificacion['tipo'] = 'cita';
          if (h.estadoNuevo === 'confirmada') {
            eventoTipo = 'cita_confirmada';
            titulo = 'Tu visita a IDC está confirmada';
          } else if (h.estadoNuevo === 'cambio_solicitado' && h.actor === 'idc') {
            eventoTipo = 'cita_propuesta_horario';
            titulo = 'IDC propuso un nuevo horario para tu visita';
            tipo = 'accion';
          } else if (h.estadoNuevo === 'cambio_solicitado' && h.actor === 'cliente') {
            eventoTipo = 'cita_solicitada';
            titulo = 'Recibimos tu solicitud de cambio de horario';
          } else if (h.estadoNuevo === 'reprogramada') {
            eventoTipo = 'cita_reprogramada';
            titulo = 'Tu cita con IDC fue reprogramada';
          } else if (h.estadoNuevo === 'cancelada') {
            eventoTipo = 'cita_cancelada';
            titulo = 'Tu cita fue cancelada';
          } else if (h.estadoNuevo === 'realizada') {
            eventoTipo = 'cita_realizada';
            titulo = 'Registramos tu visita en IDC';
          }
          out.push({
            id: `n:cita:${h.id}`,
            citaId: c.id,
            eventoTipo,
            citaResumen: resumen,
            tipo,
            titulo,
            detalle: h.detalle,
            fecha: h.fecha,
          });
        }
      }
      return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
    },

    async historialDe(folio) {
      const lista = await this.listarPorFolio(folio);
      const out: EventoPublico[] = [];
      for (const c of lista) {
        for (const h of c.historial) {
          const etiquetas: Record<string, string> = {
            solicitada: `Cita solicitada (${c.referencia})`,
            pendiente_confirmacion: `Cita pendiente de confirmación (${c.referencia})`,
            confirmada: `Cita confirmada (${c.referencia})`,
            cambio_solicitado: h.actor === 'idc' ? `Nueva propuesta de horario de IDC (${c.referencia})` : `Solicitud de cambio de horario (${c.referencia})`,
            reprogramada: `Cita reprogramada (${c.referencia})`,
            cancelada: `Cita cancelada (${c.referencia})`,
            realizada: `Visita realizada en IDC (${c.referencia})`,
          };
          out.push({
            id: `c:${h.id}`,
            fecha: h.fecha.slice(0, 10),
            titulo: etiquetas[h.estadoNuevo] ?? `Actualización de cita (${c.referencia})`,
          });
        }
      }
      return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
    },

    async obtenerChecklistVisita(folio) {
      return [...(checklists.get(folio) ?? [])];
    },

    async guardarChecklistVisita(folio, _accesoId, marcados) {
      const unicos = [...new Set(marcados.filter((m) => typeof m === 'string' && m.length > 0 && m.length <= 64))].slice(0, 40);
      checklists.set(folio, unicos);
      return [...unicos];
    },
  };
}
