import { evaluarAplicabilidad, evaluarChecklist, type DatosCondicionAplicacion, type Requisito } from '../domain/checklist/checklist';
import { ORDEN_COMPUERTAS, type CompuertaId } from '../domain/compuertas/compuerta';
import { evaluarActividad } from '../domain/cronograma/actividad';
import type { Proyecto } from '../domain/proyecto/proyecto';
import { calcularAvance, REGLAS_AVANCE } from '../domain/portal/avance';
import { ESTADO_CLIENTE, ETAPA_CLIENTE, HITO_PUBLICO } from '../domain/portal/textos';
import { evaluarVigencias } from '../domain/vigencias/vigencias';
import type { CategoriaPortal, EmisorDocumento, GuiaPreparacion, RequiereEntregaFisica, RevisionDigital } from '../domain/checklist/preparacion';

/**
 * PROYECCIÓN PÚBLICA del portal del cliente. Es lo ÚNICO que sale del servidor hacia el cliente.
 * Se construye por LISTA BLANCA: cada campo se copia a propósito; nada se hereda del proyecto interno. No incluye
 * validaciones, observaciones, valores discrepantes, responsables, PAER/PPC, nombres de actividades, costos, datos de
 * otros clientes ni identificadores de Zoho.
 */

export type EstadoDocumentoCliente = 'pendiente' | 'en_revision' | 'recibido' | 'prevalidado' | 'aceptado' | 'rechazado' | 'vencido' | 'por_vencer' | 'no_aplica';
export type ResponsablePaso = 'cliente' | 'idc' | 'cfe';

export interface DocumentoSolicitado {
  /** Identificador opaco para subir (el tipo del requisito). */
  id: string;
  nombre: string;
  etapa: CompuertaId;
  estado: EstadoDocumentoCliente;
  /** Texto para el cliente (p. ej. el motivo de un rechazo). */
  detalle: string | null;
  puedeSubir: boolean;
  /** Vigencia declarada en el documento ya entregado (es del propio cliente). */
  vigencia: string | null;
}

export interface GuiaDocumentoCliente {
  generacionAutomatica?: boolean;
  guiaPreparacion?: GuiaPreparacion;
  revisionDigital?: RevisionDigital;
  categoriaPortal?: CategoriaPortal;
  emisorDocumento?: EmisorDocumento;
  permiteMultiples?: boolean;
  requiereEntregaFisica?: RequiereEntregaFisica;
  id: string;
  nombre: string;
  descripcion: string | null;
  etapa: CompuertaId;
  condicion: string | null;
  canal: 'digital' | 'fisico';
  requiereVigencia: boolean;
  quienAporta: 'cliente' | 'idc' | 'tercero' | 'pendiente';
  instrucciones: string | null;
  camposEsperados: readonly string[];
  ejemplosAutorizados: readonly string[];
  validacionIdc: 'pendiente' | 'validado';
  aplicabilidad: 'aplica' | 'no_aplica' | 'pendiente_revision';
}

/** Confirmación de recepción de un archivo subido por el cliente. */
export interface Recepcion {
  /** Folio del acuse, único y legible: se lo puede citar a IDC. */
  recibo: string;
  documentoId: string;
  documento: string;
  /** Nombre del archivo ya saneado. */
  archivo: string;
  /** ISO con hora. */
  fecha: string;
  estado: 'recibido' | 'en_revision' | 'prevalidado' | 'aceptado' | 'rechazado';
  /** Motivo redactado por IDC para el cliente cuando se rechaza. */
  motivo: string | null;
  causa?: string | null;
  sustituida?: boolean;
  revisadoEn?: string | null;
  revisorPublico?: string;
  mime?: string;
}

export interface Notificacion {
  documentoId?: string;
  citaId?: string;
  eventoTipo?: string;
  /** Solo demostración: contenido del correo simulado (no se envía nada). */
  /** Solo demostración (trámite posterior): estado de lectura y destino del aviso. */
  leido?: boolean;
  ruta?: string;
  accion?: string;
  correoDemo?: { asunto: string; para: string; parrafos: string[]; boton: string };
  citaResumen?: {
    referencia: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    ubicacion: string | null;
    tipoVisita: string;
  };
  id: string;
  tipo: 'recepcion' | 'accion' | 'avance' | 'cita';
  titulo: string;
  detalle: string | null;
  fecha: string;
}

export interface EventoPublico {
  id: string;
  fecha: string;
  titulo: string;
}

