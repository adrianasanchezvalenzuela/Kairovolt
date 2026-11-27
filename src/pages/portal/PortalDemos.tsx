import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Users, type LucideIcon } from 'lucide-react';
import { EnergiaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { DEMOS_VISUAL } from '@/components/portal/demos-visual';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { demosPortal } from '@/data/demos-portal';
import { usePortal } from '@/hooks/PortalContexto';

interface Tarjeta { clave: string; numero: string; Icono: LucideIcon; titulo: string; descripcion: string; fondo: string; texto: string; oscuro: boolean; folio?: string; codigo?: string }

const DESCRIPCIONES = [
  'Captura tus datos y confirma quién tramita.', 'Prepara tus documentos y atiende observaciones.', 'Todo listo: organiza tu entrega física.',
  'CFE respondió: revisa tus contratos.', 'Da seguimiento a la instalación del medidor.', 'Tu sistema ya está interconectado.',
];

/** Selector de los siete escenarios (00–06): cada tarjeta con su número, icono y color. */
export function PortalDemos() {
  const { entrar } = usePortal();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  if (!import.meta.env.DEV || !window.location.pathname.startsWith('/demo/portal/')) return <Navigate to="/" replace />;

  const tarjetas: Tarjeta[] = [
    { clave: 'consulta', numero: '00', Icono: Compass, titulo: 'Consulta de un nuevo proyecto', descripcion: 'Antes de comenzar: consulta inicial, envío, seguimiento y asesoría.', fondo: '#FCFBF8', texto: '#102B40', oscuro: false },
    ...DEMOS_VISUAL.map((d): Tarjeta => ({ clave: d.folio, numero: d.numero, Icono: d.Icono, titulo: d.tarjeta.titulo, descripcion: DESCRIPCIONES[d.indice] ?? d.tarjeta.etapa, fondo: d.tarjeta.fondo, texto: d.tarjeta.texto, oscuro: d.tarjeta.oscuro, folio: demosPortal[d.indice]!.folio, codigo: demosPortal[d.indice]!.codigo })),
  ];

  async function abrir(t: Tarjeta) {
    setError('');
    setOcupado(t.clave);
    try {
      if (!t.folio || !t.codigo) navegar('/portal/consulta');
      else { await entrar(t.folio, t.codigo); navegar('/portal/inicio'); }
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la demostración.');
    } finally { setOcupado(''); }
  }

  return <main className="kvp kv-sel">
    <header className="kv-sel__cab"><MarcaPortal /><span className="kv-cliente-demo">DEMO · {tarjetas.length} escenarios</span></header>
    <div className="kv-sel__hero">
      <div>
        <h1>Elige una etapa del recorrido.</h1>
        <p>Un recorrido de siete escenarios: de la primera consulta a la conexión con la red. Avanza en orden o salta a donde quieras. No necesitas registro: los datos son ficticios.</p>
      </div>
      <EnergiaPortal className="kv-sel__energia" />
    </div>
    <p className="kv-sel__idc"><Users size={18} aria-hidden="true" /> ¿Quieres ver el otro lado? <Link to="/idc/KV-2026-005">Ver perspectiva de IDC</Link></p>
    {error && <AlertPanel tono="error">{error}</AlertPanel>}

    <div className="kv-sel__rejilla">{tarjetas.map((t) => <article key={t.clave} className={'kv-sel__tarjeta' + (t.oscuro ? ' kv-sel__tarjeta--oscura' : '') + (t.clave === 'consulta' ? ' kv-sel__tarjeta--previa' : '')}
      style={{ ['--t-fondo' as string]: t.fondo, ['--t-texto' as string]: t.texto }}>
      <div className="kv-sel__fila"><span className="kv-sel__numero">{t.numero}</span><span className="kv-sel__icono"><t.Icono size={24} aria-hidden="true" /></span></div>
      <h2>{t.titulo}</h2>
      <p className="kv-sel__etapa">{t.descripcion}</p>
      {t.folio && <details className="kv-sel__datos"><summary>Folio y código</summary><dl><dt>Folio</dt><dd>{t.folio}</dd><dt>Código</dt><dd>{t.codigo}</dd></dl></details>}
      <button type="button" className="kv-sel__boton" disabled={!!ocupado} onClick={() => void abrir(t)}>{ocupado === t.clave ? 'Abriendo…' : 'Abrir demo'}<ArrowRight size={17} aria-hidden="true" /></button>
    </article>)}</div>
  </main>;
}
