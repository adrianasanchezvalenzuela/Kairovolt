import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Check, Clock, MapPin, RefreshCw, XCircle } from 'lucide-react';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ESTADOS_CITA,
  ESTADOS_CITA_ACTIVOS,
  ETIQUETA_ESTADO_CITA,
  formatearFechaLargaHermosillo,
  INFO_TIPO_VISITA,
  type AccionIdcCita,
  type CitaPortal,
  type ConfigAgendaIDC,
} from '@/domain/citas/cita';
import { puede } from '@/domain/usuarios/permisos';
import { useFuenteDatos } from '@/hooks/FuenteDatos';

const CSRF = { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' };

export function CitasIdcPanel() {
  const { usuario } = useFuenteDatos();
  const puedeConfigurar = puede(usuario?.rol, 'gestionar_portal');

  const [filtros, setFiltros] = useState({ folio: '', estado: '', fecha: '' });
  const [campos, setCampos] = useState({ folio: '', estado: '', fecha: '' });
  const [citas, setCitas] = useState<CitaPortal[] | null>(null);
  const [config, setConfig] = useState<ConfigAgendaIDC | null>(null);
  const [seleccion, setSeleccion] = useState<CitaPortal | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Campos de decisión administrativa
  const [ubicacion, setUbicacion] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [motivo, setMotivo] = useState('');

  // Configuración de agenda IDC
  const [cfgUbicacion, setCfgUbicacion] = useState('');
  const [cfgPublicada, setCfgPublicada] = useState(false);
  const [cfgHorarios, setCfgHorarios] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const q = new URLSearchParams();
      if (filtros.folio.trim()) q.set('folio', filtros.folio.trim().toUpperCase());
      if (filtros.estado) q.set('estado', filtros.estado);
      if (filtros.fecha) q.set('fecha', filtros.fecha);
      const r = await fetch('/api/admin/citas?' + q, { cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudieron consultar las solicitudes de cita. Verifica tu sesión y permisos.');
      const data = await r.json() as { citas: CitaPortal[]; config: ConfigAgendaIDC };
      setCitas(data.citas);
      setConfig(data.config);
      setCfgUbicacion(data.config.ubicacionAutorizada ?? '');
      setCfgPublicada(data.config.disponibilidadPublicada);
      setCfgHorarios(data.config.horariosInicio.join(', '));
      setSeleccion((prev) => (prev ? data.citas.find((x) => x.id === prev.id) ?? null : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error consultando citas.');
    }
  }, [filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutarAccion(accion: AccionIdcCita) {
    if (!seleccion || ocupado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const r = await fetch('/api/admin/citas/' + encodeURIComponent(seleccion.id) + '/accion', {
        method: 'POST',
        headers: CSRF,
        body: JSON.stringify({
          accion,
          nuevaFecha: nuevaFecha || null,
          nuevaHoraInicio: nuevaHora || null,
          motivo: motivo.trim() || null,
          ...(accion === 'confirmar' && ubicacion.trim() ? { ubicacionAutorizada: ubicacion.trim() } : {}),
        }),
      });
      const data = await r.json().catch(() => ({})) as { detalle?: string; cita?: CitaPortal };
      if (!r.ok) throw new Error(data.detalle ?? 'No se pudo aplicar la acción sobre la cita.');
      setMensaje(
        accion === 'confirmar'
          ? 'Cita confirmada. Se notificará al cliente.'
          : accion === 'proponer_horario'
            ? 'Propuesta de nuevo horario enviada al cliente.'
            : accion === 'cancelar'
              ? 'Cita cancelada y horario liberado.'
              : accion === 'realizada'
                ? 'Visita registrada como realizada. Recuerda registrar la recepción física de documentos por separado.'
                : 'Cita reprogramada.',
      );
      setMotivo('');
      setNuevaFecha('');
      setNuevaHora('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la cita.');
    } finally {
      setOcupado(false);
    }
  }

  async function guardarConfig(e: FormEvent) {
    e.preventDefault();
    if (!puedeConfigurar || ocupado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    const horarios = cfgHorarios.split(',').map((h) => h.trim()).filter((h) => /^\d{2}:\d{2}$/.test(h));
    try {
      const r = await fetch('/api/admin/citas/config', {
        method: 'PATCH',
        headers: CSRF,
        body: JSON.stringify({
          ubicacionAutorizada: cfgUbicacion.trim() || null,
          disponibilidadPublicada: cfgPublicada,
          ...(horarios.length > 0 && { horariosInicio: horarios }),
        }),
      });
      if (!r.ok) throw new Error('No se pudo guardar la configuración de agenda.');
      setMensaje('Configuración de agenda IDC actualizada.');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando configuración.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {puedeConfigurar && config && (
        <details>
          <summary>Configurar agenda y disponibilidad de IDC ({config.disponibilidadPublicada ? 'Publicada' : 'No publicada'})</summary>
          <form className="kv-filtros" style={{ marginTop: 10 }} onSubmit={(e) => void guardarConfig(e)}>
            <label>
              Ubicación autorizada (dejar vacío para no mostrar dirección fija)
              <input value={cfgUbicacion} placeholder="Oficinas autorizadas IDC..." onChange={(e) => setCfgUbicacion(e.target.value)} />
            </label>
            <label>
              Horarios de inicio (HH:mm separados por coma, Hermosillo)
              <input value={cfgHorarios} placeholder="09:00, 10:00, 11:00, 12:00, 15:00" onChange={(e) => setCfgHorarios(e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={cfgPublicada} onChange={(e) => setCfgPublicada(e.target.checked)} />
              Publicar disponibilidad en portal
            </label>
            <Boton type="submit" disabled={ocupado}>Guardar agenda</Boton>
          </form>
        </details>
      )}

      <form className="kv-filtros" onSubmit={(e) => { e.preventDefault(); setFiltros({ ...campos }); }}>
        <label>Folio <input value={campos.folio} placeholder="KV-2026-006" onChange={(e) => setCampos({ ...campos, folio: e.target.value })} /></label>
        <label>
          Estado
          <select value={campos.estado} onChange={(e) => setCampos({ ...campos, estado: e.target.value })}>
            <option value="">Todos</option>
            {ESTADOS_CITA.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_CITA[e].texto}</option>)}
          </select>
        </label>
        <label>Fecha <input type="date" value={campos.fecha} onChange={(e) => setCampos({ ...campos, fecha: e.target.value })} /></label>
        <Boton type="submit" disabled={ocupado}>Filtrar</Boton>
      </form>

      {error && <AlertPanel tono="error">{error}</AlertPanel>}
      {mensaje && <AlertPanel tono="ok">{mensaje}</AlertPanel>}

      <div className="kv-bandeja">
        <section aria-label="Solicitudes de cita">
          {!citas && !error && <p role="status">Consultando citas…</p>}
          {citas?.length === 0 && <p>No hay solicitudes de cita con estos filtros.</p>}
          {!!citas?.length && (
            <div className="kv-tabla-scroll">
              <table className="kv-tabla">
                <thead>
                  <tr><th>Cita / Folio</th><th>Motivo</th><th>Fecha y hora</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {citas.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button
                          type="button"
                          className="kv-btn kv-btn--secundario kv-btn--sm"
                          aria-pressed={seleccion?.id === c.id}
                          onClick={() => {
                            setSeleccion(c);
                            setUbicacion(c.ubicacionAutorizada ?? config?.ubicacionAutorizada ?? '');
                            setMotivo('');
                          }}
                        >
                          {c.folio}
                        </button>
                        <div className="kv-mono" style={{ fontSize: 12 }}>{c.referencia}</div>
                      </td>
                      <td>{INFO_TIPO_VISITA[c.tipoVisita].titulo}</td>
                      <td>{c.fecha} · {c.horaInicio}</td>
                      <td>
                        <StatusBadge tono={ETIQUETA_ESTADO_CITA[c.estado].tono} variante="suave">
                          {ETIQUETA_ESTADO_CITA[c.estado].texto}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-label="Detalle de solicitud de cita">
          {!seleccion ? (
            <p>Selecciona una solicitud de cita para revisar el motivo, validar el horario y confirmar o proponer cambios.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h2>{seleccion.folio} · {seleccion.referencia}</h2>
                <StatusBadge tono={ETIQUETA_ESTADO_CITA[seleccion.estado].tono} variante="suave">
                  {ETIQUETA_ESTADO_CITA[seleccion.estado].texto}
                </StatusBadge>
              </div>
              <p><CalendarDays size={15} aria-hidden="true" /> {INFO_TIPO_VISITA[seleccion.tipoVisita].titulo}</p>
              <p><Clock size={15} aria-hidden="true" /> {formatearFechaLargaHermosillo(seleccion.fecha)} · {seleccion.horaInicio} – {seleccion.horaFin} ({seleccion.zonaHoraria})</p>
              <p><MapPin size={15} aria-hidden="true" /> {seleccion.ubicacionAutorizada ?? 'Ubicación pendiente de especificar al confirmar'}</p>
              {seleccion.notasCliente && <p><strong>Notas del cliente:</strong> {seleccion.notasCliente}</p>}
              {seleccion.propuestaFecha && (
                <AlertPanel tono="alerta" titulo={`Propuesta de cambio (${seleccion.propuestaPor === 'cliente' ? 'Cliente' : 'IDC'})`}>
                  {formatearFechaLargaHermosillo(seleccion.propuestaFecha)} · {seleccion.propuestaHoraInicio} – {seleccion.propuestaHoraFin} (Hermosillo).
                  {seleccion.propuestaNota && ` ${seleccion.propuestaNota}`}
                </AlertPanel>
              )}

              {ESTADOS_CITA_ACTIVOS.includes(seleccion.estado) && (
                <fieldset disabled={ocupado} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10 }}>
                  <legend>Acciones de IDC</legend>
                  <label>
                    Ubicación autorizada al confirmar (opcional)
                    <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Dirección o sala autorizada" />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label>Nueva fecha (para proponer horario) <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} /></label>
                    <label>Nueva hora (HH:mm) <input placeholder="11:00" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} /></label>
                  </div>
                  <label>
                    Motivo / mensaje para el cliente (obligatorio al cancelar)
                    <textarea maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </label>
                  <div className="kv-filtros">
                    {['solicitada', 'pendiente_confirmacion', 'cambio_solicitado'].includes(seleccion.estado) && (
                      <Boton variante="primario" type="button" onClick={() => void ejecutarAccion('confirmar')}>
                        <Check size={15} aria-hidden="true" /> Confirmar cita
                      </Boton>
                    )}
                    <Boton type="button" disabled={!nuevaFecha || !nuevaHora} onClick={() => void ejecutarAccion('proponer_horario')}>
                      <RefreshCw size={15} aria-hidden="true" /> Proponer otro horario
                    </Boton>
                    {(seleccion.estado === 'confirmada' || seleccion.estado === 'reprogramada') && (
                      <Boton type="button" onClick={() => void ejecutarAccion('realizada')}>
                        Registrar visita realizada
                      </Boton>
                    )}
                    <Boton type="button" disabled={!motivo.trim()} onClick={() => void ejecutarAccion('cancelar')}>
                      <XCircle size={15} aria-hidden="true" /> Cancelar con motivo
                    </Boton>
                  </div>
                  <p className="kv-suave">
                    Registrar que la visita ocurrió NO marca automáticamente los documentos como recibidos físicamente; regístralos en la pestaña de recepciones documentales.
                  </p>
                </fieldset>
              )}

              {seleccion.historial.length > 0 && (
                <details open>
                  <summary>Historial de cambios ({seleccion.historial.length})</summary>
                  <ul>
                    {seleccion.historial.map((h) => (
                      <li key={h.id}>
                        <strong>{ETIQUETA_ESTADO_CITA[h.estadoNuevo].texto}</strong> ({h.actor}) · {h.fecha.slice(0, 10)}
                        {h.detalle && ` — ${h.detalle}`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
