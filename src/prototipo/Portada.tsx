import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, House, Mail } from 'lucide-react';
import { EnergiaPortal, MarcaPortal } from '@/components/portal/DisenoPortal';
import { CintaDemo } from './ui';

const recorrido = [
  ['1', 'Cliente', 'Mariana ve que su Carta Poder tiene una observación y sube la corrección (v2).'],
  ['2', 'Panel IDC', 'El equipo revisa la nueva versión, la acepta y deja un comentario.'],
  ['3', 'Cliente', 'Con todo en orden, solicita su cita de entrega física.'],
  ['4', 'Panel IDC', 'Coordinación confirma el horario desde la agenda.'],
  ['5', 'Correos', 'Cada paso generó un correo simulado y un aviso en el portal.'],
];

export function Portada() {
  return <div className="kp kp--portada">
    <CintaDemo />
    <main className="kp-portada">
      <header><MarcaPortal /></header>
      <section className="kp-portada__heroe">
        <div>
          <span className="kp-kicker">Prototipo interactivo</span>
          <h1>Del primer documento a la <em>cita de entrega</em>.</h1>
          <p>Un expediente de interconexión fotovoltaica de media tensión, vivido desde los dos lados: el cliente que lo arma y el equipo de IDC que lo revisa.</p>
          <div className="kp-portada__botones">
            <Link className="kp-boton kp-boton--grande" to="/prototipo/cliente"><House size={18} aria-hidden /> Entrar como cliente <ArrowRight size={18} aria-hidden /></Link>
            <Link className="kp-boton kp-boton--grande kp-boton--suave" to="/prototipo/idc"><ClipboardCheck size={18} aria-hidden /> Entrar al panel IDC</Link>
            <Link className="kp-boton kp-boton--texto" to="/prototipo/correos"><Mail size={16} aria-hidden /> Ver correos simulados</Link>
          </div>
        </div>
        <EnergiaPortal className="kp-portada__arte" />
      </section>
      <section className="kp-portada__guion">
        <h2>Recorrido sugerido para la demostración</h2>
        <ol>{recorrido.map(([n, quien, t]) => <li key={n}><span>{n}</span><b>{quien}</b><p>{t}</p></li>)}</ol>
        <p className="kp-suave">Todo son datos ficticios y viven solo en este navegador. No se escribe en Supabase ni en Zoho, ni se envían correos reales.</p>
      </section>
    </main>
  </div>;
}
