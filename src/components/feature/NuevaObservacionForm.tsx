import { useState, type FormEvent } from 'react';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { ErrorSincronizacion, type SincronizacionRepositorio } from '@/application/sincronizacion';
import { NOMBRE_COMPUERTA, ORDEN_COMPUERTAS, type CompuertaId } from '@/domain/compuertas/compuerta';
import type { OrigenObservacion } from '@/domain/observaciones/observacion';

const ORIGENES: { valor: OrigenObservacion; texto: string }[] = [
  { valor: 'interna', texto: 'Interna' },
  { valor: 'cfe', texto: 'CFE' },
  { valor: 'uvie', texto: 'UVIE' },
];

interface Props {
  folio: string;
  compuertaInicial: CompuertaId;
  sincronizacion: SincronizacionRepositorio;
  onCreada: () => void;
}

export function NuevaObservacionForm({ folio, compuertaInicial, sincronizacion, onCreada }: Props) {
  const [compuerta, setCompuerta] = useState<CompuertaId>(compuertaInicial);
  const [origen, setOrigen] = useState<OrigenObservacion>('interna');
  const [descripcion, setDescripcion] = useState('');
  const [responsable, setResponsable] = useState('');
  const [fecha, setFecha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);
    try {
      await sincronizacion.observacion({
        folio, observacionId: `obs-${crypto.randomUUID().slice(0, 8)}`, compuerta, origen, estado: 'abierta',
        descripcion: descripcion.trim(), responsable: responsable.trim() || null, fechaCompromiso: fecha || null,
      });
      setDescripcion(''); setResponsable(''); setFecha('');
      setMensaje({ tipo: 'ok', texto: 'Observación registrada en Zoho CRM (nota del trato).' });
      onCreada();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof ErrorSincronizacion ? err.message : 'Error inesperado.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="kv-formulario">
      <strong>Nueva observación (se guarda en Zoho CRM)</strong>
      <div className="kv-fila">
        <select aria-label="Compuerta" value={compuerta} onChange={(e) => setCompuerta(e.target.value as CompuertaId)}>
          {ORDEN_COMPUERTAS.map((g) => <option key={g} value={g}>{g} · {NOMBRE_COMPUERTA[g]}</option>)}
        </select>
        <select aria-label="Origen" value={origen} onChange={(e) => setOrigen(e.target.value as OrigenObservacion)}>
          {ORIGENES.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
        <input aria-label="Responsable" placeholder="Responsable (opcional)" value={responsable} onChange={(e) => setResponsable(e.target.value)} maxLength={120} />
        <input aria-label="Fecha compromiso" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <textarea
        aria-label="Descripción" required rows={2} maxLength={2000} placeholder="Descripción de la observación" value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)} style={{ width: '100%', marginTop: 8, font: 'inherit' }}
      />
      <div className="kv-fila"><Boton type="submit" variante="primario" cargando={enviando} disabled={descripcion.trim() === ''}>{enviando ? 'Enviando…' : 'Registrar en Zoho'}</Boton></div>
      {mensaje && <AlertPanel tono={mensaje.tipo === 'error' ? 'error' : 'ok'} variante="en-linea">{mensaje.texto}</AlertPanel>}
    </form>
  );
}
