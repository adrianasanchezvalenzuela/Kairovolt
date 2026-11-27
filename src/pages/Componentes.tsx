import { useEffect, useState } from 'react';
import { DiscrepancyPanel } from '@/components/feature/DiscrepancyPanel';
import { DocumentPreview } from '@/components/feature/DocumentPreview';
import { DocumentRow, DocumentTable } from '@/components/feature/DocumentRow';
import { DocumentUploader } from '@/components/feature/DocumentUploader';
import { ProjectCard } from '@/components/feature/ProjectCard';
import { ProjectTable } from '@/components/feature/ProjectTable';
import type { ProyectoVista } from '@/components/feature/ProyectoVista';
import { StageGateStepper } from '@/components/feature/StageGateStepper';
import { ValidationCard, type ValidacionVista } from '@/components/feature/ValidationCard';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import type { Tono } from '@/components/ui/tipos';

const TONOS: Tono[] = ['neutro', 'ok', 'alerta', 'error', 'info'];

const proyectos: ProyectoVista[] = [
  { id: 'a', folio: 'KV-2026-001', nombre: 'Interconexión FV 40 kW · Panadería La Espiga', cliente: 'Panadería La Espiga', ubicacion: 'Hermosillo, Sonora', to: '/proyectos/a', avance: { recibidos: 7, total: 12 }, observaciones: { abiertas: 3, vencidas: 1 }, estado: { texto: 'G1 en revisión', tono: 'alerta' } },
  { id: 'b', folio: 'KV-2026-002', nombre: 'Interconexión FV 30 kW · Taller Ríos', cliente: 'Taller Ríos', ubicacion: 'Guaymas, Sonora', to: '/proyectos/b', avance: null, observaciones: { abiertas: 0, vencidas: 0 } },
];

const validaciones: ValidacionVista[] = [
  { id: 'v1', titulo: 'La potencia del inversor no coincide entre documentos', resultado: 'no_cumple', severidad: 'bloqueante', categoria: 'Discrepancia', explicacion: 'El memorándum técnico y la ficha del inversor declaran potencias distintas.', evidencias: [{ documento: 'Memoria técnica', valor: '40 kW', campo: 'Potencia AC' }, { documento: 'Ficha del inversor', valor: '36 kW', campo: 'Potencia nominal' }, { documento: 'Diagrama unifilar', valor: null }], accionRecomendada: 'Solicitar al proyectista confirmar cuál documento debe actualizarse.', requiereAprobacionHumana: true, reglaId: 'POT-AC-001' },
  { id: 'v2', titulo: 'Vigencia del contrato por vencer', resultado: 'no_cumple', severidad: 'mayor', etiquetaSeveridad: 'Advertencia', categoria: 'Vigencia', explicacion: 'Vence en 12 días.' },
  { id: 'v3', titulo: 'Falta el número de medidor', resultado: 'no_evaluable', severidad: 'menor', explicacion: 'El campo está vacío: no se puede comparar.' },
];

