import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorPortal, type EstadoPortal } from '@/application/portal-acceso';
import { normalizarFolio } from '@/application/portal-cliente';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { ArrowRight, ClipboardList, ListChecks, ShieldCheck, Waypoints } from 'lucide-react';
import { CargaPortal, EnergiaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { usePortal } from '@/hooks/PortalContexto';
import { portalRepositorio } from '@/infrastructure';

/** Lee `#folio=…&codigo=…` (enlace que genera IDC). El fragmento no se envía a ningún servidor; se borra de la barra al leerlo. */
function leerFragmento(): { folio: string; codigo: string } | null {
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const folio = p.get('folio');
  const codigo = p.get('codigo');
  return folio && codigo ? { folio, codigo } : null;
}

export function PortalAcceso() {
  const { fase, entrar } = usePortal();
  const [folio, setFolio] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoPortal | null>(null);
  const intentoAuto = useRef(false);

  const enviar = useCallback(async (f: string, c: string) => {
    setEnviando(true);
    setError(null);
    try {
      await entrar(normalizarFolio(f), c.trim());
    } catch (e) {
      setError(e instanceof ErrorPortal ? e.message : 'No se pudo entrar. Intenta de nuevo.');
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }, [entrar]);

  useEffect(() => { void portalRepositorio.estado().then(setEstado).catch(() => undefined); }, []);

  // Enlace de IDC: entra directo y deja limpia la barra de direcciones.
  useEffect(() => {
    if (intentoAuto.current) return;
    const frag = leerFragmento();
    if (!frag) return;
    intentoAuto.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    setFolio(frag.folio);
    void enviar(frag.folio, frag.codigo);
  }, [enviar]);

  if (fase.tipo === 'listo') return <Navigate to="/portal/inicio" replace />;

  if (fase.tipo === 'cargando') return <div className="kvp"><CargaPortal etiqueta="Abriendo el portal…" /></div>;

  const enviarForm = (e: FormEvent) => { e.preventDefault(); void enviar(folio, codigo); };

  return (
    <div className="kvp">
      <main className="kvp-acceso" id="contenido">
        <section className="kvp-acceso__marca" aria-labelledby="marca-titulo">
          <MarcaPortal />
          <div className="kvp-acceso__relato">
            <h1 id="marca-titulo">Tu interconexión<br /> empieza aquí.</h1>
            <p className="kvp-acceso__intro">Prepara tu expediente con acompañamiento de IDC y sigue cada avance de tu proyecto en un solo lugar.</p>
          </div>
          <EnergiaPortal className="kvp-acceso__grafica" />
          <ol className="kvp-acceso__pasos" aria-label="Cómo te acompaña KairóVolt">
            <li><span><ClipboardList size={18} aria-hidden="true" /></span><div><b>Prepara</b><small>Organiza tu expediente</small></div></li>
            <li><span><ListChecks size={18} aria-hidden="true" /></span><div><b>Valida</b><small>IDC revisa la información</small></div></li>
            <li><span><Waypoints size={18} aria-hidden="true" /></span><div><b>Da seguimiento</b><small>Consulta el avance</small></div></li>
          </ol>
        </section>
        <section className="kvp-acceso__panel" aria-label="Acceso al portal">
          <div className="kvp-acceso__panel-inner">
            <div className="kvp-acceso__privado"><ShieldCheck size={16} aria-hidden="true" /> Acceso privado para clientes IDC</div>
            <h2>Bienvenido a tu portal</h2>
            <p id="acceso-ayuda" className="kv-suave">Ingresa el folio y código que recibiste de tu asesor.</p>
            <form onSubmit={enviarForm} aria-describedby="acceso-ayuda">
              <label htmlFor="p-folio">Folio del proyecto</label>
              <input id="p-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="KV-2026-000" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={20} />
              <label htmlFor="p-codigo">Código de acceso</label>
              <input id="p-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={24} style={{ fontFamily: 'var(--kv-mono)' }} />
              {error && <div style={{ marginTop: 14 }}><AlertPanel tono="error">{error}</AlertPanel></div>}
              <button type="submit" className="kvp-boton" disabled={enviando || folio === '' || codigo === ''}>{enviando ? 'Validando acceso…' : 'Entrar a mi expediente'}<ArrowRight size={19} aria-hidden="true" /></button>
            </form>
            {estado && !estado.disponible && <div style={{ marginTop: 14 }}><AlertPanel tono="alerta">El portal no está disponible por ahora. Contacta a IDC.</AlertPanel></div>}
            {estado?.demo && estado.codigoDemo && <div className="kvp-demo" role="note"><strong>Modo demostración.</strong> Folio KV-2026-004 · código <code>{estado.codigoDemo}</code>. Son datos de prueba.</div>}
            <p className="kvp-acceso__ayuda">¿No tienes código? Solicítalo a tu contacto en IDC.</p>
            {import.meta.env.DEV && <p className="kvp-acceso__ayuda"><a href="/demo/portal/demos">Explorar demostraciones</a></p>}
          </div>
        </section>
      </main>
    </div>
  );
}
