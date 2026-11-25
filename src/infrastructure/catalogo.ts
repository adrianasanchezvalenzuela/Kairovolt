import type { Requisito } from '@/domain/checklist/checklist';
import { comoRequisitoChecklist, type RequisitoDocumental } from '@/domain/checklist/catalogo';

let respuestaEnCache: Promise<RequisitoDocumental[]> | null = null;

async function obtenerCatalogo(): Promise<RequisitoDocumental[]> {
  const res = await fetch('/api/admin/catalogo', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({})) as { requisitos?: RequisitoDocumental[]; error?: string };
  if (!res.ok || !Array.isArray(data.requisitos)) throw new Error(data.error === 'supabase_no_configurado'
    ? 'El catálogo documental no está disponible porque Supabase no está configurado.'
    : 'No se pudo consultar el catálogo documental.');
  return data.requisitos;
}

/** En aplicación el dominio consulta el catálogo servido por backend; el mock queda para tests y demos del servidor. */
export const catalogoRepositorio = {
  listar(): Promise<Requisito[]> {
    respuestaEnCache ??= obtenerCatalogo().catch((e: unknown) => { respuestaEnCache = null; throw e; });
    return respuestaEnCache.then((catalogo) => catalogo.filter((r) => r.activo && r.tipo && r.compuerta).map(comoRequisitoChecklist));
  },
  listarAdministrativo(): Promise<RequisitoDocumental[]> {
    respuestaEnCache ??= obtenerCatalogo().catch((e: unknown) => { respuestaEnCache = null; throw e; });
    return respuestaEnCache;
  },
  invalidar(): void { respuestaEnCache = null; },
};
