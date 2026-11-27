/**
 * Estado MOCK compartido por folio para los demos documentales (KV-2026-005 y KV-2026-006).
 * Lo leen el portal del cliente y el panel IDC de demostración, de modo que ambos nunca se contradicen.
 * Vive solo en este navegador (localStorage): no toca Supabase, Zoho ni envía correos.
 */
import { useSyncExternalStore } from 'react';
import type { DocumentoSolicitado, EstadoDocumentoCliente, Notificacion, Recepcion, VistaPortal } from '../application/portal-cliente';
import type { ElegibilidadCita } from '../domain/citas/cita';

export const FOLIO_DEMO_PREPARACION = 'KV-2026-005';
export const FOLIO_DEMO_ENTREGA = 'KV-2026-006';
export const FOLIOS_DEMO_DOCUMENTAL = [FOLIO_DEMO_PREPARACION, FOLIO_DEMO_ENTREGA] as const;
export const esFolioDocumentalDemo = (folio: string) => (FOLIOS_DEMO_DOCUMENTAL as readonly string[]).includes(folio);
export const CORREO_CLIENTE_DEMO = 'cliente-demo@example.invalid';
export const LEYENDA_DEMO = 'Demostración — Sin validez legal';

export type Grupo = 'cliente' | 'conjunto' | 'idc';
export type EstadoCliente = 'pendiente' | 'en_revision' | 'por_corregir' | 'prevalidado';
export type EstadoTecnico = 'en_preparacion' | 'en_revision_tecnica' | 'disponible';
export type EstadoSolicitud = 'en_preparacion' | 'lista_para_firmar' | 'en_revision' | 'prevalidada';
export type EstadoDemo = EstadoCliente | EstadoTecnico | EstadoSolicitud;

export interface DefDocumento { id: string; nombre: string; corto: string; grupo: Grupo; sirve: string }

/** Los 11 requisitos iniciales de interconexión en media tensión (no se mezclan con los 17 de inspección UIIE). */
export const DOCUMENTOS_DEMO: readonly DefDocumento[] = [
  { id: 'identificacion_oficial', nombre: 'Identificación oficial vigente del propietario', corto: 'Identificación oficial', grupo: 'cliente', sirve: 'Acredita quién es el titular del servicio que se va a interconectar.' },
  { id: 'carta_poder', nombre: 'Carta poder con las identificaciones correspondientes', corto: 'Carta poder', grupo: 'cliente', sirve: 'Permite que IDC realice el trámite en representación del propietario.' },
  { id: 'constancia_situacion_fiscal', nombre: 'Constancia de situación fiscal', corto: 'Constancia fiscal', grupo: 'cliente', sirve: 'Confirma los datos fiscales actualizados del titular del servicio.' },
  { id: 'recibo_cfe', nombre: 'Recibo de CFE del último corte', corto: 'Recibo CFE', grupo: 'cliente', sirve: 'Identifica el servicio que se va a interconectar y su último periodo facturado.' },
  { id: 'solicitud', nombre: 'Formato de solicitud para interconexión', corto: 'Solicitud de interconexión', grupo: 'conjunto', sirve: 'Es el documento con el que se inicia formalmente el trámite ante CFE.' },
  { id: 'croquis', nombre: 'Croquis de ubicación', corto: 'Croquis', grupo: 'idc', sirve: 'Muestra dónde está el inmueble y en qué punto se instala el sistema.' },
  { id: 'diagrama_unifilar', nombre: 'Diagrama unifilar', corto: 'Diagrama unifilar', grupo: 'idc', sirve: 'Explica cómo se conecta el sistema solar a la red, de forma esquemática.' },
  { id: 'ficha_tecnica', nombre: 'Fichas técnicas de paneles e inversor', corto: 'Fichas técnicas', grupo: 'idc', sirve: 'Datos del fabricante de los paneles y del inversor instalados.' },
  { id: 'certificado', nombre: 'Certificados UL de paneles e inversor', corto: 'Certificados UL', grupo: 'idc', sirve: 'Certificaciones de seguridad vigentes de los equipos instalados.' },
  { id: 'evidencia_fotografica', nombre: 'Fotografías del sistema funcionando', corto: 'Fotografías del sistema', grupo: 'idc', sirve: 'Evidencia de paneles, inversor y tablero en operación.' },
  { id: 'dictamen_uvie', nombre: 'Dictamen de verificación UVIE', corto: 'Dictamen UVIE', grupo: 'idc', sirve: 'Documento emitido por una Unidad de Verificación de Instalaciones Eléctricas; IDC lo gestiona.' },
];
export const definicion = (id: string) => DOCUMENTOS_DEMO.find((d) => d.id === id);
export const GRUPO_POR_DOCUMENTO: Readonly<Record<string, Grupo>> = Object.fromEntries(DOCUMENTOS_DEMO.map((d) => [d.id, d.grupo]));

