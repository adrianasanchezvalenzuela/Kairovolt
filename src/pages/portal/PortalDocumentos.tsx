import { useState } from 'react';
import { ArrowRight, FileCheck2, FileText, Inbox, TriangleAlert } from 'lucide-react';
import type { Recepcion } from '@/application/portal-cliente';
import { IlustracionExpediente, PortadaPortal } from '@/components/portal/DisenoPortal';
import { ESTADO_DOCUMENTO } from '@/components/portal/estados';
import { SubirDocumento } from '@/components/portal/SubirDocumento';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Dialogo } from '@/components/ui/Dialogo';
import { EmptyState } from '@/components/ui/Estados';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ETAPA_CLIENTE } from '@/domain/portal/textos';
import { usePortal, useVistaPortal } from '@/hooks/PortalContexto';

const filtros = ['Todos', 'Pendientes', 'En revisión', 'Por corregir', 'Aceptados'] as const;
const aportante = { cliente: 'Cliente', idc: 'IDC', tercero: 'Tercero', pendiente: 'Por confirmar' };
const estadoRecibo = { recibido: 'Recibido', en_revision: 'En revisión', aceptado: 'Aceptado por IDC', rechazado: 'Requiere corrección' };

export function PortalDocumentos() {
  const v = useVistaPortal();
  const { subir } = usePortal();
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>('Todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [acuse, setAcuse] = useState<{ recepcion: Recepcion; guardado: boolean } | null>(null);

  if (v.documentos === null) return <AlertPanel tono="info" titulo="Documentos no disponibles">Tu acceso no incluye esta sección. Si la necesitas, comunícate con IDC.</AlertPanel>;

  const solicitudes = new Map(v.documentos.map((d) => [d.id, d]));
  const guias = new Map((v.guiaDocumental ?? []).map((g) => [g.id, g]));
  const ids = [...new Set([...solicitudes.keys(), ...guias.keys()])];
  const listado = ids.filter((id) => {
    const estado = solicitudes.get(id)?.estado;
    switch (filtro) {
      case 'Pendientes': return estado === 'pendiente' || estado === 'vencido' || estado === 'por_vencer';
      case 'En revisión': return estado === 'recibido' || estado === 'en_revision';
      case 'Por corregir': return estado === 'rechazado';
      case 'Aceptados': return estado === 'aceptado';
      default: return true;
    }
  });
  const guia = abierto ? guias.get(abierto) : undefined;
  const documento = abierto ? solicitudes.get(abierto) : undefined;
  const versiones = v.recepciones.filter((r) => r.documentoId === abierto);
  const badge = (id: string) => {
    const d = solicitudes.get(id);
    const g = guias.get(id);
    const rec = v.recepciones.find((r) => r.documentoId === id);
    if (!d) return <StatusBadge tono={g?.aplicabilidad === 'pendiente_revision' ? 'alerta' : 'neutro'} variante="suave">
      {g?.aplicabilidad === 'no_aplica' ? 'No aplica' : g?.aplicabilidad === 'pendiente_revision' ? 'Por confirmar' : 'Disponible en guía'}
    </StatusBadge>;
    return <StatusBadge tono={ESTADO_DOCUMENTO[d.estado].tono} variante="suave">{
      d.estado === 'rechazado' && (rec?.causa === 'incompleto' || rec?.causa === 'faltan_datos')
        ? 'Información incompleta' : d.estado === 'en_revision' && rec?.estado === 'en_revision'
          ? 'En revisión por IDC' : ESTADO_DOCUMENTO[d.estado].texto
    }</StatusBadge>;
  };

  const subirYConfirmar: typeof subir = async (id, archivo, progreso) => {
    setOcupado(true);
    try {
      const resultado = await subir(id, archivo, progreso);
      setAcuse({ recepcion: resultado.recepcion, guardado: resultado.archivosGuardados });
      return resultado;
    } finally { setOcupado(false); }
  };

  return <>
    <div className="kv-cliente-intro">
      <PortadaPortal titulo="Preparemos tu expediente.">Consulta qué documentos te corresponden y cómo preparar cada envío.</PortadaPortal>
      <IlustracionExpediente variante="documentos" />
    </div>
    {acuse && !abierto && <AlertPanel tono="ok" titulo="Archivo recibido" onCerrar={() => setAcuse(null)}>
      {acuse.recepcion.archivo} · Acuse <strong className="kv-mono">{acuse.recepcion.recibo}</strong>.
      {!acuse.guardado && ' El archivo de demostración no se conserva.'}
    </AlertPanel>}
    <section className="kv-cliente-docs" aria-label="Requisitos documentales">
      <div className="kv-cliente-linea"><h2>Guía documental</h2><span>{listado.length} requisitos</span></div>
      <div className="kv-cliente-filtros" role="group" aria-label="Filtrar documentos">
        {filtros.map((f) => <button type="button" key={f} aria-pressed={f === filtro} onClick={() => setFiltro(f)}>{f}</button>)}
      </div>
      {!listado.length ? <EmptyState titulo="No hay documentos en esta vista" descripcion="Selecciona otro filtro para ver los requisitos disponibles." /> :
        <ul className="kv-cliente-docs__lista">{listado.map((id) => {
          const d = solicitudes.get(id);
          const g = guias.get(id);
          const Icono = d?.estado === 'aceptado' ? FileCheck2 : d?.estado === 'rechazado' ? TriangleAlert : FileText;
          return <li key={id} data-estado={d?.estado}>
            <span className="kv-cliente-docs__icono"><Icono size={21} aria-hidden="true" /></span>
            <div className="kv-cliente-docs__info"><h3>{d?.nombre ?? g?.nombre}</h3>
              {(d?.detalle || g?.descripcion) && <p>{d?.detalle ?? g?.descripcion}</p>}
              {g && <small>Aporta {aportante[g.quienAporta]}</small>}
            </div>
            <div className="kv-cliente-docs__acciones">{badge(id)}<button type="button" onClick={() => setAbierto(id)}>
              {d?.puedeSubir ? 'Preparar envío' : 'Ver detalle'} <ArrowRight size={16} aria-hidden="true" />
            </button></div>
          </li>;
        })}</ul>}
    </section>
    <section className="kv-cliente-seccion kv-cliente-recepciones">
      <h2><Inbox size={21} aria-hidden="true" /> Confirmaciones de recepción</h2>
      {v.recepciones.length === 0 ? <EmptyState compacto titulo="Aún no hay confirmaciones" descripcion="Cada envío aparecerá aquí con su acuse." /> :
        <ul>{v.recepciones.map((r) => <li key={r.recibo}>
          <div><strong>{r.documento}</strong><p>{r.archivo} · <span className="kv-mono">{r.recibo}</span></p></div>
          <div><span>{r.sustituida ? 'Sustituido' : estadoRecibo[r.estado]}</span><time dateTime={r.fecha}>{r.fecha.slice(0, 10)}</time></div>
        </li>)}</ul>}
    </section>
    <Dialogo abierto={!!abierto} titulo={documento?.nombre ?? guia?.nombre ?? 'Documento'} onCerrar={() => setAbierto(null)} posicion="derecha" ocupado={ocupado}>
      {abierto && <div className="kv-cliente-detalle">
        {acuse?.recepcion.documentoId === abierto && <AlertPanel tono="ok" titulo="Archivo recibido">
          Acuse <strong className="kv-mono">{acuse.recepcion.recibo}</strong>.
          {!acuse.guardado && ' El archivo de demostración no se conserva.'}
        </AlertPanel>}
        {badge(abierto)}
        {(documento ?? guia) && <p>{ETAPA_CLIENTE[(documento ?? guia)!.etapa].nombre}</p>}
        {guia?.descripcion && <p>{guia.descripcion}</p>}
        {documento?.detalle && <AlertPanel tono={documento.estado === 'rechazado' ? 'error' : 'info'}>{documento.detalle}</AlertPanel>}
        {guia && <>
          <dl><dt>Quién lo aporta</dt><dd>{aportante[guia.quienAporta]}</dd><dt>Entrega</dt><dd>{guia.canal === 'fisico' ? 'Física' : 'Digital'}</dd>
            {guia.requiereVigencia && <><dt>Vigencia</dt><dd>{documento?.vigencia ?? 'Pendiente de confirmar'}</dd></>}</dl>
          {guia.validacionIdc === 'pendiente' && <p className="kv-cliente-nota">Guía pendiente de validación por IDC.</p>}
          {guia.condicion && <p>{guia.condicion}</p>}
          {guia.instrucciones && <><h3>Cómo prepararlo</h3><p>{guia.instrucciones}</p></>}
          {guia.camposEsperados.length > 0 && <><h3>Qué debe incluir</h3><ul>{guia.camposEsperados.map((c) => <li key={c}>{c}</li>)}</ul></>}
          {guia.ejemplosAutorizados.length > 0 && <><h3>Ejemplos autorizados</h3><ul>{guia.ejemplosAutorizados.map((e) => <li key={e}>{e}</li>)}</ul></>}
        </>}
        {documento?.puedeSubir && <SubirDocumento key={documento.id} documento={documento} onSubir={subirYConfirmar} conservaArchivos={v.persistencia.archivos === 'supabase'} />}
        {versiones.length > 0 && <><h3>Historial de envíos</h3><ul className="kv-cliente-versiones">{versiones.map((r) => <li key={r.recibo}>
          <strong>{r.archivo}</strong><span>{r.sustituida ? 'Sustituido' : estadoRecibo[r.estado]} · {r.fecha.slice(0, 10)}</span>
          <code>{r.recibo}</code>{r.motivo && <p>{r.motivo}</p>}
        </li>)}</ul></>}
      </div>}
    </Dialogo>
  </>;
}
