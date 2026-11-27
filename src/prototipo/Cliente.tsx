import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Check, CircleAlert, Clock3, FileText, MailOpen, Sparkles } from 'lucide-react';
import { CLIENTE, ETAPAS, type Documento } from './datos';
import { acciones, avance, useProto } from './store';
import { HORAS, diasHabiles, ocupado } from './agenda';
import { Cargador, Encabezado, Pastilla, Sol, Visor, diaISO, fechaCorta, fechaLarga } from './ui';

function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

/** El "siguiente paso" cambia según el estado real del expediente de demostración. */
function siguientePaso(s: ReturnType<typeof useProto>) {
  const obs = s.documentos.find((d) => d.estado === 'observado');
  if (obs) return { tono: 'alerta', titulo: `Corrige tu ${obs.corto}`, texto: obs.observacion ?? '', cta: 'Corregir documento', a: '/prototipo/cliente/documentos?abrir=' + obs.id, icono: CircleAlert };
  const pend = s.documentos.find((d) => d.estado === 'pendiente');
  if (pend) return { tono: 'info', titulo: `Sube tu ${pend.corto.toLowerCase()}`, texto: pend.descripcion, cta: 'Subir documento', a: '/prototipo/cliente/documentos?abrir=' + pend.id, icono: FileText };
  if (!s.cita) return { tono: 'ok', titulo: 'Todo listo: agenda tu visita a IDC', texto: 'Tus documentos están completos. Elige el día para entregar el expediente físico.', cta: 'Elegir horario', a: '/prototipo/cliente/cita', icono: CalendarCheck2 };
  if (s.cita.estado === 'solicitada') return { tono: 'info', titulo: 'IDC está confirmando tu cita', texto: `${fechaLarga(s.cita.fecha)} · ${s.cita.hora}`, cta: 'Ver mi cita', a: '/prototipo/cliente/cita', icono: Clock3 };
  return { tono: 'ok', titulo: s.cita.estado === 'reprogramada' ? 'IDC propone un nuevo horario' : 'Tu cita está confirmada', texto: `${fechaLarga(s.cita.fecha)} · ${s.cita.hora}`, cta: 'Ver mi cita', a: '/prototipo/cliente/cita', icono: CalendarCheck2 };
}

export function Inicio() {
  const s = useProto();
  const av = avance(s);
  const paso = siguientePaso(s);
  const I = paso.icono;
  return <div className="kp-pagina">
    <Encabezado kicker={fechaLarga(new Date().toISOString())} titulo={<>{saludo()}, <em>{CLIENTE.contacto.split(' ')[0]}</em>.</>}>
      Tu sistema de {CLIENTE.sistema.split(' · ')[0]} va tomando forma. Esto es lo que sigue.
    </Encabezado>

    <section className="kp-heroe">
      <Sol pct={av.pct} etiqueta={`${av.ok} de ${av.total} documentos aceptados`} />
      <div className={'kp-paso kp-paso--' + paso.tono}>
        <span className="kp-kicker"><I size={15} aria-hidden /> Tu siguiente paso</span>
        <h2>{paso.titulo}</h2>
        <p>{paso.texto}</p>
        <Link to={paso.a} className="kp-boton kp-boton--grande">{paso.cta} <ArrowRight size={18} aria-hidden /></Link>
      </div>
    </section>

    <section className="kp-ruta" aria-label="Etapas del expediente">
      {ETAPAS.map((e, i) => {
        const docs = s.documentos.filter((d) => d.etapa === e.id);
        const ok = docs.filter((d) => d.estado === 'aceptado').length;
        const hecho = docs.length > 0 && ok === docs.length;
        return <Link key={e.id} to="/prototipo/cliente/documentos" className={'kp-etapa' + (hecho ? ' kp-etapa--hecha' : '')}>
          <span className="kp-etapa__n">{hecho ? <Check size={16} aria-hidden /> : i + 1}</span>
          <strong>{e.nombre}</strong><small>{e.frase}</small>
          <span className="kp-puntos" aria-label={`${ok} de ${docs.length}`}>{docs.map((d) => <i key={d.id} className={'kp-punto kp-punto--' + d.estado} title={d.corto} />)}</span>
        </Link>;
      })}
    </section>

    <div className="kp-dos">
      <section>
        <h3 className="kp-h3">Lo último que pasó</h3>
        <ol className="kp-linea kp-linea--corta">
          {s.eventos.slice(0, 4).map((e) => <li key={e.id} className={'kp-linea__item kp-linea__item--' + e.tono}>
            <time>{fechaCorta(e.fecha)}</time><strong>{e.titulo}</strong><p>{e.detalle}</p>
          </li>)}
        </ol>
        <Link className="kp-enlace" to="/prototipo/cliente/historial">Ver todo el historial <ArrowRight size={15} aria-hidden /></Link>
      </section>
      <aside className="kp-nota-equipo">
        <Sparkles size={18} aria-hidden />
        <p>«Vas muy bien. Con la Carta Poder corregida y las fichas técnicas, cerramos el expediente esta semana.»</p>
        <span>{CLIENTE.coordinadora} · coordinación IDC</span>
      </aside>
    </div>
  </div>;
}