export interface VistaPortal {
  /** true = datos de demostración (no son de un proyecto real). */
  demo: boolean;
  folio: string;
  nombre: string;
  ubicacion: string;
  avance: { porcentaje: number; exacto: boolean; reglas: readonly string[] };
  etapas: { id: CompuertaId; nombre: string; descripcion: string; estado: string; tono: 'ok' | 'alerta' | 'neutro' | 'info'; porcentaje: number | null; actual: boolean }[];
  etapaActual: { id: CompuertaId; nombre: string; descripcion: string } | null;
  siguientePaso: { titulo: string; detalle: string; responsable: ResponsablePaso; fechaEstimada: string | null };
  /** null = el acceso no incluye ver documentos. */
  documentos: DocumentoSolicitado[] | null;
  guiaDocumental: GuiaDocumentoCliente[] | null;
  documentosTecnicos?: { id: string; nombre: string; responsable: 'idc' | 'tercero'; enExpediente: boolean; orientacion?: string }[];
  recepciones: Recepcion[];
  notificaciones: Notificacion[];
  historial: EventoPublico[];
  permisos: { subirDocumentos: boolean; editarParticipantes?: boolean };
}

/** Permisos del acceso del cliente (se guardan en `portal_accesos.permisos`). */
export interface PermisosPortal {
  ver_progreso: boolean;
  ver_documentos_autorizados: boolean;
  subir_documentos: boolean;
  editar_participantes?: boolean;
}
export const PERMISOS_PORTAL_POR_DEFECTO: PermisosPortal = { ver_progreso: true, ver_documentos_autorizados: true, subir_documentos: true };

export const normalizarFolio = (folio: string): string => folio.trim().toUpperCase();

const NECESITA_ACCION: readonly EstadoDocumentoCliente[] = ['pendiente', 'rechazado', 'vencido'];
const PUEDE_SUBIR: readonly EstadoDocumentoCliente[] = ['pendiente', 'rechazado', 'vencido', 'por_vencer', 'prevalidado'];
const MAX_NOTIFICACIONES = 30;

export interface EntradaVista {
  proyecto: Proyecto;
  catalogo: readonly Requisito[];
  /** ISO YYYY-MM-DD. */
  hoy: string;
  recepciones: readonly Recepcion[];
  permisos: PermisosPortal;
  datosAplicabilidad?: DatosCondicionAplicacion;
}

