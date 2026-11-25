import type { ProyectoRepositorio } from '@/application/proyecto-repositorio';
import { kv2026004Demo } from '@/data/kv-2026-004.demo';

/** Datos de PRUEBA: el caso demostrativo KV-2026-004. El proyecto de referencia (KV-MOCK-0001) queda solo para las pruebas del dominio. */
const proyectos = [kv2026004Demo];

export const repositorioMock: ProyectoRepositorio = {
  origen: 'mock',
  listar: async () => proyectos,
  obtenerPorId: async (id) => proyectos.find((p) => p.id === id) ?? null,
  obtenerPorFolio: async (folio) => proyectos.find((p) => p.folio === folio) ?? null,
};