export const TEXTO_ESTADO: Readonly<Record<EstadoDemo, string>> = {
  pendiente: 'Pendiente', en_revision: 'En revisión por IDC', por_corregir: 'Por corregir', prevalidado: 'Prevalidado por IDC',
  en_preparacion: 'En preparación por IDC', en_revision_tecnica: 'En revisión técnica', disponible: 'Disponible para consultar',
  lista_para_firmar: 'Lista para revisar y firmar', prevalidada: 'Prevalidada por IDC',
};
/** Texto propio de la solicitud (comparte «en revisión» y «en preparación» con otros grupos). */
export const textoEstado = (id: string, e: EstadoDemo) =>
  id === 'solicitud' && e === 'en_revision' ? 'En revisión por IDC' : id === 'solicitud' && e === 'en_preparacion' ? 'En preparación' : TEXTO_ESTADO[e];
export const esFavorable = (e: EstadoDemo) => e === 'prevalidado' || e === 'prevalidada' || e === 'disponible';

export interface VersionDemo { n: number; archivo: string; fecha: string; autor: 'cliente' | 'idc'; nota?: string }
export interface ObservacionDemo { texto: string; fecha: string; autor: string }
export interface DocEstado { estado: EstadoDemo; versiones: VersionDemo[]; observacion?: ObservacionDemo; reportes: { texto: string; fecha: string }[]; revisadoEn?: string }
export interface CorreoDemo { asunto: string; para: string; parrafos: string[]; boton: string }
export interface AvisoDemo { id: string; fecha: string; titulo: string; detalle: string; documentoId: string; tipo: 'accion' | 'recepcion'; correo: CorreoDemo; correccion?: boolean }
export interface EventoDemo { id: string; fecha: string; titulo: string }
export interface EstadoFolio { docs: Record<string, DocEstado>; avisos: AvisoDemo[]; eventos: EventoDemo[] }
interface Almacen { v: number; folios: Record<string, EstadoFolio> }

