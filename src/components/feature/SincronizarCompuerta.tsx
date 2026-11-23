import { useState } from 'react';
import { ErrorSincronizacion, type SincronizacionRepositorio } from '@/application/sincronizacion';
import type { Compuerta, CompuertaId, EstadoCompuerta } from '@/domain/compuertas/compuerta';
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

  const enviar = async () => {
    if (!simular) {
      const lista = estado === 'liberada' && avisos.length > 0 ? `\n\nAvisos:\n- ${avisos.join('\n- ')}` : '';
      if (!window.confirm(`¿Cambiar ${compuerta.id} a "${ETIQUETA_ESTADO_COMPUERTA[estado]}" en Zoho Projects? Esto escribe en Zoho.${lista}`)) return;
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
    <div style={{ background: '#fff', border: '1px solid var(--kv-borde)', borderRadius: 'var(--kv-radio)', padding: 12, marginTop: 12 }}>
      <strong>Sincronizar {compuerta.id} con Zoho Projects</strong>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <label htmlFor="estado-gate">Estado:</label>
        <select id="estado-gate" value={estado} onChange={(e) => setEstado(e.target.value as EstadoCompuerta)}>
          {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_COMPUERTA[e]}</option>)}
        </select>
        <label><input type="checkbox" checked={simular} onChange={(e) => setSimular(e.target.checked)} /> Solo simular</label>
        <button disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Enviando…' : simular ? 'Simular' : 'Sincronizar'}</button>
      </div>
      {estado === 'liberada' && avisos.length > 0 && (
        <ul className="kv-suave" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
      )}
      {mensaje && <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} style={{ margin: '8px 0 0', color: mensaje.tipo === 'error' ? 'var(--kv-error)' : 'var(--kv-ok)', wordBreak: 'break-word' }}>{mensaje.texto}</p>}
    </div>
  );
}
