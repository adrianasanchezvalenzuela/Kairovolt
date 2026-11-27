import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Bell, CalendarCheck2, Check, CircleAlert, CircleDashed, Clock3, Download, FileSignature, FileText, FolderOpen, Gauge, History, Lock, Maximize2, Send, Star,
} from 'lucide-react';
import { Dialogo } from '@/components/ui/Dialogo';
import { DEMOS_VISUAL, HeroDemo, visualDeFolio } from '@/components/portal/demos-visual';
import { IlustracionMedidor } from '@/components/portal/IlustracionesTramite';
import { VisorDocumento } from '@/components/portal/VisorDocumento';
import { PortadaPortal } from '@/components/portal/DisenoPortal';
import { cfe, type ArchivoDemo } from '@/demo/archivos-demo';
import { LEYENDA_DEMO } from '@/demo/expediente-demo';
import { descargarExpedienteCompleto, documentosExpedienteFinal, registroInstalacionPdf, type DocFinal } from '@/demo/pdf-tramite';
import {
  accionesTramite, CHECKLIST_INSTALACION, ESCENARIO, ETAPAS_RECORRIDO, hitosTramite, instalacionHabilitada, progresoTramite,
  useTramiteDemo, type ClaveContrato, type TramiteDemo,
} from '@/demo/tramite-demo';
import { useVistaPortal } from '@/hooks/PortalContexto';

const fecha = (iso?: string) => iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Hermosillo' }).format(new Date(iso.length === 10 ? iso + 'T12:00:00-07:00' : iso)) : '—';
const corta = (iso?: string) => iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Hermosillo' }).format(new Date(iso.length === 10 ? iso + 'T12:00:00-07:00' : iso)) : '—';
function useTramite() { const v = useVistaPortal(); const t = useTramiteDemo(v.folio); return { v, t, folio: v.folio }; }
const Pill = ({ tono, children }: { tono: 'ok' | 'info' | 'alerta' | 'neutro'; children: ReactNode }) => <span className={'kv-gr-pill kv-gr-pill--' + tono}>{children}</span>;