const LLAVE = 'kairovolt:demo-expediente:v2';
const ahora = () => new Date().toISOString();
const hace = (dias: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const uid = () => Math.random().toString(36).slice(2, 9);

export const COMENTARIO_CARTA_PODER =
  'Revisamos tu carta poder. El documento está correctamente llenado, pero falta la firma del segundo testigo. Por favor, completa la firma y vuelve a enviarlo.';

function ver(n: number, archivo: string, fecha: string, autor: VersionDemo['autor'] = 'cliente'): VersionDemo { return { n, archivo, fecha, autor }; }
const d = (estado: EstadoDemo, versiones: VersionDemo[] = [], extra: Partial<DocEstado> = {}): DocEstado => ({ estado, versiones, reportes: [], ...extra });

function semilla(folio: string): EstadoFolio {
  if (folio === FOLIO_DEMO_ENTREGA) {
    return {
      docs: {
        identificacion_oficial: d('prevalidado', [ver(1, 'identificacion-ficticia.pdf', hace(12))], { revisadoEn: hace(11) }),
        carta_poder: d('prevalidado', [ver(1, 'carta-poder-ficticia.pdf', hace(12)), ver(2, 'carta-poder-ficticia-corregida.pdf', hace(10))], { revisadoEn: hace(9) }),
        constancia_situacion_fiscal: d('prevalidado', [ver(1, 'constancia-fiscal-ficticia.pdf', hace(11))], { revisadoEn: hace(10) }),
        recibo_cfe: d('prevalidado', [ver(1, 'recibo-cfe-ficticio.pdf', hace(11))], { revisadoEn: hace(10) }),
        solicitud: d('prevalidada', [ver(1, 'solicitud-prellenada-idc.pdf', hace(9), 'idc'), ver(2, 'solicitud-firmada-ficticia.pdf', hace(7))], { revisadoEn: hace(6) }),
        croquis: d('disponible', [ver(1, 'croquis-idc.pdf', hace(8), 'idc')]),
        diagrama_unifilar: d('disponible', [ver(1, 'diagrama-unifilar-idc.pdf', hace(8), 'idc')]),
        ficha_tecnica: d('disponible', [ver(1, 'fichas-tecnicas-idc.pdf', hace(7), 'idc')]),
        certificado: d('disponible', [ver(1, 'certificados-ul-idc.pdf', hace(7), 'idc')]),
        evidencia_fotografica: d('disponible', [ver(1, 'fotos-sistema-idc.pdf', hace(5), 'idc')]),
        dictamen_uvie: d('disponible', [ver(1, 'dictamen-uvie-ficticio.pdf', hace(4), 'idc')]),
      },
      avisos: [],
      eventos: [
        { id: 'e1', fecha: hace(12), titulo: 'Recibimos tus documentos personales' },
        { id: 'e2', fecha: hace(6), titulo: 'Tu solicitud de interconexión quedó prevalidada' },
        { id: 'e3', fecha: hace(4), titulo: 'IDC dejó disponible tu documentación técnica' },
        { id: 'e4', fecha: hace(2), titulo: 'Tu expediente digital está listo para la entrega física' },
      ],
    };
  }
  return {
    docs: {
      identificacion_oficial: d('prevalidado', [ver(1, 'identificacion-ficticia.pdf', hace(6))], { revisadoEn: hace(5) }),
      carta_poder: d('por_corregir', [ver(1, 'carta-poder-ficticia.pdf', hace(3))], {
        revisadoEn: hace(1, 16), observacion: { texto: COMENTARIO_CARTA_PODER, fecha: hace(1, 16), autor: 'Equipo IDC' },
      }),
      constancia_situacion_fiscal: d('pendiente'),
      recibo_cfe: d('prevalidado', [ver(1, 'recibo-cfe-ficticio.pdf', hace(6))], { revisadoEn: hace(5) }),
      solicitud: d('lista_para_firmar', [ver(1, 'solicitud-prellenada-idc.pdf', hace(2), 'idc')]),
      croquis: d('disponible', [ver(1, 'croquis-idc.pdf', hace(3), 'idc')]),
      diagrama_unifilar: d('disponible', [ver(1, 'diagrama-unifilar-idc.pdf', hace(2), 'idc')]),
      ficha_tecnica: d('en_revision_tecnica', [ver(1, 'fichas-tecnicas-idc-borrador.pdf', hace(1), 'idc')]),
      certificado: d('en_preparacion'),
      evidencia_fotografica: d('en_preparacion'),
      dictamen_uvie: d('en_preparacion'),
    },
    avisos: [{
      id: 'n:rechazo:carta_poder:semilla', fecha: hace(1, 16), titulo: 'Tienes una corrección en tu carta poder', detalle: COMENTARIO_CARTA_PODER,
      documentoId: 'carta_poder', tipo: 'accion', correccion: true,
      correo: { asunto: 'KairóVolt | Tienes una corrección documental pendiente', para: CORREO_CLIENTE_DEMO, parrafos: [COMENTARIO_CARTA_PODER], boton: 'Enviar versión corregida' },
    }],
    eventos: [
      { id: 'e1', fecha: hace(6), titulo: 'Recibimos tus documentos personales' },
      { id: 'e2', fecha: hace(2), titulo: 'IDC preparó tu solicitud de interconexión' },
      { id: 'e3', fecha: hace(1), titulo: 'Tu carta poder necesita una corrección' },
    ],
  };
}

function cargar(): Almacen {
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (crudo) { const a = JSON.parse(crudo) as Almacen; if (a.v === 2) return a; }
  } catch { /* se siembra de nuevo */ }
  return { v: 2, folios: {} };
}
let almacen: Almacen = cargar();
const oyentes = new Set<() => void>();
function guardar(a: Almacen) {
  almacen = a;
  try { localStorage.setItem(LLAVE, JSON.stringify(a)); } catch { /* sin persistencia */ }
  oyentes.forEach((f) => f());
}
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === LLAVE) { almacen = cargar(); oyentes.forEach((f) => f()); } });

