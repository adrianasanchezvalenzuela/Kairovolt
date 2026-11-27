import { randomUUID } from 'node:crypto';
import type { Recepcion } from '../../src/application/portal-cliente';
import type { VersionParticipantes } from '../../src/application/participantes';
import { SupabaseError } from '../supabase/cliente';
import type { ParticipantesPortal } from './participantes';
import { PERMISOS_PORTAL_POR_DEFECTO } from '../../src/application/portal-cliente';
import { kv2026004Demo } from '../../src/data/kv-2026-004.demo';
import { demosPortal } from '../../src/data/demos-portal';
import { REPRESENTANTE_DEMO, TESTIGOS_DEMO, TITULAR_DEMO } from '../../src/data/personas-demo';
import { CATALOGO_MEDIA_TENSION_DEMO, TIPOS_MEDIA_TENSION_DEMO } from '../catalogo';
import { datosIniciales } from '../../src/application/participantes';
import { generarCodigo, huellaCodigo } from './codigo';
import type { AccesoPortal, AccesosPortal, AlmacenPortal, FuenteProyectoPortal, NuevaRecepcion } from './tipos';

/**
 * Adaptadores EN MEMORIA, solo para el modo DEMO (sin Supabase o con PORTAL_MODO_DEMO). Nada se guarda en disco ni en la nube:
 * se pierde al reiniciar. Los archivos subidos NO se conservan (solo se registra su recepción).
 */

/** Código de acceso del caso demostrativo. SOLO funciona en modo demo y da acceso a datos de prueba. */
export const CODIGO_DEMO: string = demosPortal[0].codigo;
export const FOLIO_DEMO = kv2026004Demo.folio;
const enviado = demosPortal[1];
const listo = demosPortal[2];

export const participantesCasoEnviado: VersionParticipantes = {
  version: 1,
  confirmado: true,
  datos: {
    ...datosIniciales,
    tipoTitular: 'fisica',
    titular: TITULAR_DEMO.nombre,
    tramita: 'apoderado',
    apoderado: REPRESENTANTE_DEMO.nombre,
    testigos: [TESTIGOS_DEMO[0].nombre, TESTIGOS_DEMO[1].nombre],
  },
};

export const participantesCasoListo: VersionParticipantes = {
  version: 1,
  confirmado: true,
  datos: {
    ...datosIniciales,
    tipoTitular: 'fisica',
    titular: TITULAR_DEMO.nombre,
    tramita: 'apoderado',
    apoderado: REPRESENTANTE_DEMO.nombre,
    testigos: [TESTIGOS_DEMO[0].nombre, TESTIGOS_DEMO[1].nombre],
  },
};

interface Fila extends AccesoPortal { huella: string; revocado: boolean }