// ───────────────────────── Inicio ─────────────────────────
export function InicioTramite() {
  const { v, t, folio } = useTramite();
  const visual = visualDeFolio(folio) ?? DEMOS_VISUAL[3]!;
  const h = hitosTramite(t, folio);
  const p = progresoTramite(h);
  const inst = t.instalacion;
  const [visor, setVisor] = useState<'oficio' | null>(null);
  const [preparar, setPreparar] = useState(false);
  const etapasCompletas = ETAPAS_RECORRIDO.filter((e) => h.filter((x) => x.etapa === e.n).every((x) => x.hecho)).length;
  const ultimo = t.eventos[0];
  const oficio: ArchivoDemo = { etiqueta: 'Oficio resolutivo favorable (demostración)', ruta: cfe('resolucion-favorable.pdf') };

  const contratosMini = <div className="kv-tr-mini">{(['interconexion', 'contraprestacion'] as const).map((k) => {
    const c = t.contratos[k];
    return <Link key={k} to="/portal/contratos"><strong><FileSignature size={16} aria-hidden="true" /> {k === 'interconexion' ? 'Contrato de interconexión' : 'Contrato de contraprestación'}</strong>
      <small>{k === 'interconexion' ? 'CFE Distribución' : 'CFE Suministrador'}</small>
      <Pill tono={c.estado === 'formalizado' ? 'ok' : c.estado === 'disponible' ? 'alerta' : 'neutro'}>{c.estado === 'formalizado' ? 'Formalizado' : c.estado === 'disponible' ? 'Disponible para firma' : 'Por publicar'}</Pill></Link>;
  })}</div>;

  // ── Demo 4 · solicitud aprobada ──
  if (visual.momento === 'aprobada') return <div className="kv-tr">
    <HeroDemo visual={visual}
      acciones={<><Link to="/portal/contratos" className="kvp-boton">Revisar mis contratos <ArrowRight size={17} aria-hidden="true" /></Link>
        <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setVisor('oficio')}><FileText size={16} aria-hidden="true" /> Ver el oficio</button></>}
      banda={<><BadgeCheck size={18} aria-hidden="true" /> Resolución favorable registrada por IDC <span className="kv-mono">{t.numeroSolicitud} · {fecha(t.resolucion?.fecha)}</span></>} />
    <section className="kv-tr-res"><span className="kv-cliente-etiqueta">Resolución de CFE</span><h2>Resolución favorable</h2>
      <dl className="kv-tr-seg"><dt>Número de solicitud (ficticio)</dt><dd className="kv-mono">{t.numeroSolicitud}</dd><dt>Ingreso ante CFE</dt><dd>{fecha(t.ingresoCfe)}</dd><dt>Resolución</dt><dd>{fecha(t.resolucion?.fecha)}</dd><dt>Estado</dt><dd><Pill tono="ok">Favorable</Pill></dd><dt>Última actualización de IDC</dt><dd>{ultimo ? `${ultimo.titulo} · ${corta(ultimo.fecha)}` : '—'}</dd></dl>
      <div className="kv-tr-botones"><button type="button" className="kvp-boton" onClick={() => setVisor('oficio')}><Maximize2 size={16} aria-hidden="true" /> Ver oficio (PDF de demostración)</button>
        <a className="kvp-boton kvp-boton--suave" href={oficio.ruta} download="oficio-resolutivo-demostracion.pdf"><Download size={16} aria-hidden="true" /> Descargar</a></div></section>
    <section><h2>Tus contratos</h2><p className="kv-suave">Dos contratos formalizan tu interconexión. Revísalos y prepárate para la firma.</p>{contratosMini}</section>
    <section className="kv-cliente-accion kv-tr-accion"><span className="kv-cliente-etiqueta">Tu próxima acción</span><h2>Es momento de firmar.</h2><p>Consulta los contratos necesarios para continuar con tu interconexión. IDC coordina la formalización contigo.</p><Link to="/portal/contratos" className="kvp-boton">Revisar mis contratos <ArrowRight size={17} aria-hidden="true" /></Link></section>
    <div className="kv-tr-mini"><Link to="/portal/historial"><strong><History size={16} aria-hidden="true" /> Historial del trámite</strong><small>Cada paso, con fecha y responsable</small></Link>
      <Link to="/portal/documentos"><strong><FolderOpen size={16} aria-hidden="true" /> Expediente validado</strong><small>Tus 11 documentos, ya revisados</small></Link></div>
    {visor && <VisorDocumento onCerrar={() => setVisor(null)} datos={{ titulo: oficio.etiqueta, estado: 'Resolución favorable', responsable: 'CFE · registrado por IDC', cargadoEn: t.resolucion?.fecha, archivos: [oficio] }} />}
    <p className="kv-cliente-legal">{LEYENDA_DEMO}.</p>
  </div>;

  // ── Demo 5 · instalación del medidor ──
  if (visual.momento === 'medidor') {
    const prog = inst.estado === 'programada' || inst.estado === 'reprogramada';
    return <div className="kv-tr">
      <HeroDemo visual={visual}
        acciones={<button type="button" className="kvp-boton" onClick={() => setPreparar(true)}><Gauge size={17} aria-hidden="true" /> Prepararme para la instalación</button>} />
      <section className="kv-tr-inst kv-tr-inst--sola" aria-label="Tu próxima instalación">
        <div className="kv-tr-inst__txt">
          <span className="kv-cliente-etiqueta">Tu próxima instalación</span>
          {prog && inst.programada ? <>
            <TarjetaFecha fechaIso={inst.programada.fecha} franja={inst.programada.franja} mes="DIC" />
            <dl className="kv-tr-seg"><dt>Visita</dt><dd>{ESCENARIO.tipoVisita}</dd><dt>Horario</dt><dd>{inst.programada.franja.replace('–', '–').replace(' ', ' ')} h</dd><dt>Lugar</dt><dd>{v.ubicacion || 'Hermosillo, Sonora'}</dd>
              <dt>Confirmación</dt><dd><Pill tono="ok">Fecha confirmada · Simulación</Pill></dd><dt>Responsable</dt><dd>{ESCENARIO.instalacionPor} · seguimiento {ESCENARIO.seguimientoPor}</dd></dl>
            {inst.estado === 'reprogramada' && <p className="kv-tr-reprog">CFE reprogramó la visita. Detalles en <Link to="/portal/instalacion">Mi instalación</Link>.</p>}</>
            : inst.estado === 'instalada' ? <><h2>Tu medidor ya está instalado.</h2><p>Medidor {inst.medidor?.numero} · {fecha(inst.medidor?.fecha)}. Falta confirmar la interconexión física.</p></>
              : <><h2>CFE aún no confirma la fecha.</h2><p>IDC mantiene el seguimiento. No necesitas hacer nada por ahora.</p></>}
          <p className="kv-suave"><CircleAlert size={15} aria-hidden="true" /> Esta es una <strong>visita de instalación programada por CFE</strong>. No es la cita de entrega física con IDC (esa está en Mi visita).</p>
          <div className="kv-tr-botones"><Link to="/portal/instalacion" className="kvp-boton kvp-boton--suave">Ver mi instalación <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </div>
      </section>
      <section className="kv-tr-estados"><h2>Dónde vas</h2><ul>
        <li data-ok><Check size={17} aria-hidden="true" /> Resolución favorable completada</li><li data-ok><Check size={17} aria-hidden="true" /> Contratos de interconexión y contraprestación formalizados</li>
        <li data-ok={prog || inst.estado === 'instalada' || undefined}>{prog || inst.estado === 'instalada' ? <Check size={17} aria-hidden="true" /> : <Clock3 size={17} aria-hidden="true" />} Cambio de medidor {inst.estado === 'instalada' ? 'realizado' : prog ? 'programado' : 'pendiente de programación'}</li>
        <li data-ok={t.interconexionFisica || undefined}>{t.interconexionFisica ? <Check size={17} aria-hidden="true" /> : <CircleDashed size={17} aria-hidden="true" />} Interconexión física {t.interconexionFisica ? 'confirmada' : 'pendiente de confirmación'}</li></ul></section>
      <Dialogo abierto={preparar} titulo="Prepárate para la instalación" onCerrar={() => setPreparar(false)}>
        <div className="kv-gr-detalle"><p className="kv-gr-sirve">Sugerencias de coordinación de la demostración. No son requisitos oficiales de CFE.</p>
          <ul className="kv-tr-lista">{CHECKLIST_INSTALACION.map((c) => <li key={c.id}><label><input type="checkbox" checked={inst.checklist.includes(c.id)} onChange={() => accionesTramite.alternarChecklist(folio, c.id)} /> <span>{c.texto}</span></label></li>)}</ul>
          <p className="kv-suave">No manipules equipos eléctricos, no retires sellos ni conectes inversores: el trabajo lo realiza CFE.</p>
          <Link to="/portal/instalacion" className="kvp-boton" onClick={() => setPreparar(false)}>Ir a Mi instalación <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </Dialogo>
      <p className="kv-cliente-legal">{LEYENDA_DEMO}.</p>
    </div>;
  }

  // ── Demo 6 · interconexión concluida ──
  return <div className="kv-tr">
    <HeroDemo visual={visual}
      acciones={<><Link to="/portal/expediente" className="kvp-boton">Ver mi expediente final <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/portal/expediente#encuesta" className="kvp-boton kvp-boton--suave"><Star size={16} aria-hidden="true" /> Dejar mi opinión</Link></>}
      banda={<><Check size={18} aria-hidden="true" /> Recorrido completado · {etapasCompletas} de {ETAPAS_RECORRIDO.length} etapas completadas<span className="kv-tr-banda__barra" role="img" aria-label={`Avance ${p.pct} %`}><i style={{ width: p.pct + '%' }} /></span><strong>{p.pct} %</strong></>} />
    <div className="kv-tr-dos">
      <section className="kv-tr-ficha kv-tr-resumen"><h2>Resumen del proyecto</h2>
        <dl><dt>Folio del proyecto</dt><dd className="kv-mono">{v.folio}</dd><dt>Tipo de trámite</dt><dd>{ESCENARIO.tipoTramite}</dd><dt>Capacidad del sistema</dt><dd>{ESCENARIO.capacidadDcKwp} kWp · {ESCENARIO.capacidadAcKw} kW AC</dd>
          <dt>Ubicación</dt><dd>{v.ubicacion || 'Hermosillo, Sonora'}</dd><dt>Fecha de inicio</dt><dd>{fecha(h.find((x) => x.id === 'fisico')?.fecha)}</dd><dt>Fecha de interconexión</dt><dd>{fecha(t.interconexionFisica)}</dd>
          <dt>Número de medidor</dt><dd className="kv-mono">{inst.medidor?.numero}</dd><dt>Esquema de contraprestación</dt><dd>{ESCENARIO.esquema}</dd><dt>Estado final</dt><dd><Pill tono="ok">Interconexión concluida</Pill></dd></dl>
        <small className="kv-suave">No se muestran ahorros, energía generada ni emisiones evitadas: esta demostración no tiene mediciones reales.</small></section>
      <div className="kv-tr">
        <section className="kv-cliente-accion kv-tr-accion"><span className="kv-cliente-etiqueta">Tu expediente final</span><h2>Todo lo que respalda tu interconexión.</h2><p>Consulta cada documento o descarga el expediente completo.</p><Link to="/portal/expediente" className="kvp-boton">Abrir expediente final <ArrowRight size={17} aria-hidden="true" /></Link></section>
        <div className="kv-tr-mini"><Link to="/portal/historial"><strong><History size={16} aria-hidden="true" /> Historial completo</strong><small>{t.eventos.length} eventos</small></Link><Link to="/portal/avisos"><strong><Bell size={16} aria-hidden="true" /> Avisos</strong><small>Tu conexión, paso a paso</small></Link></div>
      </div>
    </div>
    <p className="kv-cliente-legal">{LEYENDA_DEMO}.</p>
  </div>;
}