export function Documentos() {
  const s = useProto();
  const [abierto, setAbierto] = useState<string | null>(() => new URLSearchParams(window.location.search).get('abrir'));
  const [gracias, setGracias] = useState('');
  const doc = s.documentos.find((d) => d.id === abierto);

  function enviar(d: Documento, archivo: string) {
    acciones.subir(d.id, archivo);
    setGracias(d.estado === 'observado' ? `Corrección enviada: ${d.corto} pasó a la versión ${d.versiones.length + 1}.` : `${d.corto} enviado. IDC lo revisará pronto.`);
    setAbierto(null);
    setTimeout(() => setGracias(''), 5000);
  }

  return <div className="kp-pagina">
    <Encabezado kicker="11 requisitos · media tensión" titulo={<>Tus <em>documentos</em></>}>Abre cualquiera para ver la vista previa, descargarlo o subir una nueva versión.</Encabezado>
    {gracias && <div className="kp-toast" role="status"><Check size={18} aria-hidden /> {gracias}</div>}
    {ETAPAS.map((e) => {
      const docs = s.documentos.filter((d) => d.etapa === e.id);
      return <section key={e.id} className="kp-grupo">
        <h3><span>{e.id}</span>{e.nombre}<small>{e.frase}</small></h3>
        <ul className="kp-docs">
          {docs.map((d) => <li key={d.id}>
            <button className={'kp-doc kp-doc--' + d.estado} onClick={() => setAbierto(d.id)}>
              <span className="kp-doc__icono"><FileText size={20} aria-hidden /></span>
              <span className="kp-doc__texto"><strong>{d.nombre}</strong><small>{d.estado === 'observado' ? d.observacion : d.descripcion}</small></span>
              <span className="kp-doc__meta">{d.versiones.length > 0 && <em>v{d.versiones.length}</em>}<Pastilla estado={d.estado} /></span>
            </button>
          </li>)}
        </ul>
      </section>;
    })}
    {doc && <Visor doc={doc} version={Math.max(1, doc.versiones.length)} onClose={() => setAbierto(null)}>
      {doc.estado === 'observado' && <div className="kp-aviso kp-aviso--alerta"><CircleAlert size={18} aria-hidden /><div><strong>Observación de IDC</strong><p>{doc.observacion}</p></div></div>}
      {doc.estado === 'en_revision' && <div className="kp-aviso kp-aviso--info"><Clock3 size={18} aria-hidden /><div><strong>En revisión</strong><p>IDC lo está revisando. Puedes reemplazarlo si encontraste un error.</p></div></div>}
      {doc.estado === 'aceptado' && <div className="kp-aviso kp-aviso--ok"><Check size={18} aria-hidden /><div><strong>Aceptado por IDC</strong><p>No necesitas hacer nada más.</p></div></div>}
      {doc.fisico && <p className="kp-suave kp-fisico">📎 Este documento también se entrega en papel (original y copia) el día de tu cita.</p>}
      {doc.estado !== 'aceptado' && <Cargador etiqueta={doc.estado === 'observado' ? 'Sube la versión corregida' : doc.versiones.length ? 'Reemplazar archivo' : 'Sube tu documento'} onArchivo={(n) => enviar(doc, n)} />}
      <h4 className="kp-h4">Versiones</h4>
      {doc.versiones.length === 0 ? <p className="kp-suave">Aún no has subido nada.</p> :
        <ul className="kp-versiones">{[...doc.versiones].reverse().map((v) => <li key={v.n}><b>v{v.n}</b><span>{v.archivo}</span><time>{fechaCorta(v.fecha)}</time></li>)}</ul>}
    </Visor>}
  </div>;
}