/** Siempre devuelve el mismo objeto hasta que cambia el estado (requisito de useSyncExternalStore). */
function obtener(folio: string): EstadoFolio {
  const existente = almacen.folios[folio];
  if (existente) return existente;
  const nuevo = semilla(folio);
  almacen = { ...almacen, folios: { ...almacen.folios, [folio]: nuevo } };
  return nuevo;
}
export function useExpedienteDemo(folio: string): EstadoFolio {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => obtener(folio));
}
export const leerExpedienteDemo = obtener;

function mutar(folio: string, f: (e: EstadoFolio) => EstadoFolio) { guardar({ ...almacen, folios: { ...almacen.folios, [folio]: f(obtener(folio)) } }); }

interface Cambio {
  doc: string; estado: EstadoDemo; version?: Omit<VersionDemo, 'n' | 'fecha'>; observacion?: ObservacionDemo | null; revisa?: boolean;
  evento: string; aviso?: { titulo: string; detalle: string; tipo: AvisoDemo['tipo']; correo?: Omit<CorreoDemo, 'para'>; correccion?: boolean };
}
function aplicar(folio: string, c: Cambio) {
  mutar(folio, (e) => {
    const previo = e.docs[c.doc] ?? d('pendiente');
    const fecha = ahora();
    const versiones = c.version ? [...previo.versiones, { ...c.version, n: previo.versiones.length + 1, fecha }] : previo.versiones;
    const siguiente: DocEstado = {
      ...previo, estado: c.estado, versiones,
      observacion: c.observacion === null ? undefined : c.observacion ?? previo.observacion,
      revisadoEn: c.revisa ? fecha : previo.revisadoEn,
    };
    const def = definicion(c.doc);
    const aviso: AvisoDemo | null = c.aviso && def ? {
      id: (c.aviso.correccion ? 'n:rechazo:' : 'n:demo:') + c.doc + ':' + uid(), fecha, titulo: c.aviso.titulo, detalle: c.aviso.detalle,
      documentoId: c.doc, tipo: c.aviso.tipo, correccion: c.aviso.correccion,
      correo: { para: CORREO_CLIENTE_DEMO, ...(c.aviso.correo ?? { asunto: 'KairóVolt | ' + c.aviso.titulo, parrafos: [c.aviso.detalle], boton: 'Consultar mi expediente' }) },
    } : null;
    return {
      docs: { ...e.docs, [c.doc]: siguiente },
      avisos: aviso ? [aviso, ...e.avisos] : e.avisos,
      eventos: [{ id: uid(), fecha, titulo: c.evento }, ...e.eventos],
    };
  });
}

