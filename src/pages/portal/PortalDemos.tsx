import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, ClipboardList, FolderOpen, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
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
      <div>
        <h1>Elige una etapa del recorrido.</h1>
        <p>Explora los tres expedientes ficticios de demostración: captura de datos, preparación documental de 11 requisitos y coordinación de visita a IDC.</p>
      </div>
      <EnergiaPortal />
    </div>
    <p className="kv-cliente-galeria__idc"><Users size={18} aria-hidden="true" /> ¿Quieres ver el otro lado? <Link to="/idc/KV-2026-005">Abrir el panel IDC de demostración</Link> y revisar, cargar o corregir documentos.</p>
    {error && <AlertPanel tono="error">{error}</AlertPanel>}
    <div className="kv-cliente-galeria__casos kv-cliente-galeria__casos--tres">{demosPortal.map(({ folio, codigo, titulo, etapa, descripcion }, i) => {
      const Icono = i === 0 ? ClipboardList : i === 1 ? FolderOpen : CalendarCheck2;
      return <section key={folio}>
        <span className="kv-cliente-etiqueta">{etapa}</span>
        <div className="kv-cliente-galeria__icono"><Icono size={25} aria-hidden="true" /></div>
        <h2>{titulo}</h2>
        <p>{descripcion}</p>
        <dl><dt>Folio</dt><dd>{folio}</dd><dt>Código</dt><dd>{codigo}</dd></dl>
        <button type="button" className="kvp-boton" disabled={!!ocupado} onClick={() => void abrir(folio, codigo)}>
          {ocupado === folio ? 'Abriendo…' : 'Abrir expediente'}<ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>;
    })}</div>
  </main>;
}
