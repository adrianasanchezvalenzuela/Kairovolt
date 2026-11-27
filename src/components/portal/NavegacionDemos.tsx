import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
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
  const total = demosPortal.length; // escenarios con folio (01–06); el 00 es la consulta previa
  const NOMBRES = ['Consulta inicial', 'Captura de datos', 'Preparación documental', 'Preparación de visita', 'Solicitud aprobada', 'Instalación del medidor', 'Interconexión completada'];
  const posicion = folio ? Math.max(0, demosPortal.findIndex((d) => d.folio === folio)) + 1 : 0;
  const ultimo = posicion === total;
  
  async function ir(destino: number) {
    if (ocupado) return;
    setOcupado(true);
    try {
      document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
      if (destino === 0) navegar('/portal/consulta', { replace: true });
      else if (destino > total) navegar('/portal/fin', { replace: true });
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
    <span className="kv-demo-nav__indice" aria-live="polite">Demo {posicion + 1} de {total + 1} · {NOMBRES[posicion]}</span>
    <button type="button" className="kv-demo-nav__sig" disabled={ocupado} onClick={() => void ir(posicion + 1)}>
      {ultimo ? <><Flag size={16} aria-hidden="true" /><span>Finalizar recorrido</span></> : <><span>Siguiente demo</span><ChevronRight size={18} aria-hidden="true" /></>}
    </button>
  </div>;
}
