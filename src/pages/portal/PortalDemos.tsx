import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, FolderCheck, FolderOpen } from 'lucide-react';
import { EnergiaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { demosPortal } from '@/data/demos-portal';
import { usePortal } from '@/hooks/PortalContexto';

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la demostración.');
    } finally { setOcupado(''); }
  }

  return <main className="kvp kv-cliente-galeria">
    <header><MarcaPortal /><span className="kv-cliente-demo">DEMO</span></header>
    <div className="kv-cliente-galeria__hero">
      <div><h1>Elige un expediente de prueba.</h1><p>Recorre el portal desde dos momentos distintos del trámite. Usa solo datos ficticios.</p></div>
      <EnergiaPortal />
    </div>
    {error && <AlertPanel tono="error">{error}</AlertPanel>}
    <div className="kv-cliente-galeria__casos">{demosPortal.map(({ folio, codigo, titulo, descripcion }, i) => {
      const Icono = i === 0 ? FolderOpen : FolderCheck;
      return <section key={folio}>
        <Icono size={27} aria-hidden="true" /><h2>{titulo}</h2><p>{descripcion}</p>
        <dl><dt>Folio</dt><dd>{folio}</dd><dt>Código</dt><dd>{codigo}</dd></dl>
        <button type="button" className="kvp-boton" disabled={!!ocupado} onClick={() => void abrir(folio, codigo)}>
          {ocupado === folio ? 'Abriendo…' : 'Abrir expediente'}<ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>;
    })}</div>
  </main>;
}
