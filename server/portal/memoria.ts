import { randomUUID } from 'node:crypto';
import type { Recepcion } from '../../src/application/portal-cliente';
import { PERMISOS_PORTAL_POR_DEFECTO } from '../../src/application/portal-cliente';
import { kv2026004Demo } from '../../src/data/kv-2026-004.demo';
import { generarCodigo, huellaCodigo } from './codigo';
import type { AccesoPortal, AccesosPortal, AlmacenPortal, FuenteProyectoPortal, NuevaRecepcion, RecepcionesPortal } from './tipos';

/**
 * Adaptadores EN MEMORIA, solo para el modo DEMO (sin Supabase o con PORTAL_MODO_DEMO). Nada se guarda en disco ni en la nube:
 * se pierde al reiniciar. Los archivos subidos NO se conservan (solo se registra su recepción).
 */

/** Código de acceso del caso demostrativo. SOLO funciona en modo demo y da acceso a datos de prueba. */
export const CODIGO_DEMO = 'DEMO-KV26-004P-ORTL';
export const FOLIO_DEMO = kv2026004Demo.folio;

interface Fila extends AccesoPortal { huella: string; revocado: boolean }

export function crearAccesosMemoria(ahora: () => number = Date.now, sembrarDemo = false): AccesosPortal {
  const filas = new Map<string, Fila>();
  const vigente = (f: Fila) => !f.revocado && Date.parse(f.expiraEn) > ahora();
  const publico = ({ huella: _h, revocado: _r, ...a }: Fila): AccesoPortal => a;
  const alta = (folio: string, codigo: string, permisos: AccesoPortal['permisos'], dias: number): Fila => {
    const fila: Fila = { id: randomUUID(), folio, permisos, expiraEn: new Date(ahora() + dias * 86_400_000).toISOString(), creadoEn: new Date(ahora()).toISOString(), ultimoUso: null, huella: huellaCodigo(codigo), revocado: false };
    filas.set(fila.id, fila);
    return fila;
  };
  if (sembrarDemo) alta(FOLIO_DEMO, CODIGO_DEMO, PERMISOS_PORTAL_POR_DEFECTO, 3650);

  return {
    async crear(folio, o) {
      const codigo = generarCodigo();
      return { acceso: publico(alta(folio, codigo, o.permisos, o.dias)), codigo };
    },
    async verificar(folio, codigo) {
      const f = [...filas.values()].find((x) => x.huella === huellaCodigo(codigo));
      if (!f || f.folio !== folio || !vigente(f)) return null;
      f.ultimoUso = new Date(ahora()).toISOString();
      return publico(f);
    },
    async obtener(id) {
      const f = filas.get(id);
      return f && vigente(f) ? publico(f) : null;
    },
    async listar(folio) {
      return [...filas.values()].filter((f) => f.folio === folio && vigente(f)).map(publico);
    },
    async revocar(id) {
      const f = filas.get(id);
      if (!f) return false;
      f.revocado = true;
      return true;
    },
  };
}

export function crearRecepcionesMemoria(ahora: () => number = Date.now): RecepcionesPortal {
  const lista: (Recepcion & { folio: string })[] = [];
  return {
    async listar(folio) {
      return lista.filter((r) => r.folio === folio).map(({ folio: _f, ...r }) => r);
    },
    async registrar(r: NuevaRecepcion) {
      const recepcion = { folio: r.folio, recibo: `REC-${randomUUID().slice(0, 6).toUpperCase()}`, documentoId: r.documentoId, documento: r.documento, archivo: r.archivo, fecha: new Date(ahora()).toISOString(), estado: 'recibido' as const, motivo: null };
      lista.push(recepcion);
      const { folio: _f, ...publica } = recepcion;
      return publica;
    },
  };
}

/** Descarta el contenido: en demo no se guardan archivos. */
export const almacenDescarte: AlmacenPortal = { async guardar() { /* demo: no se guarda nada */ } };

export const fuenteDemo: FuenteProyectoPortal = {
  modo: 'demo',
  async obtener(folio) {
    return folio === FOLIO_DEMO ? kv2026004Demo : null;
  },
};
