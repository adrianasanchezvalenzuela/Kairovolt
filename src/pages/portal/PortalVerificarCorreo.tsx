import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarcaPortal, PortadaPortal } from '@/components/portal/DisenoPortal';
import { AlertPanel } from '@/components/ui/AlertPanel';

export function PortalVerificarCorreo() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('verificacion'));
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'confirmado' | 'error'>(token ? 'listo' : 'error');
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);

  async function verificar() {
    setEstado('enviando');
    try {
      const r = await fetch('/api/verificar-correo-portal', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' }, body: JSON.stringify({ token }) });
      setEstado(r.ok ? 'confirmado' : 'error');
    } catch { setEstado('error'); }
  }

  return <main className="kvp kv-cliente-galeria">
    <header><MarcaPortal /></header>
    <section className="kv-cliente-superficie">
      <PortadaPortal titulo="Verifica tu correo.">Confirma que quieres recibir avisos de tu expediente en esta dirección.</PortadaPortal>
      {(estado === 'listo' || estado === 'enviando') && <button className="kvp-boton" disabled={estado === 'enviando'} onClick={() => void verificar()}>Confirmar correo</button>}
      {estado === 'confirmado' && <AlertPanel tono="ok">El correo quedó verificado para recibir avisos.</AlertPanel>}
      {estado === 'error' && <AlertPanel tono="error">No se pudo confirmar el enlace. Si venció o ya fue usado, solicita uno nuevo a IDC.</AlertPanel>}
      <p><Link to="/portal">Ir al portal</Link></p>
    </section>
  </main>;
}
