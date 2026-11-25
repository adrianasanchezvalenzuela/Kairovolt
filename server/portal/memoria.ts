import { randomUUID } from 'node:crypto';
import type { Recepcion } from '../../src/application/portal-cliente';
import type { VersionParticipantes } from '../../src/application/participantes';
import { SupabaseError } from '../supabase/cliente';
import type { ParticipantesPortal } from './participantes';
import { PERMISOS_PORTAL_POR_DEFECTO } from '../../src/application/portal-cliente';
import { kv2026004Demo } from '../../src/data/kv-2026-004.demo';
import { demosPortal } from '../../src/data/demos-portal';
import { catalogoRequisitosBase } from '../../src/data/catalogo-requisitos.mock';
import { datosIniciales } from '../../src/application/participantes';
import { generarCodigo, huellaCodigo } from './codigo';
import type { AccesoPortal, AccesosPortal, AlmacenPortal, FuenteProyectoPortal, NuevaRecepcion, RecepcionesPortal } from './tipos';

/**
 * Adaptadores EN MEMORIA, solo para el modo DEMO (sin Supabase o con PORTAL_MODO_DEMO). Nada se guarda en disco ni en la nube:
 * se pierde al reiniciar. Los archivos subidos NO se conservan (solo se registra su recepción).
 */

/** Código de acceso del caso demostrativo. SOLO funciona en modo demo y da acceso a datos de prueba. */
export const CODIGO_DEMO: string = demosPortal[0].codigo;
export const FOLIO_DEMO = kv2026004Demo.folio;
const enviado = demosPortal[1];
const listo = demosPortal[2];

interface Fila extends AccesoPortal { huella: string; revocado: boolean }

export function crearAccesosMemoria(ahora: () => number = Date.now, sembrarDemo = false, incluirEnviado = false): AccesosPortal {
  const filas = new Map<string, Fila>();
  const vigente = (f: Fila) => !f.revocado && Date.parse(f.expiraEn) > ahora();
  const publico = ({ huella: _h, revocado: _r, ...a }: Fila): AccesoPortal => a;
  const alta = (folio: string, codigo: string, permisos: AccesoPortal['permisos'], dias: number): Fila => {
    const fila: Fila = { id: randomUUID(), folio, permisos, expiraEn: new Date(ahora() + dias * 86_400_000).toISOString(), creadoEn: new Date(ahora()).toISOString(), ultimoUso: null, huella: huellaCodigo(codigo), revocado: false };
    filas.set(fila.id, fila);
    return fila;
  };
  if (sembrarDemo) alta(FOLIO_DEMO, CODIGO_DEMO, { ...PERMISOS_PORTAL_POR_DEFECTO, editar_participantes: true }, 3650);
  if (sembrarDemo && incluirEnviado) {
    for (const caso of [enviado, listo]) alta(caso.folio, caso.codigo, { ...PERMISOS_PORTAL_POR_DEFECTO, editar_participantes: true }, 3650);
  }

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

export function crearParticipantesDemo(incluirEnviado = false): ParticipantesPortal {
  const versiones = new Map<string, VersionParticipantes>();
  if (incluirEnviado) versiones.set(enviado.folio, {
    version: 1, confirmado: true, datos: { ...datosIniciales, tipoTitular: 'fisica', titular: 'Titular ficticio del caso enviado', tramita: 'titular' },
  });
  if (incluirEnviado) versiones.set(listo.folio, {
    version: 1, confirmado: true, datos: { ...datosIniciales, tipoTitular: 'fisica', titular: 'Titular ficticio del expediente listo',
      tramita: 'apoderado', apoderado: 'Apoderada ficticia', testigos: ['Testigo ficticio A', 'Testigo ficticio B'] },
  });
  return {
    async consultar(acceso) { return versiones.get(acceso.folio) ?? null; },
    async guardar(acceso, entrada) {
      const version = versiones.get(acceso.folio)?.version ?? 0;
      if (entrada.version !== version) throw new SupabaseError('Versión anterior', 409, '40001');
      const guardada = { ...entrada, version: version + 1 };
      versiones.set(acceso.folio, guardada);
      return guardada;
    },
  };
}

export function crearRecepcionesMemoria(ahora: () => number = Date.now, incluirEnviado = false): RecepcionesPortal {
  const lista: (Recepcion & { folio: string })[] = [];
  if (incluirEnviado) lista.push(
    { folio: enviado.folio, recibo: 'REC-DE0001', documentoId: 'recibo_cfe', documento: 'Recibo CFE', archivo: 'recibo-ficticio.pdf', fecha: new Date(ahora() - 172_800_000).toISOString(), estado: 'aceptado', motivo: null },
    { folio: enviado.folio, recibo: 'REC-DE0002', documentoId: 'identificacion_oficial', documento: 'Identificación oficial', archivo: 'identificacion-ficticia.pdf', fecha: new Date(ahora() - 86_400_000).toISOString(), estado: 'en_revision', motivo: null },
    { folio: enviado.folio, recibo: 'REC-DE0003', documentoId: 'constancia_situacion_fiscal', documento: 'Constancia fiscal', archivo: 'constancia-ficticia.pdf', fecha: new Date(ahora() - 7_200_000).toISOString(), estado: 'recibido', motivo: null },
    { folio: enviado.folio, recibo: 'REC-DE0004', documentoId: 'carta_poder', documento: 'Carta poder', archivo: 'carta-ficticia.pdf', fecha: new Date(ahora() - 3_600_000).toISOString(), estado: 'recibido', motivo: null },
  );
  if (incluirEnviado) lista.push(...catalogoRequisitosBase.filter((r) => r.aportaCliente && r.obligatorio && !r.condicion)
    .map((r, i): Recepcion & { folio: string } => ({
      folio: listo.folio, recibo: 'REC-' + (0xea0001 + i).toString(16).toUpperCase(),
      documentoId: r.tipo, documento: r.nombre, archivo: r.tipo + '-demo.pdf',
      fecha: new Date(ahora() - 86_400_000).toISOString(), estado: 'aceptado', motivo: null,
    })));
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
    if (folio === listo.folio) return {
      ...kv2026004Demo, id: listo.folio, folio: listo.folio,
      nombre: 'Interconexión FV · listo para entrega física',
      documentos: kv2026004Demo.documentos.filter((d) => d.tipo !== 'recibo_cfe'),
    };
    return folio === FOLIO_DEMO ? kv2026004Demo : null;
  },
};

export const fuenteDemosLocales: FuenteProyectoPortal = {
  ...fuenteDemo,
  async obtener(folio) {
    if (folio === enviado.folio) return {
      ...kv2026004Demo, id: enviado.folio, folio: enviado.folio,
      nombre: 'Interconexión FV · expediente enviado',
      documentos: kv2026004Demo.documentos.filter((d) => d.tipo !== 'recibo_cfe'),
    };
    return fuenteDemo.obtener(folio);
  },
};
