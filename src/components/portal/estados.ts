import type { EstadoDocumentoCliente } from '@/application/portal-cliente';
import type { Tono } from '@/components/ui/tipos';

/** Cómo se le nombra al cliente cada estado de un documento. */
export const ESTADO_DOCUMENTO: Readonly<Record<EstadoDocumentoCliente, { texto: string; tono: Tono }>> = {
  pendiente: { texto: 'Por entregar', tono: 'alerta' },
  rechazado: { texto: 'Hay que enviarlo de nuevo', tono: 'error' },
  vencido: { texto: 'Vencido', tono: 'error' },
  por_vencer: { texto: 'Por vencer', tono: 'alerta' },
  en_revision: { texto: 'En revisión', tono: 'info' },
  recibido: { texto: 'Recibido', tono: 'ok' },
  aceptado: { texto: 'Aceptado', tono: 'ok' },
};

/** Estados en los que el cliente tiene que hacer algo. */
export const REQUIERE_ACCION: readonly EstadoDocumentoCliente[] = ['pendiente', 'rechazado', 'vencido'];

export const FORMATOS_SUBIDA = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;
export const MAX_BYTES_SUBIDA = 10 * 1024 * 1024;
