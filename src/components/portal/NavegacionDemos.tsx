import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { demosPortal } from '@/data/demos-portal';
import { usePortal } from '@/hooks/PortalContexto';

/**
 * Navegación secuencial entre demos (solo desarrollo). Posición 0 = «Antes de comenzar» (consulta pública, sin folio);
 * posiciones 1 a N = los escenarios con folio, que conservan su numeración 01–06.
 */
export function NavegacionDemos({ folio }: { folio?: string }) {
  const { entrar } = usePortal();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState(false);
  const total = demosPortal.length;
  const posicion = folio ? Math.max(0, demosPortal.findIndex((d) => d.folio === folio)) + 1 : 0;
  const ultimo = posicion === total;
  const dos = (n: number) => String(n).padStart(2, '0');

  async function ir(destino: number) {
    if (ocupado) return;
    setOcupado(true);
    try {
      document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
      if (destino === 0) navegar('/portal', { replace: true });
      else {
        const demo = demosPortal[destino - 1];
        if (!demo) return;
        await entrar(demo.folio, demo.codigo);
        navegar('/portal/inicio', { replace: true });
      }
      window.scrollTo({ top: 0 });
    } finally { setOcupado(false); }
  }

  return <div className="kv-demo-nav" role="group" aria-label="Navegación entre demostraciones">
    <button type="button" className="kv-demo-nav__ant" disabled={posicion === 0 || ocupado} onClick={() => void ir(posicion - 1)} aria-label="Demo anterior" title="Demo anterior"><ChevronLeft size={18} aria-hidden="true" /></button>
    <NavLink to="/portal/demos" className="kv-cliente-demo" title="Elegir una demostración">DEMO · Cambiar</NavLink>
    <span className="kv-demo-nav__indice" aria-live="polite">Demo {dos(posicion)} de {dos(total)}</span>
    <button type="button" className="kv-demo-nav__sig" disabled={ocupado} onClick={() => void ir(ultimo ? 0 : posicion + 1)}>
      {ultimo ? <><RotateCcw size={16} aria-hidden="true" /><span>Reiniciar recorrido</span></> : <><span>Siguiente demo</span><ChevronRight size={18} aria-hidden="true" /></>}
    </button>
  </div>;
}
