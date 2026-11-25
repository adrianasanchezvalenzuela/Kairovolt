import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorPortal, type EstadoPortal } from '@/application/portal-acceso';
import { normalizarFolio } from '@/application/portal-cliente';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { LoadingState } from '@/components/ui/Estados';
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
  if (fase.tipo === 'cargando') return <div className="kvp"><LoadingState variante="pagina" etiqueta="Un momento…" /></div>;

  const enviarForm = (e: FormEvent) => { e.preventDefault(); void enviar(folio, codigo); };

  return (
    <div className="kvp">
      <main className="kvp-acceso" id="contenido">
        <section className="kvp-acceso__marca" aria-labelledby="marca-titulo">
          <div className="kvp-acceso__identidad"><span className="kvp-acceso__sello" aria-hidden="true">K</span><div><strong>KairóVolt</strong><span>IDC Sistemas Eléctricos</span></div></div>
          <div className="kvp-acceso__relato">
            <p className="kvp-acceso__eyebrow">Interconexión, con claridad</p>
            <h1 id="marca-titulo">Tu interconexión<br />empieza aquí.</h1>
            <p className="kvp-acceso__intro">Prepara tu expediente con acompañamiento de IDC y sigue cada avance de tu proyecto en un solo lugar.</p>
          </div>
          <div className="kvp-acceso__grafica" aria-label="Representación de energía solar e infraestructura eléctrica">
            <svg viewBox="0 0 640 330" role="img" aria-labelledby="energia-titulo" xmlns="http://www.w3.org/2000/svg">
              <title id="energia-titulo">Paneles fotovoltaicos conectados a una red eléctrica</title>
              <path d="M0 265h640" stroke="#dce8e9" strokeWidth="2" />
              <circle cx="474" cy="65" r="33" fill="#f2bd55" />
              <path d="M0 236 94 207l93 29v61H0zm191 0 94-29 94 29v61H191z" fill="#e8eff1" />
              <path d="M32 242 90 224l51 16v42H32zm174 0 58-18 52 17v42H206z" fill="#176b70" />
              <path d="M93 226v56m51-41v41m92-58v58m52-43v43M32 263h109m65 0h104" stroke="#b5d1d2" strokeWidth="2" />
              <path d="M381 289V116m0 0-31 39m31-39 31 39m-31-39v-26m-19 48h38m-57 18h76m-86 19h96m-106 20h116m-126 20h136" fill="none" stroke="#102b40" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M381 83c29 0 49 11 64 28m-64-43c39 0 67 15 88 39" fill="none" stroke="#176b70" strokeWidth="3" strokeDasharray="5 8" strokeLinecap="round" />
              <path d="m405 273 33-13 35 13v32h-68z" fill="#102b40" />
              <path d="M420 280h13v25h-13zm20 0h13v12h-13z" fill="#f2bd55" />
              <circle cx="96" cy="115" r="4" fill="#176b70"/><circle cx="157" cy="83" r="3" fill="#f2bd55"/><circle cx="550" cy="157" r="4" fill="#176b70"/>
            </svg>
          </div>
          <ol className="kvp-acceso__pasos" aria-label="Cómo te acompaña KairóVolt">
            <li><span>01</span><div><b>Prepara</b><small>Organiza tu expediente</small></div></li>
            <li><span>02</span><div><b>Valida</b><small>IDC revisa la información</small></div></li>
            <li><span>03</span><div><b>Da seguimiento</b><small>Consulta el avance</small></div></li>
          </ol>
        </section>
        <section className="kvp-acceso__panel" aria-label="Acceso al portal">
          <div className="kvp-acceso__panel-inner">
            <div className="kvp-acceso__privado"><span aria-hidden="true">▣</span> Acceso privado para clientes IDC</div>
            <h2>Bienvenido a tu portal</h2>
            <p id="acceso-ayuda" className="kv-suave">Ingresa el folio y código que recibiste de tu asesor.</p>
            <form onSubmit={enviarForm} aria-describedby="acceso-ayuda">
              <label htmlFor="p-folio">Folio del proyecto</label>
              <input id="p-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="KV-2026-000" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={20} />
              <label htmlFor="p-codigo">Código de acceso</label>
              <input id="p-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={24} style={{ fontFamily: 'var(--kv-mono)' }} />
              {error && <div style={{ marginTop: 14 }}><AlertPanel tono="error">{error}</AlertPanel></div>}
              <button type="submit" className="kvp-boton" disabled={enviando || folio === '' || codigo === ''}>{enviando ? 'Validando acceso…' : 'Entrar a mi expediente'}<span aria-hidden="true">→</span></button>
            </form>
            {estado && !estado.disponible && <div style={{ marginTop: 14 }}><AlertPanel tono="alerta">El portal no está disponible por ahora. Contacta a IDC.</AlertPanel></div>}
            {estado?.demo && estado.codigoDemo && <div className="kvp-demo" role="note"><strong>Modo demostración.</strong> Folio KV-2026-004 · código <code>{estado.codigoDemo}</code>. Son datos de prueba.</div>}
            <p className="kvp-acceso__ayuda">¿No tienes código? Solicítalo a tu contacto en IDC.</p>
            <div className="kvp-acceso__interes"><p className="kvp-acceso__eyebrow">¿Estás por iniciar un proyecto?</p><h3>Conversemos sobre tu instalación.</h3><p>La preevaluación digital estará disponible próximamente. Por ahora, contacta directamente a IDC para iniciar una revisión.</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}
