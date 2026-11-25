import { useState } from 'react';
import type { Recepcion } from '@/application/portal-cliente';
import { ETAPA_CLIENTE } from '@/domain/portal/textos';
import { ESTADO_DOCUMENTO, REQUIERE_ACCION } from '@/components/portal/estados';
import { SubirDocumento } from '@/components/portal/SubirDocumento';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { EmptyState } from '@/components/ui/Estados';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePortal, useVistaPortal } from '@/hooks/PortalContexto';

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Documentos que IDC te pide, con el botón para subirlos, y las confirmaciones de recepción. */
export function PortalDocumentos() {
  const v = useVistaPortal();
  const { subir } = usePortal();
  // La confirmación vive en la página (no en la tarjeta): al subirse, el documento pasa a «ya entregados» y su tarjeta se reemplaza.
  const [ultima, setUltima] = useState<{ recepcion: Recepcion; guardado: boolean } | null>(null);
  const subirYConfirmar: typeof subir = async (id, archivo, onProgreso) => {
    const res = await subir(id, archivo, onProgreso);
    setUltima({ recepcion: res.recepcion, guardado: res.archivosGuardados });
    return res;
  };

  if (v.documentos === null) {
    return <AlertPanel tono="info" titulo="Documentos no disponibles">Tu acceso no incluye la sección de documentos. Si la necesitas, pídesela a IDC.</AlertPanel>;
  }
  const porHacer = v.documentos.filter((d) => REQUIERE_ACCION.includes(d.estado));
  const resto = v.documentos.filter((d) => !REQUIERE_ACCION.includes(d.estado) && d.estado !== 'no_aplica');
  const excluidos = v.documentos.filter((d) => d.estado === 'no_aplica');

  const tarjeta = (d: (typeof v.documentos)[number] & object) => (
    <li key={d.id} className={`kvp-doc${REQUIERE_ACCION.includes(d.estado) ? ' kvp-doc--accion' : ''}`}>
      <div className="kvp-doc__cab">
        <p className="kvp-doc__nombre">{d.nombre}</p>
        <StatusBadge tono={ESTADO_DOCUMENTO[d.estado].tono} variante="suave" tamano="md">
          {d.estado === 'en_revision' && v.recepciones.find((r) => r.documentoId === d.id)?.estado === 'en_revision'
            ? 'En revisión por IDC' : d.estado === 'rechazado' &&
              ['incompleto', 'faltan_datos'].includes(v.recepciones.find((r) => r.documentoId === d.id)?.causa ?? '')
              ? 'Información incompleta' : ESTADO_DOCUMENTO[d.estado].texto}
        </StatusBadge>
      </div>
      <p className="kvp-doc__texto">Etapa: {ETAPA_CLIENTE[d.etapa].nombre}{d.vigencia ? ` · Vigencia: ${d.vigencia}` : ''}</p>
      {d.detalle && <p className="kvp-doc__texto">{d.detalle}</p>}
      {d.puedeSubir && <SubirDocumento documento={d} onSubir={subirYConfirmar} conservaArchivos={v.persistencia.archivos === 'supabase'} />}
    </li>
  );

  return (
    <>
      {ultima && (
        <AlertPanel tono="ok" titulo="¡Recibido!" onCerrar={() => setUltima(null)}>
          Recibimos «{ultima.recepcion.archivo}». Tu acuse de recibo es <strong className="kvp-recibo__acuse">{ultima.recepcion.recibo}</strong>.
          {!ultima.guardado && <> <em>(Modo demostración: el archivo no se conserva.)</em></>}
        </AlertPanel>
      )}
      <h1>Mis documentos</h1>
      <p className="kv-suave">Estos son los documentos que necesitamos de tu parte. En cuanto subas uno, te damos un acuse de recibo.</p>
      <AlertPanel tono="info" titulo="Preparación documental">Esta guía ayuda a organizar tu expediente; no garantiza la aceptación de CFE. Los requisitos marcados pendientes deben ser confirmados por IDC antes de usarse como lista definitiva.</AlertPanel>

      {v.documentos.length === 0 && !v.avance.exacto && <AlertPanel tono="info" titulo="IDC aún no ha cargado una lista para tu proyecto">La guía general está disponible abajo. Cuando IDC confirme qué aplica a tu instalación, los documentos solicitados aparecerán aquí y podrás enviarlos.</AlertPanel>}

      <h2>Por entregar {porHacer.length > 0 && <StatusBadge tono="alerta" variante="solido">{porHacer.length}</StatusBadge>}</h2>
      {porHacer.length === 0
        ? (v.documentos.length > 0 || v.avance.exacto) && <EmptyState compacto icono="✓" titulo="No tienes nada por entregar" descripcion="Cuando IDC necesite algo más, te lo avisaremos aquí." />
        : <ul className="kvp-docs" aria-label="Documentos por entregar">{porHacer.map(tarjeta)}</ul>}

      {resto.length > 0 && (
        <>
          <h2>Ya entregados</h2>
          <ul className="kvp-docs" aria-label="Documentos ya entregados">{resto.map(tarjeta)}</ul>
        </>
      )}
      {excluidos.length > 0 && <details><summary>Requisitos que no aplican</summary><ul className="kvp-docs">{excluidos.map(tarjeta)}</ul></details>}

      {v.guiaDocumental && v.guiaDocumental.length > 0 && <>
        <h2>Guía documental</h2>
        <ul className="kvp-docs" aria-label="Guía documental disponible">
          {v.guiaDocumental.map((r) => <li key={r.id} className="kvp-doc">
            <div className="kvp-doc__cab"><p className="kvp-doc__nombre">{r.nombre}</p>
              <StatusBadge tono={r.validacionIdc === 'validado' ? 'ok' : 'alerta'} variante="suave">{r.validacionIdc === 'validado' ? 'Validado por IDC' : 'Pendiente de validación'}</StatusBadge>
            </div>
            {r.descripcion && <p className="kvp-doc__texto">{r.descripcion}</p>}
            <p className="kvp-doc__texto">Etapa {r.etapa} · {r.quienAporta === 'pendiente' ? 'Aportante por confirmar' : `Aporta: ${r.quienAporta}`} · {r.canal === 'fisico' ? 'Entrega física' : 'Digital'}{r.requiereVigencia ? ' · Requiere vigencia' : ''}</p>
            {r.condicion && <p className="kvp-doc__texto">Condición: {r.condicion} <strong>(pendiente de revisión)</strong></p>}
            {r.aplicabilidad === 'pendiente_revision' && <p className="kvp-doc__texto">IDC debe confirmar si aplica a tu instalación; no se cuenta como autorización para avanzar.</p>}
            {r.instrucciones && <p className="kvp-doc__texto">{r.instrucciones}</p>}
            {r.camposEsperados.length > 0 && <p className="kvp-doc__texto">Debe incluir: {r.camposEsperados.join(' · ')}</p>}
            {r.ejemplosAutorizados.length > 0 && <p className="kvp-doc__texto">Ejemplos: {r.ejemplosAutorizados.join(' · ')}</p>}
          </li>)}
        </ul>
      </>}

      <h2>Confirmaciones de recepción</h2>
      {v.recepciones.length === 0
        ? <EmptyState compacto titulo="Aún no hay confirmaciones" descripcion="Cada archivo que subas desde aquí aparecerá con su acuse de recibo." />
        : (
          <ul className="kvp-docs" aria-label="Confirmaciones de recepción">
            {v.recepciones.map((r) => (
              <li key={r.recibo} className="kvp-doc">
                <div className="kvp-recibo">
                  <span className={`kvp-recibo__icono${r.estado === 'rechazado' ? ' kvp-recibo__icono--rechazo' : ''}`} aria-hidden="true">{r.estado === 'rechazado' ? '!' : '✓'}</span>
                  <div>
                    <p className="kvp-doc__nombre">{r.documento}</p>
                    <p className="kvp-doc__texto">{r.archivo} · {fechaHora(r.fecha)}</p>
                    <p className="kvp-doc__texto">Acuse <span className="kvp-recibo__acuse">{r.recibo}</span> · {r.sustituida ? 'Sustituido por otro envío' : r.estado === 'recibido' ? 'Recibido, pendiente de revisión' : r.estado === 'en_revision' ? 'En revisión por IDC' : r.estado === 'aceptado' ? 'Aceptado por IDC' : 'Requiere corrección'}</p>
                    {r.motivo && <p className="kvp-doc__texto">{r.motivo}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
