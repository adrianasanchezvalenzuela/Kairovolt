import type { ProgresoPreparacion } from '../../src/domain/checklist/preparacion';
import type { ClienteSupabase } from '../supabase/cliente';
import type { AccesoPortal } from './tipos';
import type { Notificacion } from '../../src/application/portal-cliente';
import { demosPortal } from '../../src/data/demos-portal';

export interface PreparacionPortal {
  listar(acceso: AccesoPortal): Promise<ProgresoPreparacion[]>;
  guardar(acceso: AccesoPortal, entrada: ProgresoPreparacion): Promise<ProgresoPreparacion>;
  entregas?(acceso: AccesoPortal): Promise<Notificacion[]>;
  entregasRegistradas?(acceso: AccesoPortal): Promise<string[]>;
}

export function crearPreparacionSupabase(sb: ClienteSupabase): PreparacionPortal {
  return {
    async entregas(a) {
      const filas = await sb.rest<{ id: number; documento: string; fecha: string; tipo: string }[]>(
        'GET',
        '/portal_eventos_documentales?select=id,documento,fecha,tipo&tipo=in.(entregado,validado_fisico)&folio=eq.' +
          encodeURIComponent(a.folio) +
          '&order=fecha.desc&limit=20',
      );
      return filas.map((f) => ({
        id: 'entrega:' + f.id,
        tipo: 'recepcion',
        fecha: f.fecha,
        detalle: null,
        titulo: (f.tipo === 'entregado' ? 'Entrega física registrada: ' : 'Validamos el documento físico: ') + f.documento,
      }));
    },
    async entregasRegistradas(a) {
      const filas = await sb.rest<{ requisitos_documentales: { tipo_documento: string | null } | null }[]>(
        'GET',
        '/portal_entregas_fisicas?select=requisitos_documentales(tipo_documento),proyectos!inner()&proyectos.folio=eq.' +
          encodeURIComponent(a.folio),
      ).catch(() => []);
      return filas.map((f) => f.requisitos_documentales?.tipo_documento).filter((t): t is string => !!t);
    },
    listar: (a) => sb.rest('GET', '/portal_preparacion?select=documento,marcadas,preparado,proyectos!inner()&proyectos.folio=eq.' + encodeURIComponent(a.folio)),
    guardar: (a, p) => sb.rest('POST', '/rpc/guardar_preparacion_portal', {
      p_acceso: a.id, p_folio: a.folio, p_documento: p.documento, p_marcadas: p.marcadas, p_preparado: p.preparado,
    }),
  };
}

export function crearPreparacionDemo(incluirDemos = false): PreparacionPortal {
  const folios = new Map<string, Map<string, ProgresoPreparacion>>();
  if (incluirDemos) {
    // En Demo 2 (KV-2026-005), Certificados UL inicia marcado como preparado por el cliente para demostrar todos los estados.
    const demo2 = new Map<string, ProgresoPreparacion>();
    demo2.set('certificado', { documento: 'certificado', marcadas: [0, 1, 2], preparado: true });
    folios.set(demosPortal[1].folio, demo2);
  }
  return {
    async listar(a) { return [...(folios.get(a.folio)?.values() ?? [])]; },
    async guardar(a, p) {
      const lista = folios.get(a.folio) ?? new Map<string, ProgresoPreparacion>();
      lista.set(p.documento, p);
      folios.set(a.folio, lista);
      return p;
    },
    async entregasRegistradas() { return []; },
  };
}
