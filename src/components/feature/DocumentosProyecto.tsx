import { useState } from 'react';
import { documentosVencidos, type AnalisisProyecto } from '@/application/analizar-proyecto';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { EmptyState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ChecklistTable } from './ChecklistTable';
import { DocumentRow, DocumentTable } from './DocumentRow';
import { PanelEvidencia } from './PanelEvidencia';

/** Pestaña de documentos: checklist por compuerta (con faltantes y vencidos) y todos los documentos recibidos con su evidencia. */
export function DocumentosProyecto({ proyecto, analisis }: { proyecto: Proyecto; analisis: AnalisisProyecto }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!analisis.disponible) {
    return <AlertPanel tono="info" titulo="Expediente no disponible">La fuente de datos todavía no trae los documentos de este proyecto, así que no se puede armar el checklist. No se muestran faltantes inventados.</AlertPanel>;
  }
  const vencidos = documentosVencidos(analisis);
  const requisitoDe = (tipo: string) => analisis.checklist.flatMap((r) => r.items).find((i) => i.requisito.tipo === tipo)?.requisito.nombre ?? null;
  const documento = proyecto.documentos.find((d) => d.id === abierto) ?? null;
  const { progreso, carpetaFisica } = analisis;
  const faltantes = analisis.checklist.reduce((n, r) => n + r.faltantes.length, 0);

  return (
    <>
      <KPIGrid etiqueta="Resumen del expediente">
        <KPI etiqueta="Obligatorios recibidos" valor={`${progreso.recibidos}/${progreso.total}`} tono={faltantes > 0 ? 'alerta' : 'ok'} detalle={`${faltantes} faltantes`} />
        <KPI etiqueta="Vencidos" valor={String(vencidos.size)} tono={vencidos.size > 0 ? 'error' : 'ok'} detalle="Vigencia vencida" />
        <KPI etiqueta="Carpeta física" valor={`${carpetaFisica.listos}/${carpetaFisica.total}`} tono={carpetaFisica.pendientes.length > 0 ? 'alerta' : 'ok'} detalle="Firmas o entregas físicas" />
        <KPI etiqueta="Documentos recibidos" valor={String(proyecto.documentos.length)} tono="info" />
      </KPIGrid>
      <div style={{ margin: '12px 0 0', maxWidth: 480 }}><ProgressBar grueso valor={progreso.recibidos} total={progreso.total} etiqueta="Expediente obligatorio" /></div>

      <h2>Checklist por compuerta</h2>
      {analisis.checklist.map((r) => (
        <section key={r.compuerta} aria-label={`Checklist ${r.compuerta}`} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 6px' }}>{r.compuerta} <StatusBadge tono={r.completa ? 'ok' : 'alerta'} variante="suave">{r.recibidosObligatorios}/{r.totalObligatorios} obligatorios</StatusBadge></h3>
          <ChecklistTable resumen={r} onAbrir={setAbierto} vencidos={vencidos} />
        </section>
      ))}

      <h2>Documentos recibidos</h2>
      {proyecto.documentos.length === 0
        ? <EmptyState titulo="Sin documentos" descripcion="El expediente no tiene documentos recibidos." />
        : (
          <DocumentTable etiqueta="Documentos recibidos" conAcciones>
            {proyecto.documentos.map((d) => (
              <DocumentRow
                key={d.id} nombre={d.nombre} detalle={d.fechaVigencia ? `Vigencia: ${d.fechaVigencia}` : undefined}
                tipo={requisitoDe(d.tipo) ?? d.tipo.replaceAll('_', ' ')} canal={`${d.datos.length} dato(s) declarado(s)`}
                estado={vencidos.has(d.id) ? { texto: 'Vencido', tono: 'error' } : { texto: 'Recibido', tono: 'ok' }}
                archivo={d.archivo?.url ? 'Archivo disponible' : 'Sin archivo en la fuente'}
                acciones={<Boton tamano="sm" onClick={() => setAbierto(d.id)}>Abrir evidencia<span className="kv-solo-lectores"> de {d.nombre}</span></Boton>}
              />
            ))}
          </DocumentTable>
        )}
      <PanelEvidencia documento={documento} requisito={documento ? requisitoDe(documento.tipo) : null} onCerrar={() => setAbierto(null)} />
    </>
  );
}