export const accionesDemo = {
  reiniciar(folio: string) { mutar(folio, () => semilla(folio)); },

  /** El cliente envía un archivo (documento personal, corrección o solicitud firmada) a revisión de IDC. */
  subirCliente(folio: string, id: string, archivo: string) {
    const def = definicion(id)!;
    const corrige = obtener(folio).docs[id]?.estado === 'por_corregir';
    const firmada = id === 'solicitud';
    aplicar(folio, {
      doc: id, estado: 'en_revision', version: { archivo, autor: 'cliente' }, observacion: null,
      evento: corrige ? `Enviaste la versión corregida de ${def.corto.toLowerCase()}` : firmada ? 'Enviaste tu solicitud firmada' : `Enviaste ${def.corto.toLowerCase()} a revisión`,
      aviso: { titulo: `Recibimos tu ${def.corto.toLowerCase()}`, detalle: 'IDC lo revisará y te avisaremos aquí y por correo.', tipo: 'recepcion',
        correo: { asunto: `KairóVolt | Recibimos tu ${def.corto.toLowerCase()}`, parrafos: ['Hola, cliente de demostración.', `Recibimos «${def.nombre}». Nuestro equipo lo revisará y te avisaremos del resultado.`], boton: 'Consultar mi expediente' } },
    });
  },

  /** El cliente reporta información incorrecta (solicitud o documentos técnicos de IDC). */
  reportar(folio: string, id: string, texto: string) {
    const def = definicion(id)!;
    mutar(folio, (e) => {
      const previo = e.docs[id] ?? d('pendiente');
      return {
        ...e,
        docs: { ...e.docs, [id]: { ...previo, reportes: [{ texto, fecha: ahora() }, ...previo.reportes] } },
        eventos: [{ id: uid(), fecha: ahora(), titulo: `Reportaste un posible error en ${def.corto.toLowerCase()}` }, ...e.eventos],
      };
    });
  },

  /** IDC carga o sustituye un archivo técnico (conserva el historial de versiones). */
  cargarTecnico(folio: string, id: string, archivo: string) {
    const def = definicion(id)!;
    aplicar(folio, { doc: id, estado: 'en_revision_tecnica', version: { archivo, autor: 'idc' }, evento: `IDC cargó una versión de ${def.corto.toLowerCase()} (en revisión técnica)` });
  },
  marcarEnPreparacion(folio: string, id: string) {
    const def = definicion(id)!;
    aplicar(folio, { doc: id, estado: 'en_preparacion', evento: `${def.corto} volvió a preparación en IDC` });
  },
  marcarDisponible(folio: string, id: string) {
    const def = definicion(id)!;
    aplicar(folio, {
      doc: id, estado: 'disponible', revisa: true, evento: `${def.corto} quedó disponible para consultar`,
      aviso: { titulo: `${def.corto} ya está disponible`, detalle: 'Puedes consultarlo y descargarlo en la sección Documentos.', tipo: 'recepcion',
        correo: { asunto: `KairóVolt | ${def.corto} ya está disponible`, parrafos: ['Hola, cliente de demostración.', `IDC dejó disponible «${def.nombre}» para que lo consultes.`, 'Si ves algún dato incorrecto, repórtalo desde el detalle del documento.'], boton: 'Consultar mi documento' } },
    });
  },

  /** IDC termina de preparar la solicitud con los datos del cliente y del proyecto. */
  prepararSolicitud(folio: string) {
    aplicar(folio, {
      doc: 'solicitud', estado: 'lista_para_firmar', version: { archivo: 'solicitud-prellenada-idc.pdf', autor: 'idc' }, observacion: null,
      evento: 'IDC preparó tu solicitud de interconexión',
      aviso: { titulo: 'Tu solicitud está lista para revisar y firmar', detalle: 'Revisa tus datos, imprímela, fírmala y súbela de nuevo.', tipo: 'accion',
        correo: { asunto: 'KairóVolt | Tu solicitud de interconexión está lista', parrafos: ['Hola, cliente de demostración.', 'Preparamos tu solicitud con los datos de tu proyecto. Revísala y, si todo es correcto, imprímela y fírmala.'], boton: 'Revisar mi solicitud' } },
    });
  },

  /** Prevalidación digital: no equivale a recepción física ni a aceptación de CFE. */
  prevalidar(folio: string, id: string) {
    const def = definicion(id)!;
    const estado: EstadoDemo = id === 'solicitud' ? 'prevalidada' : 'prevalidado';
    aplicar(folio, {
      doc: id, estado, revisa: true, observacion: null, evento: `${def.corto} quedó prevalidado por IDC`,
      aviso: { titulo: `${def.corto}: prevalidado por IDC`, detalle: 'Revisión digital favorable. La recepción física se registra por separado en IDC.', tipo: 'recepcion',
        correo: { asunto: `KairóVolt | Tu ${def.corto.toLowerCase()} fue prevalidado`, parrafos: ['Hola, cliente de demostración.', `Tu copia digital de «${def.nombre}» tiene revisión favorable.`, 'Esto no sustituye la entrega física ni equivale a la aceptación de CFE.'], boton: 'Consultar mi expediente' } },
    });
  },

  solicitarCorreccion(folio: string, id: string, texto: string) {
    const def = definicion(id)!;
    const estado: EstadoDemo = id === 'solicitud' ? 'lista_para_firmar' : 'por_corregir';
    aplicar(folio, {
      doc: id, estado, revisa: true, observacion: { texto, fecha: ahora(), autor: 'Equipo IDC' }, evento: `${def.corto} necesita una corrección`,
      aviso: { titulo: `Tienes una corrección en ${def.corto.toLowerCase()}`, detalle: texto, tipo: 'accion', correccion: true,
        correo: { asunto: 'KairóVolt | Tienes una corrección documental pendiente', parrafos: ['Hola, cliente de demostración.', texto], boton: 'Enviar versión corregida' } },
    });
  },
};

