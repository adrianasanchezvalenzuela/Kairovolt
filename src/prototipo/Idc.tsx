import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, CircleAlert, FileSearch, MessageSquareWarning, Send } from 'lucide-react';
import { CLIENTE } from './datos';
import { acciones, avance, useProto } from './store';
import { HORAS, diasHabiles, ocupado, quienOcupa } from './agenda';
import { Encabezado, Pastilla, Visor, fechaCorta, fechaLarga } from './ui';

export function Mesa() {
  const s = useProto();
  const av = avance(s);
  const revisar = s.documentos.filter((d) => d.estado === 'en_revision');
  const observados = s.documentos.filter((d) => d.estado === 'observado');
  const citaPend = s.cita?.estado === 'solicitada';
  const cola = revisar.length + (citaPend ? 1 : 0);
  return <div className="kp-pagina">
    <Encabezado kicker="Panel administrativo · IDC" titulo={<>Mesa de <em>revisión</em></>}>
      {cola === 0 ? 'Todo al día. Buen trabajo.' : `${cola} ${cola === 1 ? 'asunto espera' : 'asuntos esperan'} una decisión de tu equipo.`}
    </Encabezado>

    <section className="kp-cifras">
      <div><strong>{revisar.length}</strong><span>documentos por revisar</span></div>
      <div className="kp-cifras--alerta"><strong>{observados.length}</strong><span>esperan corrección del cliente</span></div>
      <div className="kp-cifras--cita"><strong>{citaPend ? 1 : 0}</strong><span>cita por confirmar</span></div>
      <div className="kp-cifras--avance"><strong>{av.pct}<sup>%</sup></strong><span>avance del expediente</span></div>
    </section>

    <h3 className="kp-h3">Fila de trabajo</h3>
    {cola === 0 ? <p className="kp-vacio">No hay nada pendiente. Cuando el cliente suba un documento o solicite una cita aparecerá aquí.</p> :
      <ul className="kp-fila">
        {citaPend && s.cita && <li><span className="kp-fila__ico kp-fila__ico--cita"><CalendarClock size={20} aria-hidden /></span>
          <div><strong>Cita por confirmar · {fechaLarga(s.cita.fecha)}, {s.cita.hora}</strong><small>{CLIENTE.titular}{s.cita.nota ? ` — «${s.cita.nota}»` : ''}</small></div>
          <Link className="kp-boton" to="/prototipo/idc/agenda">Abrir agenda <ArrowRight size={16} aria-hidden /></Link></li>}
        {revisar.map((d) => <li key={d.id}><span className="kp-fila__ico"><FileSearch size={20} aria-hidden /></span>
          <div><strong>{d.nombre} · v{d.versiones.length}</strong><small>{CLIENTE.titular} · {d.versiones.at(-1) && fechaCorta(d.versiones.at(-1)!.fecha)}</small></div>
          <Link className="kp-boton" to={'/prototipo/idc/expediente?abrir=' + d.id}>Revisar <ArrowRight size={16} aria-hidden /></Link></li>)}
      </ul>}

    <h3 className="kp-h3">Expediente en curso</h3>
    <Link to="/prototipo/idc/expediente" className="kp-tarjeta-exp">
      <div><span className="kp-kicker">{CLIENTE.folio}</span><h2>{CLIENTE.titular}</h2><p>{CLIENTE.sitio}</p><p className="kp-suave">{CLIENTE.sistema}</p></div>
      <div className="kp-barra-av" aria-label={`${av.pct}%`}><i style={{ width: av.pct + '%' }} /></div>
      <small>{av.ok} aceptados · {av.rev} en revisión · {observados.length} con observación · {s.documentos.length - av.ok - av.rev - observados.length} por subir</small>
    </Link>
  </div>;
}

const FRASES = ['Falta firma o sello.', 'El archivo está borroso o cortado.', 'Los datos no coinciden con el recibo CFE.', 'Documento vencido: necesitamos uno reciente.'];

export function Expediente() {
  const s = useProto();
  const [abierto, setAbierto] = useState<string | null>(() => new URLSearchParams(window.location.search).get('abrir'));
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState('');
  const doc = s.documentos.find((d) => d.id === abierto);
  const cerrar = () => { setAbierto(null); setTexto(''); };
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4500); };

  return <div className="kp-pagina">
    <Encabezado kicker={CLIENTE.folio} titulo={<>{CLIENTE.titular}</>}>{CLIENTE.sitio} · {CLIENTE.sistema}</Encabezado>
    {msg && <div className="kp-toast" role="status"><Check size={18} aria-hidden /> {msg}</div>}
    <div className="kp-tabla" role="table" aria-label="Documentos del expediente">
      <div className="kp-tabla__cab" role="row"><span>Documento</span><span>Etapa</span><span>Versión</span><span>Estado</span><span /></div>
      {s.documentos.map((d) => <div className="kp-tabla__fila" role="row" key={d.id}>
        <span><strong>{d.nombre}</strong>{d.estado === 'observado' && <small>Observación enviada al cliente</small>}</span>
        <span>{d.etapa}</span>
        <span>{d.versiones.length ? 'v' + d.versiones.length : '—'}</span>
        <span><Pastilla estado={d.estado} /></span>
        <span>{d.versiones.length > 0 ? <button className={'kp-boton' + (d.estado === 'en_revision' ? '' : ' kp-boton--suave')} onClick={() => setAbierto(d.id)}>{d.estado === 'en_revision' ? 'Revisar' : 'Abrir'}</button> : <small className="kp-suave">Sin archivo</small>}</span>
      </div>)}
    </div>
    {doc && <Visor doc={doc} version={Math.max(1, doc.versiones.length)} onClose={cerrar}>
      <h4 className="kp-h4 kp-h4--primero">Decisión de revisión</h4>
      {doc.estado === 'aceptado' ? <div className="kp-aviso kp-aviso--ok"><Check size={18} aria-hidden /><div><strong>Ya aceptado</strong><p>Puedes dejar una observación si encuentras algo.</p></div></div> : null}
      {doc.estado === 'observado' && <div className="kp-aviso kp-aviso--alerta"><CircleAlert size={18} aria-hidden /><div><strong>Observación pendiente del cliente</strong><p>{doc.observacion}</p></div></div>}
      <div className="kp-chips">{FRASES.map((f) => <button key={f} onClick={() => setTexto((t) => (t ? t + ' ' : '') + f)}>{f}</button>)}</div>
      <label className="kp-campo">Observación visible para el cliente
        <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe con claridad qué debe corregir y cómo." />
      </label>
      <div className="kp-visor__botones">
        <button className="kp-boton kp-boton--grande" disabled={!texto.trim()} onClick={() => { acciones.observar(doc.id, texto.trim()); flash(`Observación enviada. El cliente la verá en Avisos y en su correo.`); cerrar(); }}><MessageSquareWarning size={18} aria-hidden /> Enviar observación</button>
        {doc.estado !== 'aceptado' && <button className="kp-boton kp-boton--ok kp-boton--grande" onClick={() => { acciones.aceptar(doc.id); flash(`${doc.corto} aceptado y cliente notificado.`); cerrar(); }}><Check size={18} aria-hidden /> Aceptar documento</button>}
      </div>
      <p className="kp-suave kp-fisico">Al decidir se actualizan el portal del cliente, su historial y se genera un correo simulado.</p>
    </Visor>}
  </div>;
}

