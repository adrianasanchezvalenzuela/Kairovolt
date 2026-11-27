import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { EnergiaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { DEMOS_VISUAL } from '@/components/portal/demos-visual';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { demosPortal } from '@/data/demos-portal';
import { usePortal } from '@/hooks/PortalContexto';

/** Selector de los seis escenarios: cada tarjeta tiene su propio color, número e icono. */
export function PortalDemos() {
  const { entrar } = usePortal();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  if (!import.meta.env.DEV || !window.location.pathname.startsWith('/demo/portal/')) return <Navigate to="/portal" replace />;

  async function abrir(folio: string, codigo: string) {
    setError('');
    setOcupado(folio);
    try {
      await entrar(folio, codigo);
      navegar('/portal/inicio');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la demostración.');
    } finally { setOcupado(''); }
  }

  return <main className="kvp kv-sel">
    <header className="kv-sel__cab"><MarcaPortal /><span className="kv-cliente-demo">DEMO · {demosPortal.length} escenarios</span></header>
    <div className="kv-sel__hero">
      <div>
        <h1>Elige una etapa del recorrido.</h1>
        <p>Seis momentos de una misma interconexión fotovoltaica, del primer dato a la conexión. Avanza en orden o salta a donde quieras.</p>
      </div>
      <EnergiaPortal className="kv-sel__energia" />
    </div>
    <p className="kv-sel__idc"><Users size={18} aria-hidden="true" /> ¿Quieres ver el otro lado? <Link to="/idc/KV-2026-005">Abrir el panel IDC de demostración</Link></p>
    {error && <AlertPanel tono="error">{error}</AlertPanel>}

    <div className="kv-sel__rejilla">{DEMOS_VISUAL.map((d) => {
      const demo = demosPortal[d.indice]!;
      return <article key={d.folio} className={'kv-sel__tarjeta' + (d.tarjeta.oscuro ? ' kv-sel__tarjeta--oscura' : '')}
        style={{ ['--t-fondo' as string]: d.tarjeta.fondo, ['--t-texto' as string]: d.tarjeta.texto, ['--t-acento' as string]: d.tarjeta.acento }}>
        <div className="kv-sel__fila"><span className="kv-sel__numero">{d.numero}</span><span className="kv-sel__icono"><d.Icono size={24} aria-hidden="true" /></span></div>
        <h2>{d.tarjeta.titulo}</h2>
        <p className="kv-sel__etapa">{d.tarjeta.etapa}</p>
        <details className="kv-sel__datos"><summary>Folio y código</summary>
          <dl><dt>Folio</dt><dd>{demo.folio}</dd><dt>Código</dt><dd>{demo.codigo}</dd></dl></details>
        <button type="button" className="kv-sel__boton" disabled={!!ocupado} onClick={() => void abrir(demo.folio, demo.codigo)}>
          {ocupado === demo.folio ? 'Abriendo…' : 'Abrir demo'}<ArrowRight size={17} aria-hidden="true" />
        </button>
      </article>;
    })}</div>
  </main>;
}