// ───────────────────────── Vista del cliente (overlay sobre la proyección del servidor) ─────────────────────────

const A_ESTADO_PORTAL: Readonly<Record<EstadoDemo, EstadoDocumentoCliente>> = {
  pendiente: 'pendiente', en_revision: 'en_revision', por_corregir: 'rechazado', prevalidado: 'prevalidado',
  en_preparacion: 'en_revision', en_revision_tecnica: 'en_revision', disponible: 'prevalidado',
  lista_para_firmar: 'pendiente', prevalidada: 'prevalidado',
};
const ESTADO_RECEPCION: Readonly<Record<EstadoDemo, Recepcion['estado']>> = {
  pendiente: 'recibido', en_revision: 'en_revision', por_corregir: 'rechazado', prevalidado: 'prevalidado',
  en_preparacion: 'en_revision', en_revision_tecnica: 'en_revision', disponible: 'prevalidado', lista_para_firmar: 'recibido', prevalidada: 'prevalidado',
};

export function expedienteDemoCompleto(e: EstadoFolio): boolean {
  return DOCUMENTOS_DEMO.every((def) => esFavorable(e.docs[def.id]?.estado ?? 'pendiente'));
}

export function pendientesDemo(e: EstadoFolio) {
  return DOCUMENTOS_DEMO.filter((def) => !esFavorable(e.docs[def.id]?.estado ?? 'pendiente'))
    .map((def) => ({ id: def.id, nombre: def.nombre, estado: A_ESTADO_PORTAL[e.docs[def.id]?.estado ?? 'pendiente'] }));
}

function siguientePasoDemo(e: EstadoFolio): VistaPortal['siguientePaso'] {
  const por = (grupo: Grupo) => DOCUMENTOS_DEMO.filter((x) => x.grupo === grupo);
  const corregir = DOCUMENTOS_DEMO.find((x) => e.docs[x.id]?.estado === 'por_corregir');
  if (corregir) return { titulo: `Corrige tu ${corregir.corto.toLowerCase()}`, detalle: e.docs[corregir.id]?.observacion?.texto ?? 'IDC dejó un comentario.', responsable: 'cliente', fechaEstimada: null };
  if (e.docs.solicitud?.estado === 'lista_para_firmar') return { titulo: 'Revisa y firma tu solicitud', detalle: 'IDC preparó tu solicitud. Revísala, imprímela, fírmala y súbela.', responsable: 'cliente', fechaEstimada: null };
  if (por('cliente').some((x) => e.docs[x.id]?.estado === 'pendiente')) return { titulo: 'Prepara tus documentos personales', detalle: 'Consulta las guías y súbelos para revisión previa de IDC.', responsable: 'cliente', fechaEstimada: null };
  if (DOCUMENTOS_DEMO.some((x) => e.docs[x.id]?.estado === 'en_revision')) return { titulo: 'IDC está revisando tus envíos', detalle: 'Te avisaremos aquí y por correo cuando termine.', responsable: 'idc', fechaEstimada: null };
  if (!expedienteDemoCompleto(e)) return { titulo: 'IDC prepara tu documentación técnica', detalle: 'Puedes consultar su avance en Documentos.', responsable: 'idc', fechaEstimada: null };
  return { titulo: 'Tu expediente digital está listo', detalle: 'Prepara tu carpeta física y agenda tu visita a IDC.', responsable: 'cliente', fechaEstimada: null };
}