export function Cita() {
  const s = useProto();
  const nav = useNavigate();
  const dias = useMemo(() => diasHabiles(6), []);
  const [fecha, setFecha] = useState(dias[0] ?? '');
  const [hora, setHora] = useState('');
  const [nota, setNota] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const cita = s.cita;
  const fisicos = s.documentos.filter((d) => d.fisico);
  const pasos = ['Solicitada', 'Confirmada por IDC', 'Visita'];
  const paso = !cita ? -1 : cita.estado === 'solicitada' ? 0 : 1;

  if (cita && !cambiando) return <div className="kp-pagina">
    <Encabezado kicker="Entrega física del expediente" titulo={cita.estado === 'confirmada' ? <>Tu cita está <em>confirmada</em></> : cita.estado === 'reprogramada' ? <>IDC propone <em>otro horario</em></> : <>Solicitud <em>enviada</em></>}>
      {cita.estado === 'solicitada' ? 'Una persona de IDC la confirmará. Esta pantalla se actualiza sola.' : `Te recibe ${CLIENTE.coordinadora} en la oficina de IDC, Hermosillo.`}
    </Encabezado>
    <ol className="kp-pasos">{pasos.map((p, i) => <li key={p} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''}><span>{i < paso ? <Check size={14} /> : i + 1}</span>{p}</li>)}</ol>
    <section className={'kp-boleto kp-boleto--' + cita.estado}>
      <div className="kp-boleto__dia"><small>{new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(cita.fecha + 'T12:00:00'))}</small><strong>{cita.fecha.slice(8)}</strong></div>
      <div><h2>{fechaLarga(cita.fecha)}</h2><p>{cita.hora} · hora de Hermosillo</p><code>{cita.id}</code></div>
      <div className="kp-boleto__acc"><Pastilla estado={cita.estado === 'solicitada' ? 'en_revision' : 'aceptado'} /><button className="kp-boton kp-boton--suave" onClick={() => setCambiando(true)}>Elegir otro horario</button></div>
    </section>
    <h3 className="kp-h3">Lleva contigo</h3>
    <ul className="kp-lista-fisica">{fisicos.map((d) => <li key={d.id}><Check size={16} aria-hidden /> <span><strong>{d.nombre}</strong><small>Original y una copia</small></span></li>)}<li><Check size={16} aria-hidden /> <span><strong>Identificación oficial</strong><small>La de quien firma</small></span></li></ul>
    {cita.estado === 'solicitada' && <p className="kp-suave kp-sugerencia">Mientras tanto, cambia a <Link to="/prototipo/idc/agenda">Panel IDC → Agenda</Link> para confirmarla y ver cómo se refleja aquí.</p>}
    {cita.estado === 'confirmada' && <Link className="kp-enlace" to="/prototipo/correos"><MailOpen size={15} aria-hidden /> Ver el correo de confirmación</Link>}
  </div>;

  return <div className="kp-pagina">
    <Encabezado kicker="Entrega física del expediente" titulo={<>Elige cuándo <em>visitarnos</em></>}>Seleccionamos horarios de la oficina de IDC en Hermosillo. Duración aproximada: 30 minutos.</Encabezado>
    <div className="kp-selector">
      <div className="kp-dias" role="radiogroup" aria-label="Día">
        {dias.map((d) => {
          const f = new Date(d + 'T12:00:00');
          return <button key={d} role="radio" aria-checked={fecha === d} className={fecha === d ? 'on' : ''} onClick={() => { setFecha(d); setHora(''); }}>
            <small>{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(f)}</small><strong>{f.getDate()}</strong><small>{new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(f)}</small>
          </button>;
        })}
      </div>
      <div className="kp-horas" role="radiogroup" aria-label="Hora">
        {HORAS.map((h) => { const no = ocupado(fecha, h); return <button key={h} role="radio" aria-checked={hora === h} disabled={no} className={hora === h ? 'on' : ''} onClick={() => setHora(h)}>{h}{no && <small>ocupado</small>}</button>; })}
      </div>
      <label className="kp-campo">Nota para IDC <span>(opcional)</span>
        <textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Llegaré con mi ingeniero de obra." />
      </label>
      <div className="kp-selector__pie">
        <p className="kp-suave">{hora ? <>Seleccionaste <b>{fechaLarga(fecha)}, {hora}</b>.</> : 'Selecciona un día y una hora.'}</p>
        <div>
          {cita && <button className="kp-boton kp-boton--suave" onClick={() => setCambiando(false)}>Cancelar cambio</button>}
          <button className="kp-boton kp-boton--grande" disabled={!hora} onClick={() => { acciones.solicitarCita(diaISO(new Date(fecha + 'T12:00:00')), hora, nota); setCambiando(false); nav('/prototipo/cliente/cita'); }}>Solicitar cita <ArrowRight size={18} aria-hidden /></button>
        </div>
      </div>
    </div>
  </div>;
}

