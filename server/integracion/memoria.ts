import type { ReferenciaExterna, RegistroSync, RepositorioReferencias, RepositorioSincronizaciones } from '../../src/application/integracion/puertos';

/** Registro en memoria: se pierde al reiniciar. Sirve para el modo DEMO y como respaldo cuando no hay Supabase. */
export function crearRegistroMemoria(): RepositorioSincronizaciones & { todos: RegistroSync[] } {
  const todos: RegistroSync[] = [];
  return {
    todos,
    async buscarExitosa(clave) {
      return todos.find((r) => r.clave === clave && r.estado === 'ok') ?? null;
    },
    async registrar(r) {
      todos.push({ ...r });
    },
    async recientes({ folio, limite = 50 } = {}) {
      return todos.filter((r) => !folio || r.folio === folio).slice(-limite).reverse();
    },
  };
}

export function crearReferenciasMemoria(): RepositorioReferencias {
  const mapa = new Map<string, ReferenciaExterna>();
  const k = (folio: string, sistema: string, tipo: string) => `${folio}|${sistema}|${tipo}`;
  return {
    async guardar(ref) {
      mapa.set(k(ref.folio, ref.sistema, ref.tipo), { ...ref });
    },
    async obtener(folio, sistema, tipo) {
      return mapa.get(k(folio, sistema, tipo)) ?? null;
    },
    async listar(folio) {
      return [...mapa.values()].filter((r) => r.folio === folio);
    },
  };
}