// ───────────────────────── Mis contratos ─────────────────────────
const CONTRATOS: { clave: ClaveContrato; nombre: string; entidad: string; explica: string; archivo: string }[] = [
  { clave: 'interconexion', nombre: 'Contrato de interconexión', entidad: 'CFE Distribución', explica: 'Formaliza las condiciones de interconexión de tu central fotovoltaica con la red de distribución.', archivo: 'contrato-de-interconexion' },
  { clave: 'contraprestacion', nombre: 'Contrato de contraprestación', entidad: 'CFE Suministrador', explica: 'Establece el esquema bajo el cual se contabiliza o remunera la energía que entregas a la red.', archivo: 'contrato-de-contraprestacion' },
];
export function MisContratos() {
  const { t, folio } = useTramite();
  const [visor, setVisor] = useState<ClaveContrato | null>(null);
  return <>
    <PortadaPortal titulo="Mis contratos.">Dos contratos formalizan tu interconexión. Revísalos con calma antes de firmar.</PortadaPortal>
    <section className="kv-tr-esquema"><div><span className="kv-cliente-etiqueta">Esquema establecido para tu trámite</span><h2>{ESCENARIO.esquema}</h2>
      <p>Ya quedó definido para tu solicitud; no se puede cambiar desde el portal. Si algo no coincide, repórtalo y IDC lo revisa.</p></div>
      <details><summary>¿Qué esquemas existen?</summary><ul>
        <li><strong>Medición neta:</strong> la energía que entregas a la red se compensa con la que consumes.</li>
        <li><strong>Facturación neta:</strong> la energía entregada y la consumida se miden por separado y se compensan en valor económico.</li>
        <li><strong>Venta total:</strong> toda la energía generada se entrega a la red y se remunera.</li>
        <li className="kv-suave">Explicación general; el esquema de tu trámite es el indicado arriba.</li></ul></details></section>

    <div className="kv-tr-contratos">{CONTRATOS.map((c) => {
      const k = t.contratos[c.clave];
      const formalizado = k.estado === 'formalizado';
      const ruta = cfe(`${c.archivo}${formalizado ? '-formalizado' : ''}.pdf`);
      const archivo: ArchivoDemo = { etiqueta: c.nombre, ruta };
      return <article key={c.clave} className="kv-tr-contrato" data-estado={k.estado}>
        <header><span className="kv-tr-contrato__ico"><FileSignature size={22} aria-hidden="true" /></span><div><h3>{c.nombre}</h3><small>{c.entidad}</small></div>
          <Pill tono={formalizado ? 'ok' : k.estado === 'disponible' ? 'alerta' : 'neutro'}>{formalizado ? 'Formalizado' : k.estado === 'disponible' ? 'Disponible para revisión y firma' : 'No disponible aún'}</Pill></header>
        <p>{c.explica}</p>
        <dl><dt>Fecha de preparación</dt><dd>{fecha(k.preparadoEn)}</dd>{formalizado && <><dt>Formalizado</dt><dd>{fecha(k.formalizadoEn)}</dd></>}</dl>
        {k.estado === 'no_disponible' ? <p className="kv-suave"><Lock size={15} aria-hidden="true" /> Se publica después de la resolución favorable.</p> : <>
          <div className="kv-tr-botones">
            <button type="button" className="kvp-boton" onClick={() => setVisor(c.clave)}><Maximize2 size={16} aria-hidden="true" /> Ver documento</button>
            <a className="kvp-boton kvp-boton--suave" href={ruta} download={ruta.split('/').pop()}><Download size={16} aria-hidden="true" /> Descargar</a></div>
          {!formalizado && <>
            <details className="kv-gr-acordeon"><summary>Cómo revisarlo y firmarlo</summary><div><ol className="kv-gr-pasos"><li>Descarga e imprime el contrato.</li><li>Revisa que tus datos y el esquema coincidan con tu trámite.</li><li>Fírmalo en la formalización coordinada: <strong>{ESCENARIO.firma.lugar}</strong>.</li></ol>
              <p className="kv-suave">La formalización la realiza <strong>{ESCENARIO.firma.responsable}</strong>. IDC coordina la cita y te acompaña ({ESCENARIO.firma.acompana}); no sustituye a CFE.</p></div></details>
            {k.coordinacion ? <p className="kv-tr-coord"><CalendarCheck2 size={16} aria-hidden="true" /> Firma coordinada: {fecha(k.coordinacion.fecha)} · {k.coordinacion.hora} · {ESCENARIO.firma.lugar}. Responsable: {ESCENARIO.firma.responsable}.</p> : <p className="kv-suave">IDC te avisará cuando coordine la fecha de formalización.</p>}
            {k.revisadoPorCliente ? <p className="kv-gr-ok"><Check size={15} aria-hidden="true" /> Confirmaste el {fecha(k.revisadoPorCliente)} que lo revisaste y está preparado para tu firma.</p>
              : <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => accionesTramite.revisarContrato(folio, c.clave)}><Check size={16} aria-hidden="true" /> Lo revisé y está listo para firmar</button>}
            <small className="kv-suave">Esta confirmación es solo una marca de preparación; no es una firma electrónica ni tiene validez legal.</small>
            <Reportar texto="¿Hay datos incorrectos?" enviados={k.reportes.map((r) => r.texto)} onEnviar={(x) => accionesTramite.reportarContrato(folio, c.clave, x)} />
          </>}
          {formalizado && <p className="kv-gr-ok"><Check size={15} aria-hidden="true" /> Formalizado con {c.entidad}. Registrado por IDC.</p>}
        </>}
        {visor === c.clave && <VisorDocumento onCerrar={() => setVisor(null)} datos={{ titulo: c.nombre, estado: formalizado ? 'Formalizado' : 'Disponible para revisión y firma', responsable: `${c.entidad} · coordina IDC`, cargadoEn: k.preparadoEn, validadoEn: k.formalizadoEn, archivos: [archivo] }} />}
      </article>;
    })}</div>
    <p className="kv-cliente-legal">{LEYENDA_DEMO}. KairóVolt e IDC no sustituyen a CFE ni al Suministrador en la formalización.</p>
  </>;
}
function Reportar({ texto, enviados, onEnviar }: { texto: string; enviados: string[]; onEnviar: (t: string) => void }) {
  const [v, setV] = useState('');
  return <details className="kv-gr-acordeon"><summary>{texto}</summary><div>
    <textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Cuéntanos qué dato parece incorrecto." className="kv-tr-area" />
    <button type="button" className="kvp-boton kvp-boton--suave" disabled={!v.trim()} onClick={() => { onEnviar(v.trim()); setV(''); }}><Send size={15} aria-hidden="true" /> Enviar a IDC</button>
    {enviados.length > 0 && <ul className="kv-gr-reportes">{enviados.map((x) => <li key={x}>Enviado: {x}</li>)}</ul>}</div></details>;
}