export function Agenda() {
  const s = useProto();
  const dias = useMemo(() => diasHabiles(5), []);
  const cita = s.cita;
  const [prop, setProp] = useState<{ f: string; h: string } | null>(null);
  const mia = (f: string, h: string) => cita && cita.fecha === f && cita.hora === h;

  return <div className="kp-pagina">
    <Encabezado kicker="Oficina IDC · Hermosillo" titulo={<>Agenda de <em>citas</em></>}>Semana próxima. Las celdas grises son citas de otros clientes (ficticias).</Encabezado>
    <div className="kp-agenda-capa">
      <div className="kp-agenda" role="grid" aria-label="Agenda semanal">
        <div className="kp-agenda__cab"><span />{dias.map((d) => <span key={d}><small>{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(new Date(d + 'T12:00:00'))}</small><b>{d.slice(8)}</b></span>)}</div>
        {HORAS.map((h) => <div className="kp-agenda__fila" key={h}>
          <span className="kp-agenda__hora">{h}</span>
          {dias.map((d) => {
            const otra = ocupado(d, h) && !mia(d, h);
            const p = prop?.f === d && prop.h === h;
            return <button key={d} className={'kp-celda' + (mia(d, h) ? ' kp-celda--mia kp-celda--' + cita!.estado : '') + (otra ? ' kp-celda--otra' : '') + (p ? ' kp-celda--prop' : '')}
              disabled={otra || !cita || cita.estado === 'confirmada' && !!mia(d, h)} onClick={() => setProp(p ? null : { f: d, h })}
              title={otra ? quienOcupa(d, h) : mia(d, h) ? CLIENTE.titular : 'Libre'}>
              {mia(d, h) ? <><b>{(CLIENTE.titular.split(',')[0] ?? '').split(' ').slice(0, 2).join(' ')}</b><small>{cita!.estado === 'solicitada' ? 'por confirmar' : cita!.estado}</small></> : otra ? <small>{quienOcupa(d, h)}</small> : p ? <small>propuesta</small> : null}
            </button>;
          })}
        </div>)}
      </div>

      <aside className="kp-panel-cita">
        {!cita ? <><h3>Sin solicitudes</h3><p className="kp-suave">Cuando el cliente solicite una cita desde su portal, aparecerá marcada en la agenda.</p><Link className="kp-boton kp-boton--suave" to="/prototipo/cliente/cita">Simular solicitud como cliente</Link></> : <>
          <span className="kp-kicker">{cita.id}</span>
          <h3>{CLIENTE.titular}</h3>
          <p>{fechaLarga(cita.fecha)} · {cita.hora}</p>
          <p><Pastilla estado={cita.estado === 'solicitada' ? 'en_revision' : 'aceptado'} /> <span className="kp-suave">{cita.estado}</span></p>
          {cita.nota && <blockquote>«{cita.nota}»</blockquote>}
          {cita.estado !== 'confirmada' && <button className="kp-boton kp-boton--ok kp-boton--grande" onClick={() => acciones.confirmarCita()}><Check size={18} aria-hidden /> Confirmar este horario</button>}
          {cita.estado === 'confirmada' && <div className="kp-aviso kp-aviso--ok"><Check size={18} aria-hidden /><div><strong>Confirmada</strong><p>El cliente ya lo ve en su portal y recibió correo.</p></div></div>}
          <hr />
          <h4 className="kp-h4 kp-h4--primero">Proponer otro horario</h4>
          <p className="kp-suave">{prop ? <>Seleccionado: <b>{prop.f.slice(8)}/{prop.f.slice(5, 7)} · {prop.h}</b></> : 'Elige una celda libre en la agenda.'}</p>
          <button className="kp-boton kp-boton--suave" disabled={!prop} onClick={() => { if (prop) { acciones.reprogramarCita(prop.f, prop.h); setProp(null); } }}><Send size={16} aria-hidden /> Enviar propuesta</button>
        </>}
      </aside>
    </div>
  </div>;
}