export function construirVistaPortal({ proyecto: p, catalogo, hoy, recepciones, permisos, datosAplicabilidad = {} }: EntradaVista): VistaPortal {
  const disponible = p.documentosDisponibles;
  const checklist = disponible ? evaluarChecklist(catalogo, p.documentos) : null;
  const avance = calcularAvance({ compuertas: p.compuertas, checklist });
  const estadoDe = (id: CompuertaId) => p.compuertas.find((c) => c.id === id)?.estado ?? 'pendiente';
  const actual = ORDEN_COMPUERTAS.find((id) => estadoDe(id) !== 'liberada') ?? null;

  // ---- Documentos que debe aportar el cliente ----
  const requisitosCliente = catalogo.filter((r) => r.activo !== false && r.aportaCliente &&
    (r.obligatorio || (!!r.condicionesAplicacion?.length && evaluarAplicabilidad(r, datosAplicabilidad) === 'aplica')));
  const vigencias = disponible ? evaluarVigencias(catalogo.filter((r) => r.aportaCliente), p.documentos, hoy) : [];
  const ultimaRecepcion = (id: string) => [...recepciones].filter((r) => r.documentoId === id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  // Sin expediente en la fuente NO se puede afirmar qué falta: no se muestra ningún documento (ni como pendiente).
  const documentos: DocumentoSolicitado[] = (disponible ? requisitosCliente : []).map((req) => {
    const doc = p.documentos.find((d) => d.tipo === req.tipo) ?? null;
    const rec = ultimaRecepcion(req.tipo);
    const vig = doc ? vigencias.find((h) => h.evidencias[0]?.documentoId === doc.id) : undefined;
    let estado: EstadoDocumentoCliente;
    let detalle: string | null = null;
    const aplicabilidad = evaluarAplicabilidad(req, datosAplicabilidad);
    if (rec?.estado === 'rechazado') { estado = 'rechazado'; detalle = rec.motivo ?? 'IDC pidió que lo envíes de nuevo.'; }
    else if (rec?.estado === 'recibido') { estado = 'en_revision'; detalle = 'Recibimos tu archivo. Está en espera de revisión por IDC.'; }
    else if (rec?.estado === 'en_revision') { estado = 'en_revision'; detalle = 'IDC está revisando tu archivo.'; }
    else if (rec?.estado === 'prevalidado') { estado = 'prevalidado'; detalle = 'IDC prevalidó esta copia. La validación definitiva se registra por separado.'; }
    else if (rec?.estado === 'aceptado') estado = 'aceptado';
    else if (doc) {
      if (vig?.subtipo === 'vencido') { estado = 'vencido'; detalle = 'El documento está vencido. Prepara una versión vigente.'; }
      else if (vig?.subtipo === 'por_vencer') { estado = 'por_vencer'; detalle = 'Está por vencer: ten listo uno actualizado.'; }
      else estado = 'recibido';
    } else estado = aplicabilidad === 'no_aplica' ? 'no_aplica' : 'pendiente';
    const condicionActiva = !!req.condicion || !!req.condicionesAplicacion?.length;
    const permiteMultiples = req.permiteMultiplesArchivos === true || req.guiaPreparacion?.permiteMultiples === true;
    const puedeSubirPorEstado = PUEDE_SUBIR.includes(estado) || (permiteMultiples && (estado === 'en_revision' || estado === 'recibido'));
    return { id: req.tipo, nombre: req.nombre, etapa: req.compuerta, estado, detalle,
      puedeSubir: permisos.subir_documentos && req.revisionDigital !== 'no_disponible' && (!condicionActiva || aplicabilidad === 'aplica') && puedeSubirPorEstado,
      vigencia: doc?.fechaVigencia ?? null };
  });
  const guiaDocumental: GuiaDocumentoCliente[] = catalogo.filter((r) => r.activo !== false && r.aportaCliente).map((r) => ({
    guiaPreparacion: r.guiaPreparacion, revisionDigital: r.revisionDigital, generacionAutomatica: r.generacionAutomatica,
    ...(r.categoriaPortal && { categoriaPortal: r.categoriaPortal }),
    ...(r.emisorDocumento && { emisorDocumento: r.emisorDocumento }),
    ...(r.permiteMultiplesArchivos && { permiteMultiples: true }),
    ...(r.requiereEntregaFisica && { requiereEntregaFisica: r.requiereEntregaFisica }),
    id: r.tipo, nombre: r.nombre, descripcion: r.descripcion ?? null, etapa: r.compuerta, condicion: r.condicion ?? null,
    canal: r.canal, requiereVigencia: r.requiereVigencia === true, quienAporta: r.quienAporta ?? 'cliente',
    instrucciones: r.instruccionesCliente ?? null, camposEsperados: r.camposEsperados ?? [], ejemplosAutorizados: r.ejemplosAutorizados ?? [],
    validacionIdc: r.validacionIdc ?? 'pendiente', aplicabilidad: evaluarAplicabilidad(r, datosAplicabilidad),
  }));
  const porHacer = documentos.filter((d) => NECESITA_ACCION.includes(d.estado));

  // ---- Siguiente paso: por reglas, nunca con textos internos ----
  const proximaFecha = actual
    ? p.cronograma.filter((a) => a.compuerta === actual && evaluarActividad(a, hoy).estado !== 'completada').map((a) => a.finPlan).sort()[0] ?? null
    : null;
  const etapaTxt = actual ? ETAPA_CLIENTE[actual] : null;
  const siguientePaso: VistaPortal['siguientePaso'] =
    actual === null
      ? { titulo: 'Tu trámite está completo', detalle: 'Todas las etapas están terminadas. Gracias por confiar en IDC.', responsable: 'idc', fechaEstimada: null }
      : permisos.ver_documentos_autorizados && porHacer.length > 0
        ? { titulo: porHacer.length === 1 ? `Entrega: ${porHacer[0]!.nombre}` : `Entrega ${porHacer.length} documentos`, detalle: 'Súbelos en la sección Documentos; en cuanto los recibamos te lo confirmamos.', responsable: 'cliente', fechaEstimada: proximaFecha }
        : estadoDe(actual) === 'bloqueada'
          ? { titulo: 'Tu proyecto está en pausa', detalle: 'IDC se pondrá en contacto contigo para continuar.', responsable: 'idc', fechaEstimada: null }
          : actual === 'G3' && estadoDe(actual) === 'en_revision'
            ? { titulo: 'CFE y la verificación están en proceso', detalle: 'Esperamos la respuesta de CFE y de la unidad verificadora. Te avisaremos aquí.', responsable: 'cfe', fechaEstimada: proximaFecha }
            : estadoDe(actual) === 'en_revision'
              ? { titulo: `IDC trabaja en «${etapaTxt!.nombre}»`, detalle: etapaTxt!.descripcion, responsable: 'idc', fechaEstimada: proximaFecha }
              : { titulo: `Sigue «${etapaTxt!.nombre}»`, detalle: etapaTxt!.descripcion, responsable: 'idc', fechaEstimada: proximaFecha };

  // ---- Notificaciones (derivadas; nunca texto libre interno) ----
  const notificaciones: Notificacion[] = [];
  for (const r of permisos.ver_documentos_autorizados ? recepciones.filter((r) => !r.sustituida) : []) {
    notificaciones.push(r.estado === 'rechazado'
      ? { id: `n:rechazo:${r.recibo}`, documentoId: r.documentoId, tipo: 'accion', titulo: `«${r.documento}» necesita una corrección`, detalle: r.motivo, fecha: r.revisadoEn ?? r.fecha }
      : { id: `n:recepcion:${r.recibo}`, documentoId: r.documentoId, tipo: 'recepcion', titulo: r.estado === 'aceptado' ? `Validamos «${r.documento}» en el expediente` :
        r.estado === 'prevalidado' ? `Prevalidamos la copia de «${r.documento}»` : `Recibimos «${r.documento}»`, detalle: `Acuse ${r.recibo}`, fecha: r.fecha });
  }
  if (permisos.ver_documentos_autorizados) {
    if (porHacer.length > 0) notificaciones.push({ id: 'n:pendientes', tipo: 'accion', titulo: porHacer.length === 1 ? 'Tienes 1 documento por entregar' : `Tienes ${porHacer.length} documentos por entregar`, detalle: porHacer.map((d) => d.nombre).join(' · '), fecha: hoy });
    for (const d of documentos.filter((x) => x.estado === 'por_vencer')) notificaciones.push({ id: `n:por_vencer:${d.id}`, tipo: 'accion', titulo: `«${d.nombre}» está por vencer`, detalle: d.vigencia ? `Vigencia: ${d.vigencia}` : null, fecha: hoy });
  }
  for (const a of p.aprobaciones ?? []) notificaciones.push({ id: `n:etapa:${a.compuerta}`, tipo: 'avance', titulo: `Completamos la etapa «${ETAPA_CLIENTE[a.compuerta].nombre}»`, detalle: null, fecha: a.fecha });
  notificaciones.sort((x, y) => y.fecha.localeCompare(x.fecha) || x.id.localeCompare(y.id));

  // ---- Historial público: solo hechos con etiqueta fija ----
  const historial: EventoPublico[] = [];
  for (const h of p.hitos ?? []) {
    const titulo = h.tipo ? HITO_PUBLICO[h.tipo] : undefined;
    if (titulo && h.finReal) historial.push({ id: `h:${h.tipo}`, fecha: h.finReal, titulo });
  }
  for (const a of p.aprobaciones ?? []) historial.push({ id: `e:${a.compuerta}`, fecha: a.fecha, titulo: `Etapa completada: ${ETAPA_CLIENTE[a.compuerta].nombre}` });
  if (permisos.ver_documentos_autorizados) for (const r of recepciones) historial.push({ id: `r:${r.recibo}`, fecha: r.fecha.slice(0, 10), titulo: `Documento recibido: ${r.documento}` });
  historial.sort((x, y) => y.fecha.localeCompare(x.fecha) || x.id.localeCompare(y.id));

  return {
    demo: p.esMock,
    folio: p.folio,
    nombre: p.nombre,
    ubicacion: `${p.municipio}, ${p.estado}`,
    avance: { porcentaje: avance.porcentaje, exacto: avance.exacto, reglas: REGLAS_AVANCE },
    etapas: ORDEN_COMPUERTAS.map((id) => {
      const e = avance.etapas.find((x) => x.compuerta === id)!;
      const t = ESTADO_CLIENTE[e.estado];
      return { id, nombre: ETAPA_CLIENTE[id].nombre, descripcion: ETAPA_CLIENTE[id].descripcion, estado: t.texto, tono: t.tono, porcentaje: e.porcentaje, actual: id === actual };
    }),
    etapaActual: actual ? { id: actual, ...ETAPA_CLIENTE[actual] } : null,
    siguientePaso,
    documentos: permisos.ver_documentos_autorizados ? documentos : null,
    guiaDocumental: permisos.ver_documentos_autorizados ? guiaDocumental : null,
    documentosTecnicos: permisos.ver_documentos_autorizados ? catalogo.flatMap((r) =>
      r.activo !== false && !r.aportaCliente && (r.quienAporta === 'idc' || r.quienAporta === 'tercero')
        ? [{ id: r.tipo, nombre: r.nombre, responsable: r.quienAporta, enExpediente: p.documentos.some((d) => d.tipo === r.tipo),
          ...(p.esMock && r.guiaPreparacion?.motivo && { orientacion: r.guiaPreparacion.motivo }) }] : []) : [],
    recepciones: permisos.ver_documentos_autorizados ? [...recepciones].sort((a, b) => b.fecha.localeCompare(a.fecha)) : [],
    notificaciones: notificaciones.slice(0, MAX_NOTIFICACIONES),
    historial,
    permisos: { subirDocumentos: permisos.subir_documentos },
  };
}
