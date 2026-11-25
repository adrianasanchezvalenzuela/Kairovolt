import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import type { VersionParticipantes } from '@/application/participantes';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { datosPortal, descargarCartaDemo, historialCartasPortal } from '@/infrastructure/portal-http';

export function CartaDemoPortal() {
  const [version, setVersion] = useState<VersionParticipantes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof historialCartasPortal>>>([]);
  useEffect(() => {
    let vigente = true;
    void datosPortal().then((v) => { if (vigente) setVersion(v); })
      .catch(() => { if (vigente) setError('No se pudieron consultar los datos confirmados.'); })
      .finally(() => { if (vigente) setCargando(false); });
    void historialCartasPortal().then((v) => { if (vigente) setHistorial(v); }).catch(() => {});
    return () => { vigente = false; };
  }, []);

  const datos = version?.datos;
  const persona = datos?.tramita === 'apoderado' ? datos.apoderado : datos?.tramita === 'representante' ? datos.representante : '';
  const disponible = !!(version?.confirmado && datos?.titular && persona);

  async function descargar() {
    setGenerando(true);
    setError('');
    try { await descargarCartaDemo(); setHistorial(await historialCartasPortal()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar la muestra.'); }
    finally { setGenerando(false); }
  }

  return <section className="kv-cliente-superficie">
    <h3><FileText size={17} aria-hidden="true" /> Carta Poder de demostración</h3>
    <p>DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL</p>
    {cargando ? <p role="status">Consultando Mis datos…</p> : disponible ? <>
      <details><summary>Ver datos de la muestra</summary><dl>
        <dt>Titular</dt><dd>{datos?.titular}</dd><dt>{datos?.tramita === 'apoderado' ? 'Apoderado' : 'Representante'}</dt><dd>{persona}</dd>
        <dt>Testigos</dt><dd>{datos?.testigos.join(' · ') || 'Sin captura'}</dd>
      </dl></details>
      <p>Puedes imprimirla para revisar el diseño y los espacios de firma. Solicita a IDC las instrucciones de la plantilla autorizada.</p>
      <button className="kvp-boton" type="button" disabled={generando} onClick={() => void descargar()}>
        <Download size={17} aria-hidden="true" /> {generando ? 'Generando…' : 'Generar y descargar PDF'}
      </button>
    </> : <p>Primero confirma el titular y el representante o apoderado.</p>}
    <p><Link to="/portal/mis-datos">Revisar Mis datos</Link></p>
    {historial.length > 0 && <details><summary>Versiones de demostración</summary><ul>
      {historial.map((r) => <li key={r.href}><a href={r.href} target="_blank" rel="noreferrer">{r.generado_en.slice(0, 10)} · {r.plantilla}</a></li>)}
    </ul></details>}
    {error && <AlertPanel tono="error">{error}</AlertPanel>}
  </section>;
}
