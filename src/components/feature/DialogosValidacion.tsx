import { useId, useState, type FormEvent } from 'react';
import { MIN_CARACTERES_JUSTIFICACION } from '@/domain/observaciones/resolucion';
import type { Observacion, ResolucionObservacion, TipoResolucion } from '@/domain/observaciones/observacion';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado.');

export interface AsignarResponsableProps {
  observacion: Observacion | null;
  /** Sugerencias (roles, personas del proyecto). El campo acepta texto libre. */
  sugerencias: readonly string[];
  onCerrar: () => void;
  onGuardar: (responsable: string, fechaCompromiso: string | null) => Promise<void>;
}

/** Asigna responsable y fecha comprometida. Quien lo guarda queda en la auditoría. */
export function AsignarResponsableDialogo({ observacion, sugerencias, onCerrar, onGuardar }: AsignarResponsableProps) {
  const id = useId();
  const [responsable, setResponsable] = useState(observacion?.responsable ?? '');
  const [fecha, setFecha] = useState(observacion?.fechaCompromiso ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(responsable, fecha === '' ? null : fecha);
      onCerrar();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialogo
      abierto={observacion !== null} titulo="Asignar responsable" onCerrar={onCerrar} ocupado={guardando}
      pie={<><Boton onClick={onCerrar} disabled={guardando}>Cancelar</Boton><Boton type="submit" form={`${id}-f`} variante="primario" cargando={guardando}>Guardar</Boton></>}
    >
      {observacion && (
        <form id={`${id}-f`} onSubmit={(e) => void enviar(e)}>
          <p className="kv-suave">{observacion.descripcion}</p>
          <div className="kv-campo">
            <label htmlFor={`${id}-r`}>Responsable</label>
            <input id={`${id}-r`} list={`${id}-l`} value={responsable} onChange={(e) => setResponsable(e.target.value)} required maxLength={120} autoComplete="off" />
            <datalist id={`${id}-l`}>{sugerencias.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="kv-campo">
            <label htmlFor={`${id}-f2`}>Fecha comprometida</label>
            <input id={`${id}-f2`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <span className="kv-campo__ayuda">Sin fecha comprometida la observación aparece como brecha de seguimiento.</span>
          </div>
          {error && <AlertPanel tono="error" variante="en-linea">{error}</AlertPanel>}
        </form>
      )}
    </Dialogo>
  );
}

const TIPOS: { valor: TipoResolucion; etiqueta: string; ayuda: string }[] = [
  { valor: 'corregido', etiqueta: 'Corregido', ayuda: 'Solo procede si al revalidar el expediente la regla ya cumple.' },
  { valor: 'aceptado_con_justificacion', etiqueta: 'Aceptado con justificación (excepción)', ayuda: 'Una persona autorizada decide continuar con el valor actual. Solo vale para ese valor: si cambia, se reabre.' },
  { valor: 'no_aplica', etiqueta: 'No aplica', ayuda: 'La regla no corresponde a este proyecto. Debe justificarse.' },
];

export interface ResolucionProps {
  observacion: Observacion | null;
  /** Documentos del expediente que pueden citarse como evidencia de la resolución. */
  documentos: readonly { id: string; nombre: string }[];
  responsableInicial: string;
  hoy: string;
  /** Muestra al instante por qué no procede (el dominio lo vuelve a comprobar al guardar). */
  motivosPrevios: (r: ResolucionObservacion) => string[];
  onCerrar: () => void;
  onGuardar: (r: ResolucionObservacion) => Promise<void>;
}

/** Registra la resolución de una observación. Cierra la observación; nunca modifica datos técnicos ni documentos. */
export function ResolucionDialogo({ observacion, documentos, responsableInicial, hoy, motivosPrevios, onCerrar, onGuardar }: ResolucionProps) {
  const id = useId();
  const [tipo, setTipo] = useState<TipoResolucion>('aceptado_con_justificacion');
  const [justificacion, setJustificacion] = useState('');
  const [responsable, setResponsable] = useState(responsableInicial);
  const [fecha, setFecha] = useState(hoy);
  const [evidencia, setEvidencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resolucion: ResolucionObservacion = { tipo, justificacion, responsable, fecha, evidenciaDocumentoId: evidencia || null };
  const motivos = observacion ? motivosPrevios(resolucion) : [];

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(resolucion);
      onCerrar();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialogo
      abierto={observacion !== null} titulo="Registrar resolución" onCerrar={onCerrar} ocupado={guardando}
      pie={<><Boton onClick={onCerrar} disabled={guardando}>Cancelar</Boton><Boton type="submit" form={`${id}-f`} variante="primario" cargando={guardando} disabled={motivos.length > 0}>Registrar resolución</Boton></>}
    >
      {observacion && (
        <form id={`${id}-f`} onSubmit={(e) => void enviar(e)}>
          <p className="kv-suave">{observacion.descripcion}</p>
          <fieldset className="kv-campo" style={{ border: 0, padding: 0 }}>
            <legend className="kv-campo__etiqueta">Cómo se resuelve</legend>
            {TIPOS.map((t) => (
              <label key={t.valor} style={{ display: 'block', marginBottom: 4 }}>
                <input type="radio" name={`${id}-tipo`} checked={tipo === t.valor} onChange={() => setTipo(t.valor)} /> <strong>{t.etiqueta}</strong>
                <span className="kv-campo__ayuda" style={{ display: 'block', marginLeft: 22 }}>{t.ayuda}</span>
              </label>
            ))}
          </fieldset>
          <div className="kv-campo">
            <label htmlFor={`${id}-j`}>Justificación</label>
            <textarea id={`${id}-j`} rows={3} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} required maxLength={2000} />
            <span className="kv-campo__ayuda">Mínimo {MIN_CARACTERES_JUSTIFICACION} caracteres. Queda en el historial con tu nombre.</span>
          </div>
          <div className="kv-fila">
            <div className="kv-campo" style={{ flex: 1 }}>
              <label htmlFor={`${id}-r`}>Responsable</label>
              <input id={`${id}-r`} value={responsable} onChange={(e) => setResponsable(e.target.value)} required maxLength={120} />
            </div>
            <div className="kv-campo">
              <label htmlFor={`${id}-d`}>Fecha</label>
              <input id={`${id}-d`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
          </div>
          <div className="kv-campo">
            <label htmlFor={`${id}-e`}>Documento de evidencia (opcional)</label>
            <select id={`${id}-e`} value={evidencia} onChange={(e) => setEvidencia(e.target.value)}>
              <option value="">Ninguno</option>
              {documentos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          {motivos.length > 0 && <AlertPanel tono="alerta" variante="en-linea" titulo="Todavía no se puede registrar"><ul style={{ margin: 0, paddingLeft: 18 }}>{motivos.map((m) => <li key={m}>{m}</li>)}</ul></AlertPanel>}
          {error && <AlertPanel tono="error" variante="en-linea">{error}</AlertPanel>}
        </form>
      )}
    </Dialogo>
  );
}
