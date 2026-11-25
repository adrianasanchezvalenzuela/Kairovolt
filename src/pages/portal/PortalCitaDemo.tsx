import { useState, type FormEvent } from 'react';
import { CalendarDays, CircleCheck, Download } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { EnlacePortal, PortadaPortal } from '@/components/portal/DisenoPortal';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { useVistaPortal } from '@/hooks/PortalContexto';
import { esCitaDemo } from '@/data/demos-portal';

interface Cita { fecha: string; hora: string; referencia: string }
const horarios = ['09:00', '10:30', '12:00', '15:00'];
const formato = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Hermosillo' });

export function PortalCitaDemo() {
  const v = useVistaPortal();
  const llave = 'kairovolt:cita-demo:' + v.folio;
  const [cita, setCita] = useState<Cita | null>(() => {
    if (!esCitaDemo(v)) return null;
    try { return JSON.parse(sessionStorage.getItem(llave) ?? 'null') as Cita | null; } catch { return null; }
  });
  const [fecha, setFecha] = useState(cita?.fecha ?? '');
  const [hora, setHora] = useState(cita?.hora ?? '');
  const [editando, setEditando] = useState(!cita);
  const [error, setError] = useState('');
  if (!esCitaDemo(v)) return <Navigate to="/portal/inicio" replace />;

  const partes = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Hermosillo' }).formatToParts();
  const hoy = ['year', 'month', 'day'].map((tipo) => partes.find((p) => p.type === tipo)?.value).join('-');
  const dia = (valor: string) => formato.format(new Date(valor + 'T12:00:00-07:00'));
  const dias = Array.from({ length: 10 }, (_, i) => new Date(Date.parse(hoy + 'T12:00:00Z') + (i + 1) * 86_400_000))
    .filter((d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6).slice(0, 5).map((d) => d.toISOString().slice(0, 10));

  function generar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fecha || fecha < hoy || !horarios.includes(hora) || new Date(fecha + 'T' + hora + ':00-07:00').getTime() <= Date.now()) {
      setError('Elige una fecha y un horario de prueba que todavía no hayan pasado.');
      return;
    }
    const nueva = { fecha, hora, referencia: 'CITA-DEMO-' + crypto.randomUUID().slice(0, 8).toUpperCase() };
    try { sessionStorage.setItem(llave, JSON.stringify(nueva)); } catch { /* Se conserva en pantalla. */ }
    setCita(nueva);
    setEditando(false);
    setError('');
  }

  function descargar(c: Cita) {
    const texto = ['KairóVolt · Comprobante de cita simulada', c.referencia, v.folio,
      dia(c.fecha) + ' · ' + c.hora + ' (Hermosillo)', 'Motivo: Entrega física del expediente',
      'Demostración. Este comprobante no reserva un horario ni acredita una cita con IDC.'].join('\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = c.referencia + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <>
    <PortadaPortal titulo="Entrega física del expediente.">Genera una cita de prueba para presentar los documentos revisados.</PortadaPortal>
    <div className="kv-cliente-principal kv-cliente-cita">
      <section className="kv-cliente-superficie">
        {editando ? <form onSubmit={generar}>
          <h2><CalendarDays size={22} aria-hidden="true" /> Elige un horario de prueba</h2>
          <label>Fecha <select required value={fecha} onChange={(e) => setFecha(e.target.value)}>
            <option value="">Selecciona un día</option>{dias.map((f) => <option key={f} value={f}>{dia(f)}</option>)}
          </select></label>
          <label>Horario de Hermosillo <select required value={hora} onChange={(e) => setHora(e.target.value)}>
            <option value="">Selecciona una hora</option>{horarios.map((h) => <option key={h}>{h}</option>)}
          </select></label>
          {error && <AlertPanel tono="error">{error}</AlertPanel>}
          <button type="submit" className="kvp-boton">Generar cita de prueba</button>
        </form> : cita && <div role="status">
          <h2><CircleCheck size={22} aria-hidden="true" /> Cita de prueba generada</h2>
          <p>{dia(cita.fecha)} · {cita.hora} (Hermosillo)</p><p className="kv-mono">{cita.referencia}</p>
          <div className="kv-cliente-cita__acciones">
            <button className="kvp-boton" onClick={() => descargar(cita)}><Download size={17} aria-hidden="true" /> Descargar comprobante</button>
            <button className="kvp-boton kvp-boton--suave" onClick={() => setEditando(true)}>Cambiar horario</button>
          </div>
        </div>}
      </section>
      <aside className="kv-cliente-accion">
        <h2>Documentos aceptados</h2>
        <ul>{v.documentos?.filter((d) => d.estado === 'aceptado').map((d) => <li key={d.id}>{d.nombre}</li>)}</ul>
        <p>Esta simulación no reserva un horario ni envía una notificación a IDC.</p>
        <EnlacePortal to="/portal/documentos" secundario>Ver expediente</EnlacePortal>
      </aside>
    </div>
  </>;
}
