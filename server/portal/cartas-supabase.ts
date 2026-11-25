import type { SupabaseConfig } from '../config';
import type { ClienteSupabase } from '../supabase/cliente';
import { SupabaseError } from '../supabase/cliente';
import { firmarArchivo } from '../archivos-expediente';
import type { AccesoPortal, AlmacenPortal } from './tipos';
import type { generarCartaDemo } from './carta-demo';

export function crearCartasSupabase(sb: ClienteSupabase, cfg: SupabaseConfig, almacen: AlmacenPortal, fetchFn: typeof fetch) {
  return {
    async guardar(acceso: AccesoPortal, r: Awaited<ReturnType<typeof generarCartaDemo>>) {
      const ruta = acceso.folio + '/generados/demo/' + r.id + '.pdf';
      await almacen.guardar(ruta, r.bytes, 'application/pdf');
      try {
        await sb.rest('POST', '/rpc/registrar_carta_demo_portal', { p_folio: acceso.folio, p_acceso: acceso.id,
          p_meta: { id: r.id, version: r.snapshot.version.version, fecha: r.fecha, plantilla: r.plantilla,
            proyecto: r.snapshot.proyecto, sha256: r.sha256, ruta } });
      } catch (e) {
        if (e instanceof SupabaseError && e.codigo && /^(22|23|40|42|PGRST)/.test(e.codigo)) {
          await almacen.retirar?.(ruta).catch(() => undefined);
        }
        throw e;
      }
    },
    async enlazar(acceso: AccesoPortal, id: string) {
      const filas = await sb.rest<{ ruta_privada: string }[]>('GET',
        '/portal_documentos_generados?select=ruta_privada,proyectos!inner()&proyectos.folio=eq.' +
        encodeURIComponent(acceso.folio) + '&id=eq.' + encodeURIComponent(id) + '&limit=1');
      const ruta = filas[0]?.ruta_privada;
      return ruta === acceso.folio + '/generados/demo/' + id + '.pdf' ? firmarArchivo(cfg, fetchFn, ruta) : null;
    },
    async listar(acceso: AccesoPortal) {
      return sb.rest<{ id: string; plantilla: string; generado_en: string }[]>('GET',
        '/portal_documentos_generados?select=id,plantilla,generado_en,proyectos!inner()&proyectos.folio=eq.' +
        encodeURIComponent(acceso.folio) + '&order=generado_en.desc&limit=20');
    },
  };
}
export type CartasSupabase = ReturnType<typeof crearCartasSupabase>;
