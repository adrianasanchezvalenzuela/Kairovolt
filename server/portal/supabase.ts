import { randomUUID } from 'node:crypto';
import type { Recepcion } from '../../src/application/portal-cliente';
import type { SupabaseConfig } from '../config';
import { generarCodigo, huellaCodigo } from './codigo';
import type { AccesoPortal, AccesosPortal, AlmacenPortal, NuevaRecepcion, RecepcionesPortal } from './tipos';
import type { ClienteSupabase } from '../supabase/cliente';

const q = encodeURIComponent;

interface FilaAcceso {
  id: string;
  permisos: AccesoPortal['permisos'];
  activo: boolean;
  expira_at: string;
  revocado_at: string | null;
  ultimo_uso_at: string | null;
  created_at: string;
  proyectos: { folio: string } | { folio: string }[] | null;
}

const SELECT = 'id,permisos,activo,expira_at,revocado_at,ultimo_uso_at,created_at,proyectos(folio)';
const folioDe = (f: FilaAcceso) => (Array.isArray(f.proyectos) ? f.proyectos[0]?.folio : f.proyectos?.folio) ?? null;

/** Accesos en `portal_accesos` (solo el hash del código; el código en claro no se guarda nunca). */
export function crearAccesosSupabase(sb: ClienteSupabase, ahora: () => number = Date.now): AccesosPortal {
  const vigente = (f: FilaAcceso) => f.activo && f.revocado_at === null && Date.parse(f.expira_at) > ahora();
  const aAcceso = (f: FilaAcceso, folio: string): AccesoPortal => ({ id: f.id, folio, permisos: f.permisos, expiraEn: f.expira_at, creadoEn: f.created_at, ultimoUso: f.ultimo_uso_at });

  return {
    async crear(folio, o) {
      // El proyecto debe existir en Supabase (la tabla pide la llave foránea): se crea el registro mínimo del folio si falta.
      const p = await sb.rest<{ id: string }[]>('POST', '/proyectos?on_conflict=folio&select=id', { folio }, 'resolution=merge-duplicates,return=representation');
      const proyectoId = p?.[0]?.id;
      if (!proyectoId) throw new Error('No se pudo registrar el proyecto en Supabase.');
      const codigo = generarCodigo();
      const expira = new Date(ahora() + o.dias * 86_400_000).toISOString();
      const filas = await sb.rest<FilaAcceso[]>('POST', `/portal_accesos?select=${SELECT}`, {
        proyecto_id: proyectoId, token_hash: huellaCodigo(codigo), permisos: o.permisos, expira_at: expira, created_by: o.creadoPor,
      }, 'return=representation');
      const fila = filas?.[0];
      if (!fila) throw new Error('No se pudo crear el acceso.');
      return { acceso: aAcceso(fila, folio), codigo };
    },
    async verificar(folio, codigo) {
      const filas = await sb.rest<FilaAcceso[]>('GET', `/portal_accesos?token_hash=eq.${huellaCodigo(codigo)}&select=${SELECT}&limit=1`);
      const f = filas?.[0];
      if (!f || !vigente(f) || folioDe(f) !== folio) return null;
      void sb.rest('PATCH', `/portal_accesos?id=eq.${f.id}`, { ultimo_uso_at: new Date(ahora()).toISOString() }).catch(() => undefined); // mejor esfuerzo
      return aAcceso(f, folio);
    },
    async obtener(id) {
      const filas = await sb.rest<FilaAcceso[]>('GET', `/portal_accesos?id=eq.${q(id)}&select=${SELECT}&limit=1`);
      const f = filas?.[0];
      const folio = f ? folioDe(f) : null;
      return f && folio && vigente(f) ? aAcceso(f, folio) : null;
    },
    async listar(folio) {
      const filas = await sb.rest<FilaAcceso[]>('GET', `/portal_accesos?select=${SELECT.replace('proyectos(folio)', 'proyectos!inner(folio)')}&proyectos.folio=eq.${q(folio)}&order=created_at.desc`);
      return (filas ?? []).filter(vigente).map((f) => aAcceso(f, folio));
    },
    async revocar(id, por) {
      const r = await sb.rest<{ id: string }[]>('PATCH', `/portal_accesos?id=eq.${q(id)}&select=id`, { activo: false, revocado_at: new Date(ahora()).toISOString(), revocado_por: por }, 'return=representation');
      return (r?.length ?? 0) > 0;
    },
  };
}

interface FilaRecepcion {
  recibo: string; documento_id: string; documento_nombre: string; archivo_nombre: string; creado_en: string;
  estado: Recepcion['estado']; motivo_rechazo: string | null;
}
const aRecepcion = (f: FilaRecepcion): Recepcion => ({ recibo: f.recibo, documentoId: f.documento_id, documento: f.documento_nombre, archivo: f.archivo_nombre, fecha: f.creado_en, estado: f.estado, motivo: f.motivo_rechazo });

/** Recepciones en `portal_recepciones` (migración 007). */
export function crearRecepcionesSupabase(sb: ClienteSupabase): RecepcionesPortal {
  return {
    async listar(folio) {
      const filas = await sb.rest<FilaRecepcion[]>('GET', `/portal_recepciones?folio=eq.${q(folio)}&select=recibo,documento_id,documento_nombre,archivo_nombre,creado_en,estado,motivo_rechazo&order=creado_en.desc&limit=200`);
      return (filas ?? []).map(aRecepcion);
    },
    async registrar(r: NuevaRecepcion) {
      const recibo = `REC-${randomUUID().slice(0, 6).toUpperCase()}`;
      const filas = await sb.rest<FilaRecepcion[]>('POST', '/portal_recepciones?select=recibo,documento_id,documento_nombre,archivo_nombre,creado_en,estado,motivo_rechazo', {
        recibo, folio: r.folio, acceso_id: r.accesoId, documento_id: r.documentoId, documento_nombre: r.documento, archivo_nombre: r.archivo,
        mime: r.mime, tamano_bytes: r.tamano, sha256: r.sha256, ruta_almacen: r.rutaAlmacen,
      }, 'return=representation');
      const fila = filas?.[0];
      if (!fila) throw new Error('No se pudo registrar la recepción.');
      return aRecepcion(fila);
    },
  };
}

/** Bucket PRIVADO `expedientes` de Supabase Storage. No se generan enlaces públicos. */
export function crearAlmacenSupabase(cfg: SupabaseConfig, fetchFn: typeof fetch = fetch): AlmacenPortal {
  return {
    async guardar(ruta, contenido, mime) {
      const segura = ruta.split('/').map(encodeURIComponent).join('/');
      let res: Response;
      try {
        res = await fetchFn(`${cfg.url}/storage/v1/object/expedientes/${segura}`, {
          method: 'POST',
          headers: { apikey: cfg.secretKey, 'Content-Type': mime, 'x-upsert': 'false' },
          body: contenido as unknown as BodyInit,
        });
      } catch {
        throw new Error('No se pudo contactar al almacenamiento.');
      }
      if (!res.ok) throw new Error(`El almacenamiento respondió ${res.status}.`);
    },
  };
}
