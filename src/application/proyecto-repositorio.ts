import type { Proyecto } from '@/domain/proyecto/proyecto';

/** Puerto: la UI depende de esto, no de Zoho ni de mocks. */
export interface ProyectoRepositorio {
  readonly origen: 'mock' | 'zoho';
  listar(): Promise<Proyecto[]>;
  obtenerPorId(id: string): Promise<Proyecto | null>;
  obtenerPorFolio(folio: string): Promise<Proyecto | null>;
}
