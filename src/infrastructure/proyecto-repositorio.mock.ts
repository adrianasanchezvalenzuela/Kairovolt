import type { ProyectoRepositorio } from '@/application/proyecto-repositorio';
import { proyectoReferenciaMock } from '@/data/proyecto-referencia.mock';

const proyectos = [proyectoReferenciaMock];

export const repositorioMock: ProyectoRepositorio = {
  origen: 'mock',
  listar: async () => proyectos,
  obtenerPorId: async (id) => proyectos.find((p) => p.id === id) ?? null,
  obtenerPorFolio: async (folio) => proyectos.find((p) => p.folio === folio) ?? null,
};