export function crearAccesosMemoria(ahora: () => number = Date.now, sembrarDemo = false, incluirEnviado = false): AccesosPortal {
  const filas = new Map<string, Fila>();
  const vigente = (f: Fila) => !f.revocado && Date.parse(f.expiraEn) > ahora();
  const publico = ({ huella: _h, revocado: _r, ...a }: Fila): AccesoPortal => a;
  const alta = (folio: string, codigo: string, permisos: AccesoPortal['permisos'], dias: number): Fila => {
    const fila: Fila = {
      id: randomUUID(), folio, permisos,
      expiraEn: new Date(ahora() + dias * 86_400_000).toISOString(),
      creadoEn: new Date(ahora()).toISOString(), ultimoUso: null,
      huella: huellaCodigo(codigo), revocado: false,
    };
    filas.set(fila.id, fila);
    return fila;
  };
  if (sembrarDemo) alta(FOLIO_DEMO, CODIGO_DEMO, { ...PERMISOS_PORTAL_POR_DEFECTO, editar_participantes: true }, 3650);
  if (sembrarDemo && incluirEnviado) {
    for (const caso of demosPortal.slice(1)) {
      alta(caso.folio, caso.codigo, { ...PERMISOS_PORTAL_POR_DEFECTO, editar_participantes: true }, 3650);
    }
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
  if (incluirEnviado) versiones.set(enviado.folio, participantesCasoEnviado);
  if (incluirEnviado) for (const caso of [listo, ...demosPortal.slice(3)]) versiones.set(caso.folio, participantesCasoListo);
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

export function crearRecepcionesMemoria(ahora: () => number = Date.now, incluirEnviado = false) {
  const lista: (Recepcion & { folio: string })[] = [];
  if (incluirEnviado) {
    // Demo 2 (KV-2026-005): estados documentales diversos sobre los 11 documentos de media tensión.
    lista.push(
      {
        folio: enviado.folio, recibo: 'REC-DE0001', documentoId: 'recibo_cfe',
        documento: 'Recibo CFE del último corte, sin adeudos', archivo: 'recibo-cfe-ficticio.pdf',
        fecha: new Date(ahora() - 172_800_000).toISOString(), estado: 'aceptado', motivo: null, mime: 'application/pdf',
        revisadoEn: new Date(ahora() - 86_400_000).toISOString(), revisorPublico: 'Equipo IDC · demo',
      },
      {
        folio: enviado.folio, recibo: 'REC-DE0002', documentoId: 'identificacion_oficial',
        documento: 'Identificación oficial vigente del propietario o representante', archivo: 'identificacion-ficticia.pdf',
        fecha: new Date(ahora() - 86_400_000).toISOString(), estado: 'en_revision', motivo: null, mime: 'application/pdf',
      },
      {
        folio: enviado.folio, recibo: 'REC-DE0004', documentoId: 'carta_poder',
        documento: 'Carta Poder con identificaciones correspondientes', archivo: 'carta-poder-ficticia.pdf',
        fecha: new Date(ahora() - 3_600_000).toISOString(), estado: 'rechazado', causa: 'falta_firma',
        mime: 'application/pdf', revisadoEn: new Date(ahora() - 1_800_000).toISOString(), revisorPublico: 'Equipo IDC · demo',
        motivo: 'Revisamos tu Carta Poder y detectamos que falta la firma del titular. Las demás firmas están completas. Por favor, agrega la firma faltante y vuelve a enviarnos el documento.',
      },
      {
        folio: enviado.folio, recibo: 'REC-DE0005', documentoId: 'diagrama_unifilar',
        documento: 'Diagrama unifilar', archivo: 'diagrama-unifilar-especialista.pdf',
        fecha: new Date(ahora() - 129_600_000).toISOString(), estado: 'prevalidado', motivo: null, mime: 'application/pdf',
        revisadoEn: new Date(ahora() - 43_200_000).toISOString(), revisorPublico: 'Equipo IDC · demo',
      },
      {
        folio: enviado.folio, recibo: 'REC-DE0006', documentoId: 'ficha_tecnica',
        documento: 'Fichas técnicas de paneles e inversor', archivo: 'fichas-tecnicas-equipos.pdf',
        fecha: new Date(ahora() - 21_600_000).toISOString(), estado: 'en_revision', motivo: null, mime: 'application/pdf',
      },
    );

    // Demo 3 (KV-2026-006): los mismos 11 documentos de media tensión con revisión digital favorable (prevalidado),
    // SIN marcarlos como entregados físicamente porque la visita aún no ocurre.
    TIPOS_MEDIA_TENSION_DEMO.forEach((tipo, i) => {
      const meta = CATALOGO_MEDIA_TENSION_DEMO[tipo]!;
      lista.push({
        folio: listo.folio,
        recibo: 'REC-' + (0xea0001 + i).toString(16).toUpperCase(),
        documentoId: tipo,
        documento: meta.nombre,
        archivo: `${tipo}-demo.pdf`,
        fecha: new Date(ahora() - (172_800_000 - i * 3_600_000)).toISOString(),
        estado: 'prevalidado',
        motivo: null,
        mime: 'application/pdf',
        revisadoEn: new Date(ahora() - (86_400_000 - i * 1_800_000)).toISOString(),
        revisorPublico: 'Equipo IDC · demo',
      });
    });
  }
  return {
    async listar(folio: string) {
      return lista
        .filter((r) => r.folio === folio)
        .reverse()
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(({ folio: _f, ...r }) => r);
    },
    async registrar(r: NuevaRecepcion) {
      const esMultiple = r.documentoId === 'evidencia_fotografica';
      for (const anterior of lista) {
        if (anterior.folio === r.folio && anterior.documentoId === r.documentoId) {
          if (!esMultiple || anterior.estado === 'rechazado') {
            anterior.sustituida = true;
          }
        }
      }
      const recepcion = {
        folio: r.folio,
        recibo: `REC-${randomUUID().slice(0, 6).toUpperCase()}`,
        documentoId: r.documentoId,
        documento: r.documento,
        archivo: r.archivo,
        mime: r.mime,
        fecha: new Date(ahora()).toISOString(),
        estado: 'recibido' as const,
        motivo: null,
      };
      lista.push(recepcion);
      const { folio: _f, ...publica } = recepcion;
      return publica;
    },
    async simular(folio: string, recibo: string, estado: 'rechazado' | 'prevalidado', motivo: string) {
      const r = lista.find((item) => item.folio === folio && item.recibo === recibo && !item.sustituida);
      if (folio !== enviado.folio || !r || !['en_revision', 'recibido'].includes(r.estado)) return false;
      Object.assign(r, {
        estado,
        motivo: motivo || null,
        revisadoEn: new Date(ahora()).toISOString(),
        revisorPublico: 'Equipo IDC · demo',
      });
      return true;
    },
  };
}

/** Descarta el contenido: en demo no se guardan archivos. */
export const almacenDescarte: AlmacenPortal = { async guardar() { /* demo: no se guarda nada */ } };

export const fuenteDemo: FuenteProyectoPortal = {
  modo: 'demo',
  async obtener(folio) {
    if (folio === listo.folio) return {
      ...kv2026004Demo,
      id: listo.folio,
      folio: listo.folio,
      nombre: 'Interconexión FV 40 kW · documentación preparada para entrega física',
      documentos: [],
    };
    return folio === FOLIO_DEMO ? kv2026004Demo : null;
  },
};

const NOMBRES_TRAMITE: Readonly<Record<string, string>> = {
  [demosPortal[3].folio]: 'Interconexión FV 40 kW · solicitud aprobada por CFE',
  [demosPortal[4].folio]: 'Interconexión FV 40 kW · instalación del medidor',
  [demosPortal[5].folio]: 'Interconexión FV 40 kW · interconexión concluida',
};

export const fuenteDemosLocales: FuenteProyectoPortal = {
  ...fuenteDemo,
  async obtener(folio) {
    if (folio === enviado.folio) return {
      ...kv2026004Demo,
      id: enviado.folio,
      folio: enviado.folio,
      nombre: 'Interconexión FV 40 kW · preparación y revisión documental',
      documentos: [],
    };
    const nombreTramite = NOMBRES_TRAMITE[folio];
    if (nombreTramite) return { ...kv2026004Demo, id: folio, folio, nombre: nombreTramite, documentos: [] };
    return fuenteDemo.obtener(folio);
  },
};
