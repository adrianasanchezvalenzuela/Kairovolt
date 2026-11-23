import { esRolUsuario, type RolUsuario } from '../../src/domain/usuarios/rol';
import type { ClienteSupabase } from './cliente';

export interface PerfilActivo {
  id: string;
  correo: string | null;
  nombre: string | null;
  rol: RolUsuario;
}

interface Fila { id: string; correo: string | null; nombre_completo: string | null; rol: string; activo: boolean }

/** Perfil ACTIVO de un usuario (null si no existe, está inactivo o su rol no es válido). */
export async function buscarPerfilActivo(cli: ClienteSupabase, uid: string): Promise<PerfilActivo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const filas = await cli.rest<Fila[]>('GET', `/perfiles?id=eq.${uid}&select=id,correo,nombre_completo,rol,activo`);
  const f = filas?.[0];
  if (!f || f.activo !== true || !esRolUsuario(f.rol)) return null;
  return { id: f.id, correo: f.correo, nombre: f.nombre_completo, rol: f.rol };
}

/**
 * Busca el perfil en cada petición, con una caché corta: un cambio de rol o una desactivación se nota en `ttlMs` como máximo.
 * Si Supabase falla, la excepción se propaga (el backend responde "no disponible"; nunca se concede acceso por defecto).
 */
export function crearBuscadorPerfiles(cli: ClienteSupabase, ahora: () => number = Date.now, ttlMs = 15_000) {
  const cache = new Map<string, { perfil: PerfilActivo | null; hasta: number }>();
  return async (uid: string): Promise<PerfilActivo | null> => {
    const c = cache.get(uid);
    if (c && c.hasta > ahora()) return c.perfil;
    const perfil = await buscarPerfilActivo(cli, uid);
    if (cache.size > 1000) cache.clear();
    cache.set(uid, { perfil, hasta: ahora() + ttlMs });
    return perfil;
  };
}
