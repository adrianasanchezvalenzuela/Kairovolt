import type { Requisito } from '@/domain/checklist/checklist';
import { catalogoDeDemostracion } from '../../server/catalogo';
import { comoRequisitoChecklist, type RequisitoDocumental } from '@/domain/checklist/catalogo';

let respuestaEnCache: Promise<RequisitoDocumental[]> | null = null;
/** Modo demostración aislado: sin sesión real ni Zoho se usa el catálogo ficticio local (sin llamadas a /api/admin). */
let modoLocal = false;

async function obtenerCatalogo(): Promise<RequisitoDocumental[]> {
  const res = await fetch('/api/admin/catalogo', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({})) as { requisitos?: RequisitoDocumental[]; error?: string; detalle?: string };
  if (data.error === 'catalogo_migracion_pendiente' && data.detalle) throw new Error(data.detalle);
  if (!res.ok || !Array.isArray(data.requisitos)) throw new Error(data.error === 'supabase_no_configurado'
    ? 'El catálogo documental no está disponible porque Supabase no está configurado.'
    : 'No se pudo consultar el catálogo documental.');
  return data.requisitos;
}

/** En aplicación el dominio consulta el catálogo servido por backend; el mock queda para tests y demos del servidor. */
export const catalogoRepositorio = {
  /** Lo activa FuenteDatos solo cuando la fuente es MOCK y no hay sesión real; el panel lo rotula como «Datos MOCK». */
  usarLocal(activo: boolean): void { if (modoLocal !== activo) { modoLocal = activo; respuestaEnCache = null; } },
  listar(): Promise<Requisito[]> {
    if (modoLocal) return Promise.resolve(catalogoDeDemostracion(false).filter((r) => r.activo && r.tipo && r.compuerta).map(comoRequisitoChecklist));
    respuestaEnCache ??= obtenerCatalogo().catch((e: unknown) => { respuestaEnCache = null; throw e; });
    return respuestaEnCache.then((catalogo) => catalogo.filter((r) => r.activo && r.tipo && r.compuerta).map(comoRequisitoChecklist));
  },
  listarAdministrativo(): Promise<RequisitoDocumental[]> {
    if (modoLocal) return Promise.resolve(catalogoDeDemostracion(false));
    respuestaEnCache ??= obtenerCatalogo().catch((e: unknown) => { respuestaEnCache = null; throw e; });
    return respuestaEnCache;
  },
  invalidar(): void { respuestaEnCache = null; },
};
