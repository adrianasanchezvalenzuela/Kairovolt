import { useState } from 'react';
import { ErrorSincronizacion, type SincronizacionRepositorio } from '@/application/sincronizacion';
import type { Compuerta, CompuertaId, EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { useConfirmacion } from '@/hooks/useConfirmacion';
import { ETIQUETA_ESTADO_COMPUERTA } from './GateStepper';

const ESTADOS = Object.keys(ETIQUETA_ESTADO_COMPUERTA) as EstadoCompuerta[];

interface Props {
  folio: string;
  compuerta: Compuerta;
  sincronizacion: SincronizacionRepositorio;
  /** Avisos de reglas de negocio (previas sin liberar, hallazgos, expediente no verificable). Informan; no bloquean. */
  avisos: string[];
  onSincronizado: () => void;
}

export function SincronizarCompuerta({ folio, compuerta, sincronizacion, avisos, onSincronizado }: Props) {
  const [estado, setEstado] = useState<EstadoCompuerta>(compuerta.estado);
  const [simular, setSimular] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const { confirmar, modal } = useConfirmacion();

  const enviar = async () => {
    if (!simular) {
      const conAvisos = estado === 'liberada' && avisos.length > 0;
      const acepta = await confirmar({
        titulo: `Cambiar ${compuerta.id} a «${ETIQUETA_ESTADO_COMPUERTA[estado]}»`,
        tono: 'alerta',
        confirmarTexto: 'Escribir en Zoho',
        mensaje: <><p>Esto escribe en Zoho Projects.</p>{conAvisos && <><p>Avisos:</p><ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul></>}</>,
      });
      if (!acepta) return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const r = await sincronizacion.compuerta({ folio, compuerta: compuerta.id as CompuertaId, estado, simular });
      if (r.tipo === 'simulado') setMensaje({ tipo: 'ok', texto: `Simulación (no se escribió nada): ${JSON.stringify(r.peticion)}` });
      else {
        setMensaje({ tipo: 'ok', texto: r.detalle });
        if (r.tipo === 'sincronizado') onSincronizado();
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof ErrorSincronizacion ? e.message : 'Error inesperado.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="kv-formulario">
      {modal}
      <strong>Sincronizar {compuerta.id} con Zoho Projects</strong>
      <div className="kv-fila">
        <label htmlFor="estado-gate">Estado:</label>
        <select id="estado-gate" value={estado} onChange={(e) => setEstado(e.target.value as EstadoCompuerta)}>
          {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_COMPUERTA[e]}</option>)}
        </select>
        <label><input type="checkbox" checked={simular} onChange={(e) => setSimular(e.target.checked)} /> Solo simular</label>
        <Boton variante="primario" cargando={enviando} onClick={() => void enviar()}>{enviando ? 'Enviando…' : simular ? 'Simular' : 'Sincronizar'}</Boton>
      </div>
      {estado === 'liberada' && avisos.length > 0 && (
        <AlertPanel tono="alerta" variante="en-linea" titulo="Antes de liberar">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </AlertPanel>
      )}
      {mensaje && <AlertPanel tono={mensaje.tipo === 'error' ? 'error' : 'ok'} variante="en-linea">{mensaje.texto}</AlertPanel>}
    </div>
  );
}