export function Componentes() {
  const [modal, setModal] = useState<null | 'info' | 'error'>(null);
  const [seleccion, setSeleccion] = useState('G1');
  const [archivos, setArchivos] = useState<string[]>([]);
  // Imagen de ejemplo generada en el navegador (blob:), sin depender de ningún archivo ni servidor.
  const [imagen, setImagen] = useState<string | null>(null);
  useEffect(() => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#e9eff2"/><circle cx="160" cy="80" r="44" fill="#f2bd55"/><path d="M0 130h320" stroke="#176b70" stroke-width="6"/></svg>';
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setImagen(url);
    return () => URL.revokeObjectURL(url);
  }, []);

  return (
    <>
      <PageHeader titulo="Sistema de componentes" meta="Galería de desarrollo. No se incluye en producción." migas={[{ etiqueta: 'Proyectos', to: '/panel' }, { etiqueta: 'Componentes' }]} acciones={<Boton variante="primario">Acción principal</Boton>} />

      <h2>StatusBadge</h2>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TONOS.map((t) => <StatusBadge key={t} tono={t}>{t}</StatusBadge>)}
        {TONOS.map((t) => <StatusBadge key={`s${t}`} tono={t} variante="suave" punto>{t}</StatusBadge>)}
        {TONOS.map((t) => <StatusBadge key={`o${t}`} tono={t} variante="solido" tamano="md">{t}</StatusBadge>)}
      </p>

      <h2>Botones</h2>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Boton variante="primario">Primario</Boton><Boton>Secundario</Boton><Boton variante="peligro">Peligro</Boton><Boton variante="fantasma">Fantasma</Boton><Boton cargando>Guardando</Boton><Boton disabled>Deshabilitado</Boton><Boton tamano="sm">Pequeño</Boton>
      </p>

      <h2>KPI</h2>
      <KPIGrid etiqueta="Ejemplos de KPI">
        <KPI etiqueta="PPC acumulado" valor="82%" detalle="9/11 actividades a tiempo" />
        <KPI etiqueta="PAER" tono="alerta" resaltarValor valor="68%" detalle="Meta >80% (no cumple)" />
        <KPI etiqueta="Observaciones vencidas" tono="error" valor="3" />
        <KPI etiqueta="Sin dato" valor={null} detalle="La fuente no lo trae" />
      </KPIGrid>

      <h2>AlertPanel</h2>
      {TONOS.filter((t) => t !== 'neutro').map((t) => <AlertPanel key={t} tono={t} titulo={`Aviso ${t}`} acciones={<Boton tamano="sm">Acción</Boton>}>Texto del aviso con contexto suficiente para entender qué ocurrió.</AlertPanel>)}

      <h2>Estados</h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <EmptyState titulo="Sin documentos" descripcion="Aún no se ha recibido ningún documento." acciones={<Boton variante="primario">Subir documento</Boton>} />
        <LoadingState etiqueta="Cargando expediente…" />
        <ErrorState titulo="No se pudo cargar" descripcion="Revisa tu conexión." detalle="Zoho respondió 503" onReintentar={() => undefined} />
      </div>

      <h2>StageGateStepper</h2>
      <StageGateStepper
        etiqueta="Ejemplo de compuertas" seleccionadoId={seleccion} onSeleccionar={setSeleccion}
        pasos={[
          { id: 'G0', titulo: 'Alta del proyecto', tono: 'ok', estado: 'Liberada', progreso: '4/4 documentos' },
          { id: 'G1', titulo: 'Acopio legal y técnico', tono: 'alerta', estado: 'En revisión', progreso: '7/12 documentos' },
          { id: 'G2', titulo: 'Validación', tono: 'neutro', estado: 'Pendiente', progreso: '0/6 documentos' },
          { id: 'G3', titulo: 'Energización', tono: 'error', estado: 'Bloqueada', progreso: '—' },
        ]}
      />

      <h2>Timeline</h2>
      <Timeline etiqueta="Ejemplo de línea de tiempo" eventos={[
        { id: '1', fecha: '2026-11-02', titulo: 'Alta del proyecto', tono: 'ok', hecho: true, estado: <StatusBadge tono="ok">Completada</StatusBadge> },
        { id: '2', fecha: '2026-11-09', titulo: 'Acopio de documentos', descripcion: 'Faltan 5 documentos obligatorios.', tono: 'alerta', estado: <StatusBadge tono="alerta">En curso</StatusBadge> },
        { id: '3', fecha: '2026-11-20', titulo: 'Solicitud a CFE' },
      ]} />

      <h2>ValidationCard y DiscrepancyPanel</h2>
      <ValidationCard validacion={{ ...validaciones[0]!, id: 'solo' }} />
      <div style={{ height: 12 }} />
      <DiscrepancyPanel validaciones={validaciones} nombresSeveridad={{ mayor: ['advertencia', 'advertencias'] }} />

      <h2>ProjectTable y ProjectCard</h2>
      <ProjectTable proyectos={proyectos} />
      <div style={{ height: 12 }} />
      <ul className="kv-tarjetas">{proyectos.map((p) => <li key={p.id}><ProjectCard proyecto={p} /></li>)}</ul>

      <h2>DocumentTable, DocumentRow, DocumentUploader</h2>
      <DocumentTable etiqueta="Ejemplo de documentos" conAcciones>
        <DocumentRow nombre="Acta constitutiva" detalle="Vigente hasta 2027-05-01" tipo="Obligatorio" canal="Digital" estado={{ texto: 'Recibido', tono: 'ok' }} archivo="acta.pdf" acciones={<Boton tamano="sm">Ver</Boton>} />
        <DocumentRow nombre="Contrato de interconexión" tipo="Obligatorio" canal={<StatusBadge tono="alerta">Físico / firma</StatusBadge>} estado={{ texto: 'Faltante', tono: 'error' }} acciones={<Boton tamano="sm">Subir</Boton>} />
      </DocumentTable>
      <div style={{ height: 12 }} />
      <DocumentUploader multiple aceptar={['.pdf', 'image/*']} maxBytes={10 * 1024 * 1024} onArchivos={(f) => setArchivos(f.map((x) => x.name))} />
      {archivos.length > 0 && <p className="kv-suave">Seleccionados (no se suben desde esta galería): {archivos.join(', ')}</p>}

      <h2>DocumentPreview</h2>
      <DocumentPreview nombre="foto-medidor.svg" mime="image/svg+xml" altura={160} url={imagen} />
      <div style={{ height: 12 }} />
      <DocumentPreview nombre="sin-archivo.pdf" url={null} altura={140} />

      <h2>ConfirmationModal</h2>
      <p style={{ display: 'flex', gap: 8 }}>
        <Boton onClick={() => setModal('info')}>Confirmación normal</Boton>
        <Boton variante="peligro" onClick={() => setModal('error')}>Acción destructiva</Boton>
      </p>
      <ConfirmationModal abierto={modal === 'info'} titulo="Escribir en Zoho" tono="alerta" confirmarTexto="Escribir" onConfirmar={() => setModal(null)} onCancelar={() => setModal(null)}>
        <p>Se actualizará la compuerta G1 en Zoho Projects.</p>
      </ConfirmationModal>
      <ConfirmationModal abierto={modal === 'error'} titulo="Desactivar usuario" tono="error" confirmarTexto="Desactivar" onConfirmar={() => setModal(null)} onCancelar={() => setModal(null)}>
        <p>Perderá todo acceso.</p>
      </ConfirmationModal>
    </>
  );
}
