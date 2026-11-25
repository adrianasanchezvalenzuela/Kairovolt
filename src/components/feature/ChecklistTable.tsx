import type { ResumenCompuerta } from '@/domain/checklist/checklist';
import { Boton } from '@/components/ui/Boton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DocumentRow, DocumentTable } from './DocumentRow';

interface Props {
  resumen: ResumenCompuerta;
  /** Si se da, cada documento recibido muestra «Ver» (abre su evidencia). */
  onAbrir?: (documentoId: string) => void;
  /** Ids de documentos con la vigencia vencida (se muestran como «Vencido»). */
  vencidos?: ReadonlySet<string>;
}

/** Requisitos de una compuerta contra los documentos recibidos. No decide si la compuerta puede avanzar: eso lo hace el dominio. */
export function ChecklistTable({ resumen, onAbrir, vencidos }: Props) {
  return (
    <DocumentTable etiqueta={`Checklist ${resumen.compuerta}`} conAcciones={Boolean(onAbrir)} {...(resumen.items.length === 0 && { vacio: `Sin requisitos definidos para ${resumen.compuerta}.` })}>
      {resumen.items.map(({ requisito, documento }) => (
        <DocumentRow
          key={requisito.id}
          nombre={requisito.nombre}
          tipo={requisito.obligatorio ? 'Obligatorio' : <span title={requisito.condicion}>Condicional</span>}
          canal={requisito.canal === 'fisico' ? <StatusBadge tono="alerta">Físico / firma</StatusBadge> : 'Digital'}
          estado={!documento ? { texto: 'Faltante', tono: requisito.obligatorio ? 'error' : 'neutro' } : vencidos?.has(documento.id) ? { texto: 'Vencido', tono: 'error' } : { texto: 'Recibido', tono: 'ok' }}
          archivo={documento?.nombre ?? requisito.condicion ?? '—'}
          {...(onAbrir && { acciones: documento ? <Boton tamano="sm" onClick={() => onAbrir(documento.id)}>Ver<span className="kv-solo-lectores"> {documento.nombre}</span></Boton> : null })}
        />
      ))}
    </DocumentTable>
  );
}
