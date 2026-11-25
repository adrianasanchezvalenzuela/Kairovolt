import type { VersionParticipantes } from '../../src/application/participantes';
import type { ClienteSupabase } from '../supabase/cliente';
import type { AccesoPortal } from './tipos';

export function crearParticipantesSupabase(sb: ClienteSupabase) {
  return {
    async consultar({ folio }: AccesoPortal): Promise<VersionParticipantes | null> {
      const filas = await sb.rest<VersionParticipantes[]>('GET',
        '/expediente_participantes_versiones?select=version,datos,confirmado,proyectos!inner()' +
        '&proyectos.folio=eq.' + encodeURIComponent(folio) + '&order=version.desc&limit=1');
      return filas[0] ?? null;
    },
    guardar({ id, folio }: AccesoPortal, entrada: VersionParticipantes): Promise<VersionParticipantes> {
      return sb.rest('POST', '/rpc/guardar_participantes', {
        p_folio: folio, p_acceso: id, p_version: entrada.version, p_datos: entrada.datos, p_confirmado: entrada.confirmado,
      });
    },
  };
}

export type ParticipantesPortal = ReturnType<typeof crearParticipantesSupabase>;
