import type {
  AccionSync, DestinoSync, ReferenciaExterna, RegistroSync, RepositorioReferencias, RepositorioSincronizaciones, Sistema,
} from '../../src/application/integracion/puertos';
import type { ClienteSupabase } from '../supabase/cliente';

/** Filas de las tablas `sincronizaciones` y `referencias_externas` (migración 006). */
interface FilaSync {
  id: string; clave: string; folio: string; destino: DestinoSync; operacion: string; estado: RegistroSync['estado']; accion: AccionSync | null;
  id_externo: string | null; error: string | null; categoria_error: string | null; intentos: number; creado_en: string;
}
interface FilaRef { folio: string; sistema: Sistema; tipo: string; id_externo: string; url: string | null }

const aRegistro = (f: FilaSync): RegistroSync => ({
  id: f.id, clave: f.clave, folio: f.folio, destino: f.destino, operacion: f.operacion, estado: f.estado, accion: f.accion, idExterno: f.id_externo,
  error: f.error, categoriaError: f.categoria_error, intentos: f.intentos, creadoEn: f.creado_en,
});
const aFila = (r: RegistroSync): FilaSync => ({
  id: r.id, clave: r.clave, folio: r.folio, destino: r.destino, operacion: r.operacion, estado: r.estado, accion: r.accion, id_externo: r.idExterno,
  error: r.error, categoria_error: r.categoriaError, intentos: r.intentos, creado_en: r.creadoEn,
});
const aRef = (f: FilaRef): ReferenciaExterna => ({ folio: f.folio, sistema: f.sistema, tipo: f.tipo, idExterno: f.id_externo, url: f.url });
const q = encodeURIComponent;

/** Registro persistente en Supabase (bitácora append-only: la base impide editar o borrar filas). */
export function crearRegistroSupabase(sb: ClienteSupabase): RepositorioSincronizaciones {
  return {
    async buscarExitosa(clave) {
      const filas = await sb.rest<FilaSync[]>('GET', `/sincronizaciones?clave=eq.${q(clave)}&estado=eq.ok&select=*&limit=1`);
      return filas?.[0] ? aRegistro(filas[0]) : null;
    },
    async registrar(r) {
      await sb.rest('POST', '/sincronizaciones', aFila(r));
    },
    async recientes({ folio, limite = 50 } = {}) {
      const filtro = folio ? `&folio=eq.${q(folio)}` : '';
      const filas = await sb.rest<FilaSync[]>('GET', `/sincronizaciones?select=*&order=creado_en.desc&limit=${Math.min(200, limite)}${filtro}`);
      return (filas ?? []).map(aRegistro);
    },
  };
}

/** Referencias externas persistentes: un folio apunta a su trato de CRM, proyecto de Projects y carpeta de WorkDrive. */
export function crearReferenciasSupabase(sb: ClienteSupabase): RepositorioReferencias {
  const una = `folio=eq.%F&sistema=eq.%S&tipo=eq.%T`;
  return {
    async guardar(ref) {
      const fila: FilaRef = { folio: ref.folio, sistema: ref.sistema, tipo: ref.tipo, id_externo: ref.idExterno, url: ref.url ?? null };
      await sb.rest('POST', '/referencias_externas?on_conflict=folio,sistema,tipo', fila, 'resolution=merge-duplicates');
    },
    async obtener(folio, sistema, tipo) {
      const filtro = una.replace('%F', q(folio)).replace('%S', q(sistema)).replace('%T', q(tipo));
      const filas = await sb.rest<FilaRef[]>('GET', `/referencias_externas?${filtro}&select=*&limit=1`);
      return filas?.[0] ? aRef(filas[0]) : null;
    },
    async listar(folio) {
      return ((await sb.rest<FilaRef[]>('GET', `/referencias_externas?folio=eq.${q(folio)}&select=*`)) ?? []).map(aRef);
    },
  };
}
