import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Info, ShieldCheck } from 'lucide-react';
import { IlustracionExpediente, PortadaPortal } from '@/components/portal/DisenoPortal';
import { datosIniciales, pasosParticipantes, type DatosParticipantes } from '@/application/participantes';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { useVistaPortal } from '@/hooks/PortalContexto';
import { datosPortal } from '@/infrastructure/portal-http';

const pasos = ['Titular', 'Representación', 'Testigos', 'Confirmación'];
const ayudas = ['Elige el tipo de titular y captura su nombre o razón social.',
  'Indica quién realizará el trámite. El representante legal y el apoderado pueden ser personas distintas.',
  'Captura testigos únicamente cuando IDC te indique que se necesitan.',
  'Revisa la información. Puedes regresar a cualquier paso antes de confirmar.'];

export function PortalMisDatos() {
  const { permisos, demo } = useVistaPortal();
  const [datos, setDatos] = useState(datosIniciales);
  const [paso, setPaso] = useState(0);
  const [version, setVersion] = useState<number | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!permisos.editarParticipantes) return;
    let vigente = true;
    void datosPortal().then((r) => {
      if (!vigente) return;
      setVersion(r?.version ?? 0);
      setDatos(r?.datos ?? datosIniciales);
      setConfirmado(r?.confirmado ?? false);
    }).catch((e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [permisos.editarParticipantes, intento]);

  const actualizar = (cambio: Partial<DatosParticipantes>) => {
    setDatos((d) => ({ ...d, ...cambio }));
    setConfirmado(false);
    setMensaje('');
  };
  const completos = pasosParticipantes(datos);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (version === null || ocupado) return;
    if ((paso < 2 && !completos[paso]) || (paso === 3 && !completos.every(Boolean))) {
      setError('Completa la información del titular y de quien realizará el trámite.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const r = await datosPortal({ datos, version, confirmado: paso === 3 });
      if (!r) throw new Error('El servidor no confirmó el guardado.');
      setDatos(r.datos);
      setVersion(r.version);
      setConfirmado(r.confirmado);
      setMensaje(r.confirmado ? 'Datos confirmados y guardados.' : 'Avance guardado.');
      setPaso(Math.min(paso + 1, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar tus datos.');
    } finally {
      setOcupado(false);
    }
  }

  if (!permisos.editarParticipantes) return <AlertPanel tono="alerta">IDC debe habilitar la captura de datos para este acceso.</AlertPanel>;

  return (
    <section className="kvp-mis-datos">
      <div className="kv-cliente-intro kv-cliente-intro--datos">
        <PortadaPortal titulo="Tu información, en orden.">Estos datos ayudan a IDC a preparar los documentos de tu expediente.</PortadaPortal>
        <IlustracionExpediente variante="identidad" />
      </div>
      <div className="kv-cliente-captura">
      <nav aria-label="Pasos de captura">
        <ol>{pasos.map((p, i) => <li key={p}>
          <button type="button" disabled={ocupado || version === null} aria-current={i === paso ? 'step' : undefined} onClick={() => setPaso(i)}>
            <span>{(i < 2 && completos[i]) || (i === 3 && confirmado) ? <Check size={15} aria-label="Completo" /> : i + 1}</span>{p}
          </button>
        </li>)}</ol>
      </nav>
      <div className="kv-cliente-captura__centro">
      {version === null && !error && <p role="status">Consultando tus datos…</p>}
      {error && <AlertPanel tono="error" acciones={<Boton disabled={ocupado} onClick={() => {
        setError(''); setMensaje(''); setVersion(null); setIntento(intento + 1);
      }}>Cargar versión guardada</Boton>}>{error}</AlertPanel>}
      {mensaje && <p role="status">{mensaje}</p>}
      {version !== null && <form onSubmit={(e) => void guardar(e)}>
        <fieldset disabled={ocupado}>
          <legend>{pasos[paso]}</legend>
          {paso === 0 && <>
            <label>Tipo de titular<select required value={datos.tipoTitular} onChange={(e) => actualizar({ tipoTitular: e.target.value as DatosParticipantes['tipoTitular'] })}>
              <option value="">Selecciona una opción</option><option value="fisica">Persona física</option><option value="moral">Persona moral</option>
            </select></label>
            <label>{datos.tipoTitular === 'moral' ? 'Razón social' : 'Nombre del titular'}<input required maxLength={160} value={datos.titular} onChange={(e) => actualizar({ titular: e.target.value })} /></label>
          </>}
          {paso === 1 && <>
            <label>Quién tramita<select required value={datos.tramita} onChange={(e) => actualizar({ tramita: e.target.value as DatosParticipantes['tramita'] })}>
              <option value="">Selecciona una opción</option><option value="titular">Titular</option><option value="representante">Representante legal</option><option value="apoderado">Apoderado</option>
            </select></label>
            {(datos.tipoTitular === 'moral' || datos.tramita === 'representante') &&
              <label>Nombre del representante legal<input required={datos.tramita === 'representante'} maxLength={160} value={datos.representante} onChange={(e) => actualizar({ representante: e.target.value })} /></label>}
            {datos.tramita === 'apoderado' &&
              <label>Nombre del apoderado<input required maxLength={160} value={datos.apoderado} onChange={(e) => actualizar({ apoderado: e.target.value })} /></label>}
          </>}
          {paso === 2 && <>
            <p>Registra testigos si IDC te indicó que corresponden a tu trámite. Este paso es opcional.</p>
            {datos.testigos.map((nombre, i) => <div key={i} className="kvp-testigo">
              <label>Testigo {i + 1}<input maxLength={160} value={nombre} onChange={(e) => actualizar({ testigos: datos.testigos.map((t, j) => i === j ? e.target.value : t) })} /></label>
              <Boton type="button" onClick={() => actualizar({ testigos: datos.testigos.filter((_, j) => j !== i) })}>Quitar</Boton>
            </div>)}
            <Boton type="button" disabled={datos.testigos.length >= 8} onClick={() => actualizar({ testigos: [...datos.testigos, ''] })}>Agregar testigo</Boton>
          </>}
          {paso === 3 && <>
            <dl>
              <dt>Titular</dt><dd>{datos.titular || 'Pendiente'}</dd>
              <dt>Tramita</dt><dd>{datos.tramita === 'titular' ? 'Titular' : datos.tramita === 'representante' ? 'Representante legal' : datos.tramita === 'apoderado' ? 'Apoderado' : 'Pendiente'}</dd>
              <dt>Representante legal</dt><dd>{datos.representante || 'Sin captura'}</dd>
              <dt>Apoderado</dt><dd>{datos.apoderado || 'Sin captura'}</dd>
              <dt>Testigos</dt><dd>{datos.testigos.join(', ') || 'Sin captura'}</dd>
            </dl>
            {confirmado && <Link to="/portal/documentos">Continuar a Documentos</Link>}
          </>}
        </fieldset>
        <div className="kvp-mis-datos__acciones">
          {paso > 0 && <Boton type="button" disabled={ocupado} onClick={() => setPaso(paso - 1)}>Atrás</Boton>}
          <Boton type="submit" variante="primario" cargando={ocupado} disabled={paso === 3 && confirmado}>{ocupado ? 'Guardando…' : paso === 3 ? 'Confirmar datos' : 'Guardar y continuar'}</Boton>
        </div>
      </form>}
      </div>
      <aside className="kv-cliente-captura__ayuda">
        <h2><Info size={18} aria-hidden="true" /> {pasos[paso]}</h2><p>{ayudas[paso]}</p>
        <h2><ShieldCheck size={18} aria-hidden="true" /> Privacidad</h2>
        <p>IDC utiliza estos datos para preparar el expediente de tu folio. Comunícate con IDC para ejercer tus derechos de privacidad.</p>
        {demo && <p>Usa únicamente datos ficticios.</p>}
      </aside>
      </div>
    </section>
  );
}
