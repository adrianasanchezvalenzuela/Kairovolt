import type { ProgresoPreparacion } from '../../src/domain/checklist/preparacion';
import type { ClienteSupabase } from '../supabase/cliente';
import type { AccesoPortal } from './tipos';
import type { Notificacion } from '../../src/application/portal-cliente';

export interface PreparacionPortal {
  listar(acceso: AccesoPortal): Promise<ProgresoPreparacion[]>;
  guardar(acceso: AccesoPortal, entrada: ProgresoPreparacion): Promise<ProgresoPreparacion>;
  entregas?(acceso: AccesoPortal): Promise<Notificacion[]>;
}

export function crearPreparacionSupabase(sb: ClienteSupabase): PreparacionPortal {
  return {
    async entregas(a) {
      const filas = await sb.rest<{ id: number; documento: string; fecha: string; tipo: string }[]>('GET',
        '/portal_eventos_documentales?select=id,documento,fecha,tipo&tipo=in.(entregado,validado_fisico)&folio=eq.' +
        encodeURIComponent(a.folio) + '&order=fecha.desc&limit=20');
      return filas.map((f) => ({ id: 'entrega:' + f.id, tipo: 'recepcion', fecha: f.fecha, detalle: null,
        titulo: (f.tipo === 'entregado' ? 'Entrega física registrada: ' : 'Validamos el documento físico: ') + f.documento }));
    },
    listar: (a) => sb.rest('GET', '/portal_preparacion?select=documento,marcadas,preparado,proyectos!inner()&proyectos.folio=eq.' + encodeURIComponent(a.folio)),
    guardar: (a, p) => sb.rest('POST', '/rpc/guardar_preparacion_portal', {
      p_acceso: a.id, p_folio: a.folio, p_documento: p.documento, p_marcadas: p.marcadas, p_preparado: p.preparado,
    }),
  };
}

export function crearPreparacionDemo(): PreparacionPortal {
  const folios = new Map<string, Map<string, ProgresoPreparacion>>();
  return {
    async listar(a) { return [...(folios.get(a.folio)?.values() ?? [])]; },
    async guardar(a, p) {
      const lista = folios.get(a.folio) ?? new Map<string, ProgresoPreparacion>();
      lista.set(p.documento, p);
      folios.set(a.folio, lista);
      return p;
    },
  };
}
