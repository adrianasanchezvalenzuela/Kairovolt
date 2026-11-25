import type { Hallazgo } from '@/domain/validacion/hallazgo';
import { DiscrepancyPanel } from './DiscrepancyPanel';
import type { ValidacionVista } from './ValidationCard';

const categoria = { discrepancia: 'Discrepancia', campo_incompleto: 'Campo incompleto', vigencia: 'Vigencia' } as const;

/** Convierte un hallazgo del dominio en el modelo de vista de `ValidationCard` (sin añadir ni cambiar reglas). */
export function aValidacionVista(h: Hallazgo): ValidacionVista {
  return {
    id: h.id,
    titulo: h.titulo,
    resultado: h.categoria === 'campo_incompleto' ? 'no_evaluable' : 'no_cumple',
    severidad: h.severidad === 'bloqueante' ? 'bloqueante' : 'mayor',
    etiquetaSeveridad: h.severidad === 'bloqueante' ? 'Bloqueante' : 'Advertencia',
    categoria: categoria[h.categoria],
    explicacion: h.detalle,
    evidencias: h.categoria === 'campo_incompleto' ? [] : h.evidencias.map((e) => ({ documento: e.documentoNombre, valor: e.valor })),
  };
}

export function HallazgosPanel({ hallazgos }: { hallazgos: readonly Hallazgo[] }) {
  return (
    <DiscrepancyPanel
      validaciones={hallazgos.map(aValidacionVista)}
      textoVacio="Los documentos del expediente son consistentes entre sí."
      nombresSeveridad={{ mayor: ['advertencia', 'advertencias'] }}
    />
  );
}
