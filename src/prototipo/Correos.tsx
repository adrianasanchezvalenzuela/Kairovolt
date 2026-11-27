import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Users } from 'lucide-react';
import { CLIENTE } from './datos';
import { acciones, useProto } from './store';
import { CintaDemo, fechaCorta } from './ui';

/** Bandeja del cliente simulada: nunca se envía un correo real. */
export function Correos() {
  const s = useProto();
  const [sel, setSel] = useState<string | null>(null);
  const c = s.correos.find((x) => x.id === sel) ?? s.correos[0];
  return <div className="kp kp--correos">
    <CintaDemo />
    <div className="kp-correos">
      <aside className="kp-correos__lista">
        <header><Mail size={18} aria-hidden /><div><strong>Bandeja de {CLIENTE.contacto.split(' ')[0]}</strong><small>{CLIENTE.correo}</small></div></header>
        {s.correos.length === 0 ? <p className="kp-vacio">Aún no hay correos. Haz una acción en el portal o en el panel IDC y aparecerá aquí.</p> :
          <ul>{s.correos.map((m) => <li key={m.id}><button className={(c?.id === m.id ? 'on ' : '') + (m.leido ? '' : 'nuevo')} onClick={() => { setSel(m.id); acciones.leerCorreo(m.id); }}>
            <span className="kp-avisos__punto" /><div><strong>{m.asunto}</strong><small>{fechaCorta(m.fecha)}</small></div>
          </button></li>)}</ul>}
        <p className="kp-suave kp-correos__nota">Simulación: no se envía ningún correo real.</p>
      </aside>
      <section className="kp-correos__lectura">
        {!c ? <div className="kp-correos__vacio"><Mail size={40} aria-hidden /><p>Selecciona un correo para leerlo.</p><Link className="kp-boton kp-boton--suave" to="/prototipo/idc"><Users size={16} aria-hidden /> Ir al panel IDC</Link></div> : <>
          <div className="kp-correos__meta"><h2>{c.asunto}</h2><p><b>De</b> {c.de}</p><p><b>Para</b> {c.para}</p><p><b>Fecha</b> {fechaCorta(c.fecha)}</p></div>
          <article className="kp-mail">
            <div className="kp-mail__cab"><img src="/brand/kairovolt-logo.svg" alt="" width="30" height="30" style={{ borderRadius: 9 }} /><strong>KairóVolt</strong></div>
            <div className="kp-mail__cuerpo">{c.cuerpo.map((p, i) => <p key={i}>{p}</p>)}
              {c.cta && <Link className="kp-boton kp-boton--grande" to="/prototipo/cliente/documentos">{c.cta} <ArrowRight size={16} aria-hidden /></Link>}
            </div>
            <div className="kp-mail__pie">{CLIENTE.folio} · IDC Sistemas Eléctricos · Mensaje de demostración</div>
          </article>
        </>}
      </section>
    </div>
  </div>;
}
