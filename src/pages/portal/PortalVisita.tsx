import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FolderCheck,
  PartyPopper,
  FileCheck2,
  History,
  Info,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { EnlacePortal, IlustracionVisita } from '@/components/portal/DisenoPortal';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ESTADOS_CITA_ACTIVOS,
  ETIQUETA_ESTADO_CITA,
  fechaHoyHermosillo,
  formatearFechaLargaHermosillo,
  INFO_TIPO_VISITA,
  ZONA_HORARIA_IDC,
  type ChecklistVisitaItem,
  type CitaPortal,
  type ConfigAgendaIDC,
  type DiaDisponibilidad,
  type TipoVisita,
} from '@/domain/citas/cita';
import { usePortal, useVistaPortal } from '@/hooks/PortalContexto';
import {
  cancelarCitaPortal,
  disponibilidadVisitaPortal,
  guardarChecklistVisitaPortal,
  icsCitaPortalUrl,
  reprogramarCitaPortal,
  resumenVisitaPortal,
  simularAccionCitaDemo,
  solicitarCitaPortal,
  type ResumenVisitaPortal,
} from '@/infrastructure/portal-http';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

function mesSiguiente(mes: string, delta: number): string {
  const [yStr, mStr] = mes.split('-');
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nombreMes(mes: string): string {
  const [yStr, mStr] = mes.split('-');
  const d = new Date(`${yStr}-${mStr}-15T12:00:00-07:00`);
  const t = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: ZONA_HORARIA_IDC }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function primerDiaSemanaOffset(mes: string): number {
  const d = new Date(`${mes}-01T12:00:00-07:00`).getUTCDay();
  return d === 0 ? 6 : d - 1; // Lunes = 0 .. Domingo = 6
}

interface CalendarioSelectorProps {
  mes: string;
  mesMinimo: string;
  dias: DiaDisponibilidad[];
  cargando: boolean;
  fechaSeleccionada: string;
  horaSeleccionada: string;
  onCambiarMes: (nuevoMes: string) => void;
  onSeleccionarFecha: (fecha: string) => void;
  onSeleccionarHora: (hora: string) => void;
  config: ConfigAgendaIDC;
}

function CalendarioInteractivo({
  mes,
  mesMinimo,
  dias,
  cargando,
  fechaSeleccionada,
  horaSeleccionada,
  onCambiarMes,
  onSeleccionarFecha,
  onSeleccionarHora,
  config,
}: CalendarioSelectorProps) {
  const offset = primerDiaSemanaOffset(mes);
  const diaActual = dias.find((d) => d.fecha === fechaSeleccionada) ?? null;

  return (
    <div className="kv-calendario">
      <div className="kv-calendario__cabecera">
        <button
          type="button"
          className="kv-cliente-iconbtn"
          aria-label="Mes anterior"
          disabled={mes <= mesMinimo || cargando}
          onClick={() => onCambiarMes(mesSiguiente(mes, -1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h3>{nombreMes(mes)}</h3>
        <button
          type="button"
          className="kv-cliente-iconbtn"
          aria-label="Mes siguiente"
          disabled={cargando}
          onClick={() => onCambiarMes(mesSiguiente(mes, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="kv-calendario__leyenda" aria-hidden="true">
        <span><i data-marca="disponible" /> Disponible</span>
        <span><i data-marca="seleccionado" /> Seleccionado</span>
        <span><i data-marca="nodisponible" /> No disponible</span>
      </div>

      <div className="kv-calendario__dias-semana" aria-hidden="true">
        {DIAS_SEMANA.map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="kv-calendario__rejilla" role="grid" aria-label={`Calendario de ${nombreMes(mes)}`}>
        {Array.from({ length: offset }).map((_, i) => <span key={'v' + i} className="kv-calendario__vacio" aria-hidden="true" />)}
        {dias.map((d) => {
          const num = Number(d.fecha.slice(8, 10));
          const seleccionada = d.fecha === fechaSeleccionada;
          const deshabilitado = d.pasado || !d.laborable || !d.tieneDisponibilidad;
          return (
            <button
              key={d.fecha}
              type="button"
              className="kv-calendario__dia"
              data-seleccionado={seleccionada || undefined}
              data-disponible={!deshabilitado || undefined}
              disabled={deshabilitado}
              aria-pressed={seleccionada}
              aria-label={`${formatearFechaLargaHermosillo(d.fecha)}, ${deshabilitado ? 'no disponible' : `${d.disponibles} horarios disponibles`}`}
              onClick={() => onSeleccionarFecha(d.fecha)}
            >
              <span>{num}</span>
              {!deshabilitado && <small>{d.disponibles}</small>}
            </button>
          );
        })}
      </div>

      <div className="kv-horarios">
        <div className="kv-cliente-linea">
          <h4><Clock size={16} aria-hidden="true" /> Horarios disponibles</h4>
          <span>Zona horaria: {config.zonaHoraria} (UTC-7)</span>
        </div>
        {!diaActual ? (
          <p className="kv-suave">Selecciona un día disponible en el calendario para ver los horarios.</p>
        ) : (
          <>
            <p className="kv-suave">
              {formatearFechaLargaHermosillo(diaActual.fecha)} · Duración estimada: {config.duracionMinutos} min
            </p>
            <div className="kv-horarios__lista" role="radiogroup" aria-label="Horarios del día">
              {diaActual.slots.map((s) => {
                const elegido = horaSeleccionada === s.horaInicio;
                return (
                  <button
                    key={s.horaInicio}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    disabled={!s.disponible}
                    className="kv-horario-btn"
                    data-seleccionado={elegido || undefined}
                    data-ocupado={s.motivoNoDisponible === 'ocupado' || undefined}
                    onClick={() => onSeleccionarHora(s.horaInicio)}
                  >
                    <strong>{s.horaInicio}</strong>
                    <small>{s.disponible ? `a ${s.horaFin}` : s.motivoNoDisponible === 'ocupado' ? 'Ocupado' : 'No disp.'}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PortalVisita() {
  const v = useVistaPortal();
  const { recargar } = usePortal();
  const hoy = fechaHoyHermosillo();
  const mesActual = hoy.slice(0, 7);

  const [resumen, setResumen] = useState<ResumenVisitaPortal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Estado del flujo de 3 pasos
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [forzarNueva, setForzarNueva] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [guardandoLista, setGuardandoLista] = useState(false);

  // Estado del calendario (paso 2 y reprogramación)
  const [tipoVisita, setTipoVisita] = useState<TipoVisita>('entrega_expediente');
  const [mes, setMes] = useState(mesActual);
  const [dias, setDias] = useState<DiaDisponibilidad[]>([]);
  const [cargandoCalendario, setCargandoCalendario] = useState(false);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [notas, setNotas] = useState('');
  const [llaveIdempotencia, setLlaveIdempotencia] = useState('');

  // Gestión de cita activa (reprogramar / cancelar / simulador demo IDC)
  const [modoReprogramar, setModoReprogramar] = useState(false);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [modoCancelar, setModoCancelar] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [simUbicacion, setSimUbicacion] = useState('');
  const [simMotivo, setSimMotivo] = useState('');
  const [simFecha, setSimFecha] = useState('');
  const [simHora, setSimHora] = useState('');

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await resumenVisitaPortal();
      setResumen(r);
      setMarcados(r.checklist.filter((i) => i.preparadoParaVisita).map((i) => i.documentoId));
      if (!r.elegibilidad.permitida && r.config.tiposHabilitados.includes('aclaracion_documental')) {
        setTipoVisita('entrega_expediente');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar la información de tu visita.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen, v.folio]);

  const cargarMes = useCallback(async (mesObjetivo: string, tipoObjetivo: TipoVisita) => {
    setCargandoCalendario(true);
    try {
      const r = await disponibilidadVisitaPortal(mesObjetivo, tipoObjetivo);
      setDias(r.dias);
      setFecha((prev) => {
        if (prev && r.dias.some((d) => d.fecha === prev && d.tieneDisponibilidad)) return prev;
        return r.dias.find((d) => d.tieneDisponibilidad)?.fecha ?? '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos consultar los horarios disponibles.');
    } finally {
      setCargandoCalendario(false);
    }
  }, []);

  useEffect(() => {
    if (!resumen) return;
    if (paso === 2 || modoReprogramar || (import.meta.env.DEV && v.demo && resumen.citaActiva)) {
      void cargarMes(mes, tipoVisita);
    }
  }, [resumen?.config.disponibilidadPublicada, paso, modoReprogramar, mes, tipoVisita, cargarMes, v.demo, resumen?.citaActiva?.id]);

  // Genera nueva clave idempotente únicamente cuando el cliente cambia de selección de fecha/hora/tipo.
  useEffect(() => {
    if (fecha && hora) {
      setLlaveIdempotencia(`req-${v.folio}-${tipoVisita}-${fecha}-${hora}-${crypto.randomUUID().slice(0, 8)}`);
    }
  }, [v.folio, tipoVisita, fecha, hora]);

  const checklistConEstado = useMemo<ChecklistVisitaItem[]>(() => {
    if (!resumen) return [];
    const set = new Set(marcados);
    return resumen.checklist.map((item) => ({ ...item, preparadoParaVisita: set.has(item.documentoId) }));
  }, [resumen, marcados]);

  const itemsLlevar = checklistConEstado.filter(
    (i) => i.categoriaEntrega !== 'solo_digital',
  );
  const preparadosLlevar = itemsLlevar.filter((i) => i.preparadoParaVisita).length;

  async function alternarItemChecklist(docId: string) {
    const siguiente = marcados.includes(docId) ? marcados.filter((x) => x !== docId) : [...marcados, docId];
    setMarcados(siguiente);
    setGuardandoLista(true);
    try {
      const guardados = await guardarChecklistVisitaPortal(siguiente);
      setMarcados(guardados);
    } catch {
      // Mantiene selección visual y avisa suavemente
      setAviso('No se pudo sincronizar la casilla en este momento.');
    } finally {
      setGuardandoLista(false);
    }
  }


  async function enviarSolicitud() {
    if (!fecha || !hora || ocupado) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await solicitarCitaPortal({
        tipoVisita,
        fecha,
        horaInicio: hora,
        notasCliente: notas.trim() || undefined,
        idempotencyKey: llaveIdempotencia || `req-${crypto.randomUUID()}`,
      });
      setAviso(
        r.duplicada
          ? `Tu solicitud ${r.cita.referencia} ya había sido registrada.`
          : `Recibimos tu solicitud de cita (${r.cita.referencia}). IDC revisará el horario y te confirmará en tu portal y correo.`,
      );
      setForzarNueva(false);
      await Promise.all([cargarResumen(), recargar()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos registrar tu solicitud.');
      void cargarMes(mes, tipoVisita);
    } finally {
      setOcupado(false);
    }
  }

  async function solicitarCambio(cita: CitaPortal) {
    if (!fecha || !hora || ocupado) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await reprogramarCitaPortal(cita.id, {
        accion: 'solicitar_cambio',
        nuevaFecha: fecha,
        nuevaHoraInicio: hora,
        motivo: motivoCambio.trim() || undefined,
      });
      setModoReprogramar(false);
      setMotivoCambio('');
      setAviso('Registramos tu solicitud de cambio de horario. IDC la revisará para confirmarla.');
      await Promise.all([cargarResumen(), recargar()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo solicitar el cambio.');
    } finally {
      setOcupado(false);
    }
  }

  async function aceptarPropuesta(cita: CitaPortal) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await reprogramarCitaPortal(cita.id, { accion: 'aceptar_propuesta' });
      setAviso('¡Listo! Aceptaste el nuevo horario y tu cita quedó reprogramada.');
      await Promise.all([cargarResumen(), recargar()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos aceptar la propuesta.');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarCancelacion(cita: CitaPortal) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await cancelarCitaPortal(cita.id, motivoCancelacion.trim() || 'Cancelada por el cliente desde el portal.');
      setModoCancelar(false);
      setMotivoCancelacion('');
      setAviso('Tu cita fue cancelada y el horario quedó liberado.');
      await Promise.all([cargarResumen(), recargar()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible cancelar la cita.');
    } finally {
      setOcupado(false);
    }
  }

  async function ejecutarSimulacionIdc(
    cita: CitaPortal,
    accion: 'confirmar' | 'proponer_horario' | 'cancelar' | 'realizada',
  ) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const diaLibre = dias.find((d) => d.tieneDisponibilidad && d.fecha !== cita.fecha) ?? dias.find((d) => d.tieneDisponibilidad);
      const slotLibre = diaLibre?.slots.find((s) => s.disponible && (diaLibre.fecha !== cita.fecha || s.horaInicio !== cita.horaInicio));
      await simularAccionCitaDemo(cita.id, {
        accion,
        ...(accion === 'confirmar' && simUbicacion.trim() ? { ubicacionAutorizada: simUbicacion.trim() } : {}),
        ...(accion === 'proponer_horario' ? {
          nuevaFecha: simFecha || diaLibre?.fecha,
          nuevaHoraInicio: simHora || slotLibre?.horaInicio,
          motivo: simMotivo.trim() || 'Te proponemos este horario alternativo para agilizar la recepción de tu expediente.',
        } : {}),
        ...(accion === 'cancelar' ? { motivo: simMotivo.trim() || 'Ajuste de agenda interna de demostración.' } : {}),
        ...(accion === 'realizada' ? { motivo: 'Visita registrada en demostración. La recepción física documental se registra por separado.' } : {}),
      });
      setAviso(`Acción simulada de IDC ejecutada (${accion}). Consulta también Inicio y Avisos para ver la actualización y el correo simulado.`);
      await Promise.all([cargarResumen(), recargar()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos simular la acción de IDC.');
    } finally {
      setOcupado(false);
    }
  }

  if (v.documentos === null) {
    return <AlertPanel tono="info" titulo="Sección no disponible">Tu acceso no incluye preparación documental ni citas.</AlertPanel>;
  }
  if (cargando && !resumen) {
    return <div className="kv-cliente-superficie" role="status">Preparando tu guía de visita y agenda…</div>;
  }
  if (!resumen) {
    return <AlertPanel tono="error">{error || 'No pudimos cargar tu visita.'}</AlertPanel>;
  }

  const { elegibilidad, config, citaActiva } = resumen;
  const mostrarCitaExistente = !!citaActiva && !forzarNueva;
  const esEntregaBloqueada = tipoVisita === 'entrega_expediente' && !elegibilidad.permitida;
  const diaSeleccionado = dias.find((d) => d.fecha === fecha);
  const slotSeleccionado = diaSeleccionado?.slots.find((s) => s.horaInicio === hora && s.disponible);
  const duracionActual = INFO_TIPO_VISITA[tipoVisita].duracionPorDefectoMin ?? config.duracionMinutos;

  const renderChecklistSeccion = (compacto = false) => {
    const total = itemsLlevar.length;
    const pct = total ? Math.round((preparadosLlevar / total) * 100) : 0;
    const pista = (i: ChecklistVisitaItem) => (/firm|identific/i.test(i.instruccionFisica) ? i.instruccionFisica : '');
    return (
      <section className="kv-visita-checklist kv-carpeta">
        <div className="kv-carpeta__cab">
          <span className="kv-carpeta__ico"><FolderCheck size={26} aria-hidden="true" /></span>
          <div>
            <h2>Tu carpeta física</h2>
            <p><strong>{preparadosLlevar} de {total}</strong> documentos preparados{guardandoLista ? ' · guardando…' : ''}</p>
          </div>
          {pct === 100 && <span className="kv-carpeta__listo"><PartyPopper size={16} aria-hidden="true" /> ¡Carpeta completa!</span>}
        </div>
        <div className="kv-carpeta__barra" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={preparadosLlevar} aria-label="Documentos preparados">
          <i style={{ width: `${pct}%` }} />
        </div>
        <ol className="kv-carpeta__lista">
          {checklistConEstado.map((item, n) => (
            <li key={item.documentoId} data-preparado={item.preparadoParaVisita || undefined}>
              <label>
                <input type="checkbox" checked={item.preparadoParaVisita} onChange={() => void alternarItemChecklist(item.documentoId)} />
                <span className="kv-carpeta__marca" aria-hidden="true"><Check size={15} /></span>
                <span className="kv-carpeta__texto">
                  <strong><em>{n + 1}</em>{item.nombre}</strong>
                  {pista(item) && <small>{pista(item)}</small>}
                </span>
              </label>
              <EnlacePortal to="/portal/documentos" secundario>Ver revisado</EnlacePortal>
            </li>
          ))}
        </ol>
        <p className="kv-carpeta__nota">Tu lista es solo un apoyo personal: se guarda en esta demostración y es independiente de la revisión digital de IDC.</p>
        <div className="kv-carpeta__acciones">
          <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Imprimir lista
          </button>
          {!compacto && (
            <button type="button" className="kvp-boton" onClick={() => { setPaso(2); setError(''); }}>
              <CalendarCheck2 size={17} aria-hidden="true" /> Agendar mi visita <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="kv-visita">
      {/* Encabezado editorial */}
      <section className="kv-visita-hero">
        <div className="kv-visita-hero__texto">
          <span className="kv-visita-eyebrow">PREPARA TU VISITA</span>
          <h1>
            {mostrarCitaExistente
              ? citaActiva.estado === 'confirmada' || citaActiva.estado === 'reprogramada'
                ? '¡Tenemos una cita!'
                : citaActiva.estado === 'cambio_solicitado' && citaActiva.propuestaPor === 'idc'
                  ? 'Tenemos una nueva propuesta de horario.'
                  : citaActiva.estado === 'realizada'
                    ? 'Gracias por tu visita.'
                    : citaActiva.estado === 'cancelada'
                      ? 'Tu cita fue cancelada.'
                      : 'Recibimos tu solicitud.'
              : elegibilidad.permitida
                ? '¡Ya casi terminamos!'
                : 'Prepara tu expediente antes de agendar.'}
          </h1>
          <p>
            {mostrarCitaExistente
              ? citaActiva.estado === 'confirmada' || citaActiva.estado === 'reprogramada'
                ? 'Consulta la fecha, el horario de Hermosillo y la lista de documentos que debes llevar antes de salir de casa.'
                : citaActiva.estado === 'solicitada' || citaActiva.estado === 'pendiente_confirmacion'
                  ? 'Estamos coordinando tu horario con IDC. Te avisaremos en cuanto tu visita quede confirmada.'
                  : 'Revisa los detalles actualizados y el historial de tu cita.'
              : elegibilidad.permitida
                ? 'Reúne tus documentos físicos. Nosotros ya revisamos tu expediente digital.'
                : 'Para agendar la entrega física completa del expediente primero deben quedar resueltos tus documentos obligatorios.'}
          </p>
          <div className="kv-visita-hero__meta">
            <StatusBadge tono={elegibilidad.permitida ? 'ok' : 'alerta'} variante="suave">
              {elegibilidad.etiquetaEstadoDocumental}
            </StatusBadge>
            {config.simulada && (
              <StatusBadge tono="neutro" variante="suave">Agenda demostrativa · horarios ficticios</StatusBadge>
            )}
          </div>
        </div>
        <IlustracionVisita className="kv-visita-hero__ilustracion" />
      </section>

      {aviso && <AlertPanel tono="ok" onCerrar={() => setAviso('')}>{aviso}</AlertPanel>}
      {error && <AlertPanel tono="error" onCerrar={() => setError('')}>{error}</AlertPanel>}

      {/* Bloqueo claro cuando el expediente NO está listo (p. ej. Demo 2) */}
      {!mostrarCitaExistente && !elegibilidad.permitida && (
        <section className="kv-cliente-superficie kv-visita-bloqueo">
          <div className="kv-visita-bloqueo__encabezado">
            <AlertCircle size={24} aria-hidden="true" />
            <div>
              <h2>La cita de entrega física completa todavía no está habilitada</h2>
              <p>{elegibilidad.motivoBloqueo}</p>
            </div>
          </div>
          <ul className="kv-visita-bloqueo__lista">
            {elegibilidad.documentosPendientes.map((d) => (
              <li key={d.id}>
                <span>{d.nombre}</span>
                <StatusBadge tono={d.estado === 'rechazado' || d.estado === 'vencido' ? 'error' : 'alerta'} variante="suave">
                  {d.estado === 'rechazado' ? 'Requiere corrección' : d.estado === 'en_revision' || d.estado === 'recibido' ? 'En revisión' : 'Por preparar'}
                </StatusBadge>
              </li>
            ))}
          </ul>
          <div className="kv-visita-pie-paso">
            <EnlacePortal to="/portal/documentos">Resolver mis documentos pendientes</EnlacePortal>
          </div>
        </section>
      )}

      {/* Vista de cita existente / activa */}
      {mostrarCitaExistente && (
        <div className="kv-visita-gestion">
          <div className="kv-visita-dos-col">
            <section className="kv-cliente-superficie kv-visita-detalle-cita">
              <div className="kv-cliente-linea">
                <StatusBadge tono={ETIQUETA_ESTADO_CITA[citaActiva.estado].tono} variante="suave">
                  {ETIQUETA_ESTADO_CITA[citaActiva.estado].texto}
                </StatusBadge>
                <span className="kv-mono">{citaActiva.referencia}</span>
              </div>

              <h2>{INFO_TIPO_VISITA[citaActiva.tipoVisita].titulo}</h2>

              {citaActiva.estado === 'cambio_solicitado' && citaActiva.propuestaPor === 'idc' && citaActiva.propuestaFecha && (
                <div className="kv-visita-propuesta">
                  <h3><CalendarClock size={18} aria-hidden="true" /> Propuesta de nuevo horario de IDC</h3>
                  <p>
                    <strong>{formatearFechaLargaHermosillo(citaActiva.propuestaFecha)}</strong>
                    {' · '}
                    {citaActiva.propuestaHoraInicio} – {citaActiva.propuestaHoraFin} (Hermosillo)
                  </p>
                  {citaActiva.propuestaNota && <p>{citaActiva.propuestaNota}</p>}
                  <div className="kv-visita-acciones">
                    <button type="button" className="kvp-boton" disabled={ocupado} onClick={() => void aceptarPropuesta(citaActiva)}>
                      <Check size={16} aria-hidden="true" /> Aceptar propuesta
                    </button>
                    <button
                      type="button"
                      className="kvp-boton kvp-boton--suave"
                      disabled={ocupado}
                      onClick={() => { setModoReprogramar(true); setModoCancelar(false); }}
                    >
                      Proponer otro horario
                    </button>
                  </div>
                </div>
              )}

              <dl className="kv-visita-resumen-dl">
                <dt>Fecha</dt>
                <dd>{formatearFechaLargaHermosillo(citaActiva.fecha)}</dd>
                <dt>Horario</dt>
                <dd>{citaActiva.horaInicio} – {citaActiva.horaFin} ({citaActiva.zonaHoraria})</dd>
                <dt>Duración</dt>
                <dd>{citaActiva.duracionMinutos} minutos</dd>
                <dt>Ubicación</dt>
                <dd>{citaActiva.ubicacionAutorizada ?? 'Se proporcionará al confirmar la cita.'}</dd>
                {citaActiva.notasCliente && <><dt>Tus indicaciones</dt><dd>{citaActiva.notasCliente}</dd></>}
                {citaActiva.motivoCancelacion && <><dt>Motivo de cancelación</dt><dd>{citaActiva.motivoCancelacion}</dd></>}
              </dl>

              {citaActiva.estado === 'solicitada' && (
                <p className="kv-cliente-nota">
                  <Info size={16} aria-hidden="true" /> Tu cita está solicitada y pendiente de confirmación por IDC. No se considera confirmada hasta recibir la aprobación del equipo.
                </p>
              )}
              {citaActiva.estado === 'realizada' && (
                <p className="kv-cliente-nota">
                  <ShieldCheck size={16} aria-hidden="true" /> La visita fue registrada como realizada. La recepción física y validación de cada documento se registran por separado en tu expediente.
                </p>
              )}

              <div className="kv-visita-acciones">
                {(citaActiva.estado === 'confirmada' || citaActiva.estado === 'reprogramada') && (
                  <a href={icsCitaPortalUrl(citaActiva.id)} download className="kvp-boton">
                    <Download size={16} aria-hidden="true" /> Descargar evento (.ics)
                  </a>
                )}
                {ESTADOS_CITA_ACTIVOS.includes(citaActiva.estado) && (
                  <>
                    <button
                      type="button"
                      className="kvp-boton kvp-boton--suave"
                      disabled={ocupado}
                      onClick={() => { setModoReprogramar((m) => !m); setModoCancelar(false); }}
                    >
                      <RefreshCw size={16} aria-hidden="true" /> Solicitar cambio de horario
                    </button>
                    <button
                      type="button"
                      className="kvp-boton kvp-boton--suave"
                      disabled={ocupado}
                      onClick={() => { setModoCancelar((m) => !m); setModoReprogramar(false); }}
                    >
                      <XCircle size={16} aria-hidden="true" /> Cancelar cita
                    </button>
                  </>
                )}
                {citaActiva.estado === 'cancelada' && elegibilidad.permitida && (
                  <button
                    type="button"
                    className="kvp-boton"
                    onClick={() => { setForzarNueva(true); setPaso(2); setFecha(''); setHora(''); }}
                  >
                    <CalendarDays size={16} aria-hidden="true" /> Solicitar una nueva cita
                  </button>
                )}
              </div>

              {modoReprogramar && (
                <div className="kv-visita-subpanel">
                  <h3>Solicitar cambio de horario</h3>
                  <p className="kv-suave">
                    Una cita confirmada no se modifica directamente; enviaremos tu propuesta de horario para revisión de IDC.
                  </p>
                  <CalendarioInteractivo
                    mes={mes}
                    mesMinimo={mesActual}
                    dias={dias}
                    cargando={cargandoCalendario}
                    fechaSeleccionada={fecha}
                    horaSeleccionada={hora}
                    onCambiarMes={setMes}
                    onSeleccionarFecha={(f) => { setFecha(f); setHora(''); }}
                    onSeleccionarHora={setHora}
                    config={config}
                  />
                  <label className="kv-visita-campo">
                    Motivo o comentario (opcional)
                    <textarea maxLength={500} value={motivoCambio} onChange={(e) => setMotivoCambio(e.target.value)} />
                  </label>
                  <div className="kv-visita-acciones">
                    <button
                      type="button"
                      className="kvp-boton"
                      disabled={!fecha || !hora || ocupado}
                      onClick={() => void solicitarCambio(citaActiva)}
                    >
                      Enviar solicitud de cambio
                    </button>
                    <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setModoReprogramar(false)}>
                      Cerrar
                    </button>
                  </div>
                </div>
              )}

              {modoCancelar && (
                <div className="kv-visita-subpanel">
                  <h3>Cancelar mi cita</h3>
                  <label className="kv-visita-campo">
                    Motivo de cancelación
                    <textarea
                      maxLength={500}
                      placeholder="Indícanos brevemente por qué cancelas para liberar el horario."
                      value={motivoCancelacion}
                      onChange={(e) => setMotivoCancelacion(e.target.value)}
                    />
                  </label>
                  <div className="kv-visita-acciones">
                    <button type="button" className="kvp-boton" disabled={ocupado} onClick={() => void confirmarCancelacion(citaActiva)}>
                      Confirmar cancelación
                    </button>
                    <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setModoCancelar(false)}>
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Columna derecha: resumen solar + historial */}
            <aside className="kv-visita-lateral">
              <div className="kv-visita-resumen-solar">
                <span className="kv-cliente-etiqueta">Resumen de tu visita</span>
                <h3>{INFO_TIPO_VISITA[citaActiva.tipoVisita].titulo}</h3>
                <p><CalendarDays size={16} aria-hidden="true" /> <span>{formatearFechaLargaHermosillo(citaActiva.fecha)}</span></p>
                <p><Clock size={16} aria-hidden="true" /> {citaActiva.horaInicio} – {citaActiva.horaFin} (Hermosillo)</p>
                <p><MapPin size={16} aria-hidden="true" /> {citaActiva.ubicacionAutorizada ?? 'Ubicación por confirmar al aprobar la cita'}</p>
                <p><FileCheck2 size={16} aria-hidden="true" /> {preparadosLlevar} de {itemsLlevar.length} documentos físicos listos</p>
              </div>

              <section className="kv-cliente-superficie kv-visita-historial">
                <h3><History size={18} aria-hidden="true" /> Historial de esta cita</h3>
                <ol>
                  {citaActiva.historial.map((h) => (
                    <li key={h.id}>
                      <strong>{ETIQUETA_ESTADO_CITA[h.estadoNuevo].texto}</strong>
                      <small>{h.actor === 'idc' ? 'Equipo IDC' : 'Cliente'} · {h.fecha.slice(0, 10)}</small>
                      {h.detalle && <p>{h.detalle}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>

          {/* Checklist siempre accesible para la visita */}
          {renderChecklistSeccion(true)}

          {/* Simulador de respuesta de IDC (exclusivo para entorno local de demos) */}
          {import.meta.env.DEV && v.demo && config.simulada && (
            <details className="kv-cliente-superficie kv-visita-simulador">
              <summary>Simular respuesta de IDC en esta demo</summary>
              <p className="kv-suave">
                Herramienta exclusiva de demostración para probar el flujo completo sin salir del navegador. En producción estas acciones solo existen en el panel interno de IDC con validación de roles.
              </p>
              <div className="kv-visita-simulador__campos">
                <label className="kv-visita-campo">
                  Ubicación autorizada (opcional al confirmar)
                  <input
                    placeholder="Ej. Oficinas IDC · Hermosillo (ubicación ficticia demo)"
                    value={simUbicacion}
                    onChange={(e) => setSimUbicacion(e.target.value)}
                  />
                </label>
                <label className="kv-visita-campo">
                  Motivo / nota de IDC (para proponer o cancelar)
                  <input
                    placeholder="Ej. Ajuste de agenda de demostración"
                    value={simMotivo}
                    onChange={(e) => setSimMotivo(e.target.value)}
                  />
                </label>
                <label className="kv-visita-campo">
                  Fecha propuesta (opcional)
                  <input type="date" value={simFecha} onChange={(e) => setSimFecha(e.target.value)} />
                </label>
                <label className="kv-visita-campo">
                  Hora propuesta (opcional, ej. 11:00)
                  <input placeholder="11:00" value={simHora} onChange={(e) => setSimHora(e.target.value)} />
                </label>
              </div>
              <div className="kv-visita-acciones">
                {['solicitada', 'pendiente_confirmacion', 'cambio_solicitado'].includes(citaActiva.estado) && (
                  <button type="button" className="kvp-boton" disabled={ocupado} onClick={() => void ejecutarSimulacionIdc(citaActiva, 'confirmar')}>
                    Confirmar cita como IDC
                  </button>
                )}
                {ESTADOS_CITA_ACTIVOS.includes(citaActiva.estado) && (
                  <>
                    <button type="button" className="kvp-boton kvp-boton--suave" disabled={ocupado} onClick={() => void ejecutarSimulacionIdc(citaActiva, 'proponer_horario')}>
                      Proponer otro horario
                    </button>
                    <button type="button" className="kvp-boton kvp-boton--suave" disabled={ocupado} onClick={() => void ejecutarSimulacionIdc(citaActiva, 'cancelar')}>
                      Cancelar con motivo
                    </button>
                  </>
                )}
                {(citaActiva.estado === 'confirmada' || citaActiva.estado === 'reprogramada') && (
                  <button type="button" className="kvp-boton kvp-boton--suave" disabled={ocupado} onClick={() => void ejecutarSimulacionIdc(citaActiva, 'realizada')}>
                    Registrar visita realizada
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Flujo guiado de 3 pasos cuando está listo y no hay cita activa */}
      {!mostrarCitaExistente && elegibilidad.permitida && (
        <>
          <nav className="kv-visita-pasos" aria-label="Pasos para coordinar tu visita">
            <ol>
              {([
                [1, 'Preparar mi visita'],
                [2, 'Elegir fecha y horario'],
                [3, 'Revisar y solicitar cita'],
              ] as const).map(([num, etiqueta]) => (
                <li key={num}>
                  <button
                    type="button"
                    aria-current={paso === num ? 'step' : undefined}
                    data-completo={paso > num || undefined}
                    disabled={num === 3 && (!fecha || !hora)}
                    onClick={() => setPaso(num)}
                  >
                    <span>{paso > num ? <Check size={14} aria-hidden="true" /> : num}</span>
                    {etiqueta}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {paso === 1 && renderChecklistSeccion(false)}

          {paso === 2 && (
            <div className="kv-visita-dos-col">
              <section className="kv-cliente-superficie">
                <div className="kv-visita-tipos">
                  <h2><CalendarDays size={20} aria-hidden="true" /> Elige fecha y horario</h2>
                  {config.tiposHabilitados.length > 1 && (
                    <div className="kv-cliente-filtros" role="radiogroup" aria-label="Tipo de visita">
                      {config.tiposHabilitados.map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={tipoVisita === t}
                          aria-pressed={tipoVisita === t}
                          onClick={() => { setTipoVisita(t); setHora(''); }}
                        >
                          {INFO_TIPO_VISITA[t].titulo}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="kv-suave">{INFO_TIPO_VISITA[tipoVisita].descripcion}</p>
                </div>

                {!config.disponibilidadPublicada ? (
                  <AlertPanel tono="info" titulo="Agenda pendiente de publicación por IDC">
                    IDC todavía no ha publicado horarios disponibles en el portal. Comunícate con tu asesor para coordinar la entrega.
                  </AlertPanel>
                ) : (
                  <CalendarioInteractivo
                    mes={mes}
                    mesMinimo={mesActual}
                    dias={dias}
                    cargando={cargandoCalendario}
                    fechaSeleccionada={fecha}
                    horaSeleccionada={hora}
                    onCambiarMes={setMes}
                    onSeleccionarFecha={(f) => { setFecha(f); setHora(''); }}
                    onSeleccionarHora={setHora}
                    config={config}
                  />
                )}
              </section>

              <aside className="kv-visita-resumen-solar">
                <span className="kv-cliente-etiqueta">Tu selección</span>
                <h3>{INFO_TIPO_VISITA[tipoVisita].titulo}</h3>
                <dl className="kv-visita-resumen-dl">
                  <dt>Fecha</dt>
                  <dd>
                    {fecha ? formatearFechaLargaHermosillo(fecha) : 'Elige un día en el calendario'}
                  </dd>
                  <dt>Horario</dt>
                  <dd>{slotSeleccionado ? `${slotSeleccionado.horaInicio} – ${slotSeleccionado.horaFin} (Hermosillo)` : 'Elige un horario disponible'}</dd>
                  <dt>Duración</dt>
                  <dd>{duracionActual} minutos</dd>
                  <dt>Ubicación</dt>
                  <dd>{config.ubicacionAutorizada ?? 'Se proporcionará al confirmar la cita.'}</dd>
                </dl>
                {config.simulada && (
                  <p className="kv-suave">Disponibilidad demostrativa con horarios ficticios para ilustrar el recorrido.</p>
                )}
                <div className="kv-visita-acciones">
                  <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setPaso(1)}>
                    <ArrowLeft size={16} aria-hidden="true" /> Lista de visita
                  </button>
                  <button
                    type="button"
                    className="kvp-boton"
                    disabled={!fecha || !slotSeleccionado || esEntregaBloqueada}
                    onClick={() => setPaso(3)}
                  >
                    Revisar solicitud <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </aside>
            </div>
          )}

          {paso === 3 && (
            <div className="kv-visita-dos-col">
              <section className="kv-cliente-superficie kv-visita-confirmacion">
                <h2><CalendarCheck2 size={21} aria-hidden="true" /> Revisa los detalles antes de solicitar</h2>
                <dl className="kv-visita-resumen-dl">
                  <dt>Tipo de visita</dt>
                  <dd>{INFO_TIPO_VISITA[tipoVisita].titulo}</dd>
                  <dt>Fecha</dt>
                  <dd>{fecha ? formatearFechaLargaHermosillo(fecha) : '—'}</dd>
                  <dt>Horario</dt>
                  <dd>{slotSeleccionado ? `${slotSeleccionado.horaInicio} – ${slotSeleccionado.horaFin} (${config.zonaHoraria})` : `${hora} (${config.zonaHoraria})`}</dd>
                  <dt>Duración</dt>
                  <dd>{duracionActual} minutos</dd>
                  <dt>Ubicación autorizada</dt>
                  <dd>{config.ubicacionAutorizada ?? 'Se proporcionará al confirmar tu cita.'}</dd>
                  <dt>Correo de contacto</dt>
                  <dd>{resumen.correoContacto ?? 'Correo verificado registrado en IDC'}</dd>
                </dl>

                <label className="kv-visita-campo">
                  Indicaciones adicionales para IDC (opcional)
                  <textarea
                    maxLength={500}
                    placeholder="Ej. Comentarios sobre acceso, estacionamiento o persona que acudirá."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </label>

                <p className="kv-cliente-nota">
                  <Info size={16} aria-hidden="true" /> Al enviar, tu solicitud quedará registrada como <strong>Solicitada</strong> y pendiente de confirmación por el equipo de IDC.
                </p>

                <div className="kv-visita-pie-paso">
                  <button type="button" className="kvp-boton kvp-boton--suave" disabled={ocupado} onClick={() => setPaso(2)}>
                    <ArrowLeft size={16} aria-hidden="true" /> Cambiar fecha u horario
                  </button>
                  <button
                    type="button"
                    className="kvp-boton"
                    disabled={ocupado || !fecha || !hora || esEntregaBloqueada}
                    onClick={() => void enviarSolicitud()}
                  >
                    {ocupado ? 'Enviando solicitud…' : 'Solicitar mi cita'}
                  </button>
                </div>
              </section>

              <aside className="kv-visita-resumen-solar">
                <span className="kv-cliente-etiqueta">Documentos que debes llevar</span>
                <h3>{itemsLlevar.length} documentos en tu lista</h3>
                <ul className="kv-visita-resumen-lista">
                  {itemsLlevar.map((i) => (
                    <li key={i.documentoId}>
                      <span>{i.nombre}</span>
                      {i.categoriaEntrega === 'fisica_por_confirmar' && <small> · confirmar con IDC</small>}
                    </li>
                  ))}
                </ul>
                <button type="button" className="kv-cliente-enlace" onClick={() => setPaso(1)}>
                  Volver a mi lista de preparación
                </button>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
