import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { EnlacePortal, PortadaPortal } from '@/components/portal/DisenoPortal';
import { VistaArchivoPortal } from '@/components/portal/VistaArchivoPortal';
import { demosPortal } from '@/data/demos-portal';
import { usePortal, useVistaPortal } from '@/hooks/PortalContexto';
import { simularRevisionPortal } from '@/infrastructure/portal-http';

export function PortalRevisionDemo() {
  const v = useVistaPortal();
  const { recargar } = usePortal();
  const [seleccion, setSeleccion] = useState('');
  const [comentario, setComentario] = useState('');
  const [resultado, setResultado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  if (!import.meta.env.DEV || !v.demo || v.folio !== demosPortal[1].folio ||
      !window.location.pathname.startsWith('/demo/portal/')) return <Navigate to="/portal/inicio" replace />;
  const pendientes = v.recepciones.filter((r) => !r.sustituida && ['en_revision', 'recibido'].includes(r.estado));
  const r = pendientes.find((a) => a.recibo === seleccion);

  async function decidir(e: FormEvent, estado: 'rechazado' | 'prevalidado') {
    e.preventDefault();
    if (!r || ocupado || (estado === 'rechazado' && !comentario.trim())) return;
    setOcupado(true); setError('');
    try {
      await simularRevisionPortal(r.recibo, estado, estado === 'rechazado' ? comentario : '');
      setResultado(estado === 'rechazado' ? 'Corrección registrada en la demo.' : 'Versión prevalidada en la demo.');
      setSeleccion(''); setComentario('');
      await recargar();
    } catch (err) { setError(err instanceof Error ? err.message : 'No pudimos simular la revisión.'); }
    finally { setOcupado(false); }
  }

  return <>
    <PortadaPortal titulo="Simular revisión de IDC.">Prueba la decisión sobre una versión del expediente ficticio.</PortadaPortal>
    <div className="kv-cliente-superficie kv-doc-guia">
      <label>Envío para revisar <select value={seleccion} onChange={(e) => { setSeleccion(e.target.value); setComentario(''); }}>
        <option value="">Selecciona una recepción</option>{pendientes.map((p) => <option key={p.recibo} value={p.recibo}>{p.documento} · {p.recibo}</option>)}
      </select></label>
      {resultado && <AlertPanel tono="ok">{resultado} <EnlacePortal to="/portal/avisos" secundario>Ver aviso y correo simulado</EnlacePortal></AlertPanel>}
      {error && <AlertPanel tono="error">{error}</AlertPanel>}
      {r && <>
        <VistaArchivoPortal recepcion={r} />
        <form className="kv-doc-guia" onSubmit={(e) => void decidir(e, 'rechazado')}>
          <label>Comentario visible para el cliente <textarea required maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} /></label>
          <div className="kv-doc-archivo__acciones">
            <button className="kvp-boton" type="submit" disabled={ocupado || !comentario.trim()}>Solicitar corrección</button>
            <button className="kvp-boton kvp-boton--suave" type="button" disabled={ocupado} onClick={(e) => void decidir(e, 'prevalidado')}>Prevalidar copia</button>
          </div>
        </form>
      </>}
    </div>
  </>;
}