/** Sustituye en la proyección del servidor lo que depende de los documentos, para que Inicio, Documentos, Avisos e Historial coincidan. */
export function aplicarExpedienteDemo(vista: VistaPortal, e: EstadoFolio): VistaPortal {
  const documentos: DocumentoSolicitado[] = DOCUMENTOS_DEMO.map((def) => {
    const doc = e.docs[def.id] ?? d('pendiente');
    const puedeSubir = def.grupo === 'cliente' ? true : def.grupo === 'conjunto' ? doc.estado === 'lista_para_firmar' : false;
    return {
      id: def.id, nombre: def.nombre, etapa: vista.documentos?.find((x) => x.id === def.id)?.etapa ?? 'G0',
      estado: A_ESTADO_PORTAL[doc.estado], detalle: doc.observacion?.texto ?? null, puedeSubir, vigencia: null,
    };
  });
  const recepciones: Recepcion[] = DOCUMENTOS_DEMO.flatMap((def) => {
    const doc = e.docs[def.id]; if (!doc) return [];
    return doc.versiones.filter((x) => x.autor === 'cliente').map((x, i, todas) => ({
      recibo: `REC-${vista.folio.slice(-3)}-${def.id.slice(0, 3).toUpperCase()}${x.n}`, documentoId: def.id, documento: def.nombre, archivo: x.archivo, fecha: x.fecha,
      estado: i === todas.length - 1 ? ESTADO_RECEPCION[doc.estado] : 'rechazado', motivo: i === todas.length - 1 ? doc.observacion?.texto ?? null : null,
      sustituida: i < todas.length - 1, revisadoEn: doc.revisadoEn ?? null, revisorPublico: 'Equipo IDC',
    }));
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const citas = vista.notificaciones.filter((n) => n.citaId);
  const delExpediente: Notificacion[] = e.avisos.map((a) => ({
    id: a.id, tipo: a.tipo, titulo: a.titulo, detalle: a.detalle, fecha: a.fecha, documentoId: a.documentoId, correoDemo: a.correo,
  }));
  const citasHist = vista.historial.filter((h) => /cita|visita/i.test(h.titulo));
  const favorables = DOCUMENTOS_DEMO.filter((def) => esFavorable(e.docs[def.id]?.estado ?? 'pendiente')).length;
  return {
    ...vista, documentos, recepciones,
    notificaciones: [...citas, ...delExpediente].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    historial: [...citasHist, ...e.eventos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    siguientePaso: siguientePasoDemo(e),
    avance: { ...vista.avance, porcentaje: Math.round((favorables / DOCUMENTOS_DEMO.length) * 100), exacto: true },
  };
}

/** Evita que Mi visita habilite la cita si el estado compartido ya no está completo (p. ej. IDC pidió una corrección). */
export function elegibilidadConDemo(el: ElegibilidadCita, folio: string): ElegibilidadCita {
  if (!esFolioDocumentalDemo(folio)) return el;
  const e = leerExpedienteDemo(folio);
  const pend = pendientesDemo(e);
  if (pend.length === 0) return el;
  return {
    ...el, permitida: false, etiquetaEstadoDocumental: 'Preparación documental en curso',
    motivoBloqueo: 'La entrega física se habilita cuando los 11 documentos del expediente tienen revisión digital favorable.',
    documentosPendientes: pend, preparadosObligatorios: DOCUMENTOS_DEMO.length - pend.length, totalObligatorios: DOCUMENTOS_DEMO.length,
  };
}

/** Cambia cuando cualquier folio cambia: sirve para recalcular la vista del portal. */
export function useVersionExpedienteDemo(): unknown {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => almacen);
}