export function Avisos() {
  const s = useProto();
  const nav = useNavigate();
  return <div className="kp-pagina kp-pagina--angosta">
    <Encabezado kicker="Notificaciones" titulo={<>Tus <em>avisos</em></>}>Cada movimiento de IDC aparece aquí y, además, llega a tu correo.</Encabezado>
    <ul className="kp-avisos">
      {s.avisos.map((a) => <li key={a.id} className={a.leido ? '' : 'nuevo'}>
        <span className="kp-avisos__punto" aria-label={a.leido ? 'Leído' : 'Nuevo'} />
        <div><strong>{a.titulo}</strong><p>{a.cuerpo}</p><time>{fechaCorta(a.fecha)}</time></div>
        <div className="kp-avisos__acc">
          {a.accion && <button className="kp-boton" onClick={() => { acciones.leerAviso(a.id); nav('/prototipo/cliente/' + a.ruta); }}>{a.accion}</button>}
          {!a.leido && <button className="kp-boton kp-boton--texto" onClick={() => acciones.leerAviso(a.id)}>Marcar leído</button>}
        </div>
      </li>)}
    </ul>
  </div>;
}

export function Historial() {
  const s = useProto();
  return <div className="kp-pagina kp-pagina--angosta">
    <Encabezado kicker="Bitácora" titulo={<>Historial del <em>expediente</em></>}>Todo lo que ha ocurrido, de lo más reciente a lo más antiguo.</Encabezado>
    <ol className="kp-linea">
      {s.eventos.map((e) => <li key={e.id} className={'kp-linea__item kp-linea__item--' + e.tono}>
        <time>{fechaCorta(e.fecha)} · {e.quien === 'cliente' ? 'Tú' : e.quien === 'idc' ? 'IDC' : 'Sistema'}</time><strong>{e.titulo}</strong><p>{e.detalle}</p>
      </li>)}
    </ol>
  </div>;
}