// ───────────────────────── Mi instalación ─────────────────────────
function TarjetaFecha({ fechaIso, franja, tachada = false, mes }: { fechaIso: string; franja: string; tachada?: boolean; mes?: string }) {
  const d = new Date(fechaIso + 'T12:00:00-07:00');
  return <div className={'kv-tr-fecha' + (tachada ? ' kv-tr-fecha--tachada' : '')}>
    <div className="kv-tr-fecha__dia"><small>{mes ?? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(d).replace('.', '')}</small><strong>{d.getDate()}</strong></div>
    <div><strong>{new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(d)}</strong><span>{fecha(fechaIso)}</span><span>{franja}</span></div></div>;
}
export function MiInstalacion() {
  const { v, t, folio } = useTramite();
  const [inconv, setInconv] = useState('');
  const [reg, setReg] = useState<ArchivoDemo | null>(null);
  const [verReg, setVerReg] = useState(false);
  useEffect(() => { let u = ''; if (t.instalacion.estado !== 'instalada') { setReg(null); return; } void registroInstalacionPdf(t).then((b) => { u = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/pdf' })); setReg({ etiqueta: 'Registro de instalación', ruta: u }); }); return () => { if (u) URL.revokeObjectURL(u); }; }, [t.instalacion.estado, t.instalacion.medidor?.numero]);
  const i = t.instalacion;

  if (!instalacionHabilitada(t)) return <>
    <PortadaPortal titulo="Mi instalación.">Aquí seguirás el cambio a tu medidor bidireccional.</PortadaPortal>
    <section className="kv-tr-bloqueo"><Lock size={26} aria-hidden="true" /><div><h2>Todavía no está habilitada</h2><p>El seguimiento de la instalación comienza cuando tus dos contratos están formalizados.</p><Link className="kvp-boton" to="/portal/contratos">Ir a mis contratos <ArrowRight size={16} aria-hidden="true" /></Link></div></section></>;

  const programada = i.estado === 'programada' || i.estado === 'reprogramada';
  return <>
    <PortadaPortal titulo="Mi instalación.">Seguimiento del cambio a tu medidor bidireccional. La visita la realiza CFE; IDC le da seguimiento por ti.</PortadaPortal>
    <section className="kv-tr-inst">
      <IlustracionMedidor className="kv-tr-inst__ilus" />
      <div>
        <Pill tono={i.estado === 'instalada' ? 'ok' : programada ? 'info' : 'alerta'}>{i.estado === 'instalada' ? 'Medidor instalado' : i.estado === 'programada' ? 'Instalación programada' : i.estado === 'reprogramada' ? 'Instalación reprogramada' : i.estado === 'pendiente_nueva_fecha' ? 'Pendiente de nueva fecha' : 'Pendiente de programación por CFE'}</Pill>
        {(i.estado === 'pendiente_cfe' || i.estado === 'pendiente_nueva_fecha') && <>
          <h2>{i.estado === 'pendiente_cfe' ? 'Estamos esperando la confirmación de la fecha de instalación.' : 'CFE aún no comunica una nueva fecha.'}</h2>
          <p>IDC mantiene el seguimiento de tu solicitud. No necesitas realizar ninguna acción por ahora.</p>
          {i.estado === 'pendiente_nueva_fecha' && <div className="kv-tr-reprog"><p><strong>Fecha anterior:</strong> {i.anterior && fecha(i.anterior.fecha)} ({i.anterior?.franja}) — ya no está vigente.</p><p><strong>Motivo:</strong> {i.motivo}</p></div>}
          <dl className="kv-tr-seg"><dt>Última actualización</dt><dd>{fecha(i.actualizadoEn)}</dd><dt>Próximo seguimiento interno de IDC</dt><dd>{fecha(i.seguimientoIdc)} <small>(no es una fecha de instalación)</small></dd></dl></>}
        {programada && i.programada && <>
          <h2>{i.estado === 'reprogramada' ? 'CFE cambió la fecha de tu instalación.' : 'Tu instalación está programada.'}</h2>
          {i.estado === 'reprogramada' && i.anterior && <div className="kv-tr-reprog"><p><strong>Fecha anterior:</strong></p><TarjetaFecha fechaIso={i.anterior.fecha} franja={i.anterior.franja} tachada /><p><strong>Motivo:</strong> {i.motivo}</p><p><strong>Actualizado:</strong> {fecha(i.actualizadoEn)}</p>
            <p className="kv-suave">IDC da seguimiento y te avisa de cualquier otro cambio. Revisa también tus Avisos.</p></div>}
          <TarjetaFecha fechaIso={i.programada.fecha} franja={i.programada.franja} />
          <dl className="kv-tr-seg"><dt>Ubicación del servicio</dt><dd>{v.ubicacion || 'Hermosillo, Sonora'}</dd><dt>Tipo de visita</dt><dd>{ESCENARIO.tipoVisita}</dd><dt>Confirmación</dt><dd><Pill tono="ok">Fecha comunicada por CFE</Pill></dd>
            <dt>Responsable</dt><dd>{ESCENARIO.instalacionPor}</dd><dt>Seguimiento</dt><dd>{ESCENARIO.seguimientoPor}</dd></dl></>}
        {i.estado === 'instalada' && <>
          <h2>CFE instaló tu medidor bidireccional.</h2>
          <dl className="kv-tr-seg"><dt>Fecha de instalación</dt><dd>{fecha(i.medidor?.fecha)}</dd><dt>Número de medidor</dt><dd className="kv-mono">{i.medidor?.numero}</dd>
            <dt>Interconexión física</dt><dd>{t.interconexionFisica ? <Pill tono="ok">Confirmada · {corta(t.interconexionFisica)}</Pill> : <Pill tono="alerta">Pendiente de confirmación</Pill>}</dd>
            <dt>Incorporación al sistema comercial</dt><dd>{t.sistemaComercial ? <Pill tono="ok">Confirmada · {corta(t.sistemaComercial)}</Pill> : <Pill tono="alerta">Pendiente</Pill>}</dd></dl>
          {reg && <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setVerReg(true)}><FileText size={16} aria-hidden="true" /> Ver evidencia de instalación</button>}
          <small className="kv-suave">Registrar el cambio de medidor no concluye el trámite: faltan las confirmaciones indicadas.</small>
          {verReg && reg && <VisorDocumento onCerrar={() => setVerReg(false)} datos={{ titulo: 'Evidencia de instalación (demostración)', estado: 'Registrada por IDC', responsable: 'CFE instala · IDC registra', cargadoEn: i.actualizadoEn, archivos: [reg] }} />}</>}
      </div>
    </section>

    {programada && <section className="kv-tr-disp"><h2>¿Estarás disponible?</h2>
      {i.disponibilidad ? <p className={i.disponibilidad.estado === 'confirmada' ? 'kv-gr-ok' : 'kv-gr-aviso kv-gr-aviso--alerta'}>{i.disponibilidad.estado === 'confirmada' ? <><Check size={15} aria-hidden="true" /> Confirmaste tu disponibilidad el {fecha(i.disponibilidad.fecha)}.</> : <>Reportaste un inconveniente: «{i.disponibilidad.texto}». IDC lo comunica a CFE; no podemos fijar una fecha por ti.</>}</p> : null}
      <div className="kv-tr-botones"><button type="button" className="kvp-boton" onClick={() => accionesTramite.disponibilidad(folio, 'confirmada')}><Check size={16} aria-hidden="true" /> Confirmo mi disponibilidad</button></div>
      <details className="kv-gr-acordeon"><summary>Tengo un inconveniente</summary><div><textarea rows={3} className="kv-tr-area" value={inconv} onChange={(e) => setInconv(e.target.value)} placeholder="Cuéntale a IDC qué sucede." />
        <button type="button" className="kvp-boton kvp-boton--suave" disabled={!inconv.trim()} onClick={() => { accionesTramite.disponibilidad(folio, 'inconveniente', inconv.trim()); setInconv(''); }}><Send size={15} aria-hidden="true" /> Reportar a IDC</button>
        <small className="kv-suave">El cliente no asigna la fecha: la comunica CFE y IDC da seguimiento.</small></div></details></section>}

    {i.estado !== 'instalada' && <section className="kv-tr-check"><h2>Para estar listo</h2><p className="kv-suave">Sugerencias de coordinación de la demostración; no son requisitos oficiales de CFE. No manipules equipos eléctricos ni retires sellos: el trabajo lo hace CFE.</p>
      <ul>{CHECKLIST_INSTALACION.map((c) => <li key={c.id}><label><input type="checkbox" checked={i.checklist.includes(c.id)} onChange={() => accionesTramite.alternarChecklist(folio, c.id)} /><span>{c.texto}</span></label></li>)}</ul></section>}
    <details className="kv-gr-acordeon kv-tr-demo"><summary>Controles de demostración · simular lo que comunica CFE</summary><div><p className="kv-suave">Solo para la presentación: reproduce cómo avanzaría el seguimiento que registra IDC.</p>
      <div className="kv-tr-botones">{(['A', 'B', 'C', 'D'] as const).map((k) => <button key={k} type="button" className="kvp-boton kvp-boton--suave" onClick={() => accionesTramite.atajoInstalacion(folio, k)}>{{ A: 'Pendiente de CFE', B: 'Programada', C: 'Reprogramada', D: 'Instalada' }[k]}</button>)}</div></div></details>
    <p className="kv-cliente-legal">{LEYENDA_DEMO}. La fecha de instalación solo se muestra como confirmada cuando CFE la comunicó.</p>
  </>;
}

// ───────────────────────── Mi recorrido ─────────────────────────
export function MiRecorrido() {
  const { t, folio } = useTramite();
  const h = hitosTramite(t, folio); const p = progresoTramite(h);
  const siguiente = h.find((x) => !x.hecho);
  return <>
    <PortadaPortal titulo="Mi recorrido.">Cuatro etapas, de tus documentos a la interconexión. El avance se calcula solo con hitos completados.</PortadaPortal>
    <div className="kv-tr-prog"><div role="img" aria-label={`Avance ${p.pct} %`}><i style={{ width: p.pct + '%' }} /></div><strong>{p.pct} %</strong><span>{p.hechos} de {p.total} hitos</span></div>
    <div className="kv-tr-etapas">{ETAPAS_RECORRIDO.map((e) => {
      const hs = h.filter((x) => x.etapa === e.n); const hechos = hs.filter((x) => x.hecho).length; const completa = hechos === hs.length;
      const proxima = hs.find((x) => !x.hecho);
      return <details key={e.n} className="kv-tr-etapa" open={!completa && h.find((x) => !x.hecho)?.etapa === e.n} data-completa={completa || undefined}>
        <summary><span className="kv-tr-etapa__n">{completa ? <Check size={16} aria-hidden="true" /> : e.n}</span><div><strong>{e.nombre}</strong><small>{e.descripcion}</small></div><Pill tono={completa ? 'ok' : hechos ? 'info' : 'neutro'}>{completa ? 'Completada' : `${hechos} de ${hs.length}`}</Pill></summary>
        <ol>{hs.map((x) => <li key={x.id} data-hecho={x.hecho || undefined}>{x.hecho ? <Check size={16} aria-hidden="true" /> : <CircleDashed size={16} aria-hidden="true" />}
          <div><strong>{x.titulo}</strong><small>{x.responsable}{x.fecha ? ' · ' + fecha(x.fecha) : x.hecho ? '' : ' · pendiente'}</small>{x.documentos && <small>Documentos: {x.documentos.join(', ')}</small>}{x.ruta && <Link to={x.ruta}>Consultar</Link>}</div></li>)}</ol>
        {proxima ? <p className="kv-tr-etapa__prox"><CircleAlert size={15} aria-hidden="true" /> Próxima acción: {proxima.titulo} ({proxima.responsable}).</p> : <p className="kv-gr-ok"><Check size={15} aria-hidden="true" /> Etapa completada.</p>}
      </details>;
    })}</div>
    {siguiente && <p className="kv-suave">Siguiente hito: {siguiente.titulo}.</p>}
  </>;
}

// ───────────────────────── Expediente final y encuesta ─────────────────────────
export function ExpedienteFinal() {
  const { t, folio } = useTramite();
  const [docs, setDocs] = useState<DocFinal[]>([]);
  const [visor, setVisor] = useState<DocFinal | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { let vivo = true; void documentosExpedienteFinal(folio, t).then((d) => { if (vivo) setDocs(d); }); return () => { vivo = false; }; }, [folio, t]);
  const cerrado = !!t.cierre;
  return <>
    <PortadaPortal titulo={cerrado ? 'Mi expediente final.' : 'Mi expediente.'}>{cerrado ? 'Todo lo que respalda tu interconexión, en un solo lugar. Lo conservas después de concluir el trámite.' : 'Se completa a medida que avanza tu trámite.'}</PortadaPortal>
    <section className="kv-tr-exp"><ul>{docs.map((d) => <li key={d.id} data-disponible={d.disponible || undefined}>
      <span className="kv-tr-exp__ico">{d.disponible ? <FileText size={20} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}</span>
      <div><strong>{d.titulo}</strong><small>{d.detalle}</small></div>
      {d.disponible && d.id !== 'inicial' && <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setVisor(d)}><Maximize2 size={15} aria-hidden="true" /> Ver</button>}
      {d.id === 'inicial' && d.disponible && <Link className="kvp-boton kvp-boton--suave" to="/portal/documentos">Ver documentos</Link>}
    </li>)}</ul>
      <button type="button" className="kvp-boton" disabled={ocupado} onClick={() => { setOcupado(true); void descargarExpedienteCompleto(folio, t).finally(() => setOcupado(false)); }}><Download size={17} aria-hidden="true" /> {ocupado ? 'Preparando…' : 'Descargar expediente completo'}</button>
      <small className="kv-suave">Un PDF de demostración que reúne los documentos ficticios disponibles. {LEYENDA_DEMO}.</small></section>
    {visor && <VisorDocumento onCerrar={() => setVisor(null)} datos={{ titulo: visor.titulo, estado: 'Disponible', responsable: visor.id === 'resolucion' || visor.id === 'acuse' ? 'CFE / IDC' : 'CFE · coordina IDC', cargadoEn: t.resolucion?.fecha, archivos: visor.archivos }} />}
    <Encuesta cerrado={cerrado} t={t} folio={folio} />
  </>;
}
function Encuesta({ cerrado, t, folio }: { cerrado: boolean; t: TramiteDemo; folio: string }) {
  const [e, setE] = useState(0); const [c, setC] = useState('');
  if (!cerrado) return <section className="kv-tr-encuesta kv-tr-encuesta--bloq"><Lock size={18} aria-hidden="true" /> La encuesta se habilita cuando concluye el trámite.</section>;
  if (t.encuesta) return <section className="kv-tr-encuesta"><h2>¡Gracias por tu opinión!</h2><p className="kv-gr-ok"><Check size={15} aria-hidden="true" /> Enviaste {t.encuesta.estrellas} de 5 estrellas el {fecha(t.encuesta.fecha)}. (Envío simulado: no se guarda fuera de este navegador.)</p></section>;
  return <section className="kv-tr-encuesta" id="encuesta"><h2>¿Cómo fue tu experiencia?</h2>
    <div className="kv-tr-estrellas" role="radiogroup" aria-label="Calificación de 1 a 5">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={e === n} aria-label={`${n} estrella${n > 1 ? 's' : ''}`} onClick={() => setE(n)} className={n <= e ? 'on' : ''}><Star size={28} aria-hidden="true" fill={n <= e ? 'currentColor' : 'none'} /></button>)}</div>
    <label className="kv-tr-opcional">Comentarios (opcional)<textarea rows={3} value={c} onChange={(ev) => setC(ev.target.value)} className="kv-tr-area" /></label>
    <button type="button" className="kvp-boton" disabled={!e} onClick={() => accionesTramite.encuesta(folio, e, c.trim())}><Send size={16} aria-hidden="true" /> Enviar mi opinión</button></section>;
}

// ───────────────────────── Mi visita (ya realizada) ─────────────────────────
export function VisitaRealizada() {
  const { t } = useTramite();
  return <>
    <PortalPortadaVisita fecha={t.recepcionFisica} />
  </>;
}
function PortalPortadaVisita({ fecha: f }: { fecha?: string }) {
  const entregado = !!f;
  return <>
    <PortadaPortal titulo={entregado ? 'Tu visita de entrega ya se realizó.' : 'Tu entrega física está pendiente.'}>{entregado ? `IDC recibió tu expediente físico el ${fecha(f)}.` : 'IDC registrará la recepción cuando entregues tu carpeta.'}</PortadaPortal>
    <section className="kv-tr-bloqueo"><CalendarCheck2 size={26} aria-hidden="true" /><div><h2>{entregado ? 'Expediente recibido por IDC' : 'Aún sin entrega registrada'}</h2>
      <p>Esta visita fue a las oficinas de IDC. La instalación de tu medidor es otra visita: la programa CFE y la encuentras en Mi instalación.</p>
      <Link className="kvp-boton" to="/portal/recorrido">Ver mi recorrido <ArrowRight size={16} aria-hidden="true" /></Link></div></section></>;
}
