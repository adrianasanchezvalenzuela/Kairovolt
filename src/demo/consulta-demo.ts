/**
 * Consulta preliminar de nuevos proyectos (demo 00 «Antes de comenzar»). 100 % ficticia y local.
 *
 * CONTRATO MOCK para el panel IDC: `ConsultaPreliminar` es el registro que el portal público escribe y que el panel
 * puede leer del mismo estado compartido (localStorage `kairovolt:demo-consultas:v1`). Más adelante la autoridad
 * comercial será Zoho CRM; esa integración NO existe todavía. Ver docs/CONTRATO_CONSULTA_PRELIMINAR.md.
 * Los archivos adjuntos solo viven en memoria durante la sesión: aquí se guardan únicamente sus referencias.
 */
import { useSyncExternalStore } from 'react';
import { diaDemo } from '../data/personas-demo';

export type MotivoConsulta = 'interconectar' | 'regularizar' | 'asesoria';
export type TipoInmueble = 'residencial' | 'comercial' | 'industrial' | 'otro';
export type NivelTension = 'baja' | 'media' | 'no_se';
export type EtapaProyecto = 'explorando' | 'propuesta' | 'instalacion' | 'instalado';
export type MedioContacto = 'correo' | 'telefono' | 'whatsapp';
export type CategoriaAdjunto = 'recibo_cfe' | 'fotos' | 'cotizacion' | 'respuesta';
export type EstadoConsulta = 'recibida' | 'en_revision' | 'info_solicitada' | 'asesoria_programada' | 'propuesta_en_preparacion' | 'proyecto_formalizado' | 'cerrada';
export type TipoAsesoria = 'telefonica' | 'virtual' | 'presencial';

export interface AdjuntoRef { id: string; nombre: string; tamano: number; tipo: string; categoria: CategoriaAdjunto }
export interface MensajeConsulta { id: string; fecha: string; de: 'cliente' | 'idc' | 'sistema'; texto: string; adjuntos?: AdjuntoRef[]; canal: 'portal' | 'correo' | 'whatsapp' }
export interface CitaAsesoria { id: string; tipo: TipoAsesoria; fecha: string; hora: string; estado: 'pendiente_confirmacion' | 'confirmada'; nota?: string; creadaEn: string }
export interface NotificacionGestor { id: string; canal: 'correo' | 'whatsapp'; para: string; asunto?: string; texto: string; fecha: string }

export interface ConsultaPreliminar {
  idPreliminar: string;          // PRE-AAAA-NNN. NO es un folio KV ni sirve como credencial.
  codigoSeguimiento: string;     // código de PRUEBA para el seguimiento simulado (nunca basta el identificador público).
  nombre: string; correo: string; telefono?: string; medioContacto: MedioContacto; horarioContacto: string; consentimientoContacto: boolean;
  motivo: MotivoConsulta; tipoInmueble: TipoInmueble; ubicacion: string; potenciaKw: number | null; nivelTension: NivelTension;
  etapa: EtapaProyecto; descripcion: string;
  adjuntos: AdjuntoRef[];
  fechaSolicitud: string;
  estado: EstadoConsulta;
  responsable: { nombre: string; rol: string } | null;
  historial: MensajeConsulta[];
  cita?: CitaAsesoria;
  notificacionesGestor: NotificacionGestor[]; // simulación de correo y WhatsApp al gestor de proyectos
}
export type BorradorConsulta = Pick<ConsultaPreliminar, 'nombre' | 'correo' | 'medioContacto' | 'horarioContacto' | 'consentimientoContacto' | 'tipoInmueble' | 'ubicacion' | 'nivelTension' | 'descripcion'>
  & { telefono: string; motivo: MotivoConsulta | ''; etapa: EtapaProyecto | ''; potencia: string; adjuntos: AdjuntoRef[] };

export const TEXTO_ESTADO: Readonly<Record<EstadoConsulta, string>> = {
  recibida: 'Consulta recibida', en_revision: 'En revisión por IDC', info_solicitada: 'Información adicional solicitada', asesoria_programada: 'Asesoría programada',
  propuesta_en_preparacion: 'Propuesta en preparación', proyecto_formalizado: 'Proyecto formalizado', cerrada: 'Consulta cerrada',
};
export const ORDEN_ESTADOS: readonly EstadoConsulta[] = ['recibida', 'en_revision', 'info_solicitada', 'asesoria_programada', 'propuesta_en_preparacion', 'proyecto_formalizado', 'cerrada'];
export const GESTOR = { nombre: 'Ing. Paola Quintero', rol: 'Gestora de proyectos · IDC (ficticia)', correo: 'gestor-demo@example.invalid', whatsapp: '+52 662 000 0000 (ficticio)' } as const;
export const MENSAJE_INFO_ADICIONAL = 'Para orientarte mejor, necesitamos conocer la potencia aproximada de tu instalación. Si tienes una cotización de tus paneles solares, puedes adjuntarla aquí.';

// ───────── Archivos en memoria (nunca se persisten ni salen del navegador) ─────────
const archivos = new Map<string, { archivo: File; url: string }>();
export const URL_ADJUNTO = (id: string) => archivos.get(id)?.url;
export function registrarArchivo(categoria: CategoriaAdjunto, archivo: File): AdjuntoRef {
  const id = 'adj-' + Math.random().toString(36).slice(2, 9);
  archivos.set(id, { archivo, url: URL.createObjectURL(archivo) });
  return { id, nombre: archivo.name, tamano: archivo.size, tipo: archivo.type || 'application/octet-stream', categoria };
}
export function quitarArchivo(id: string) { const a = archivos.get(id); if (a) { URL.revokeObjectURL(a.url); archivos.delete(id); } }
export const tamanoLegible = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
export const MAX_ARCHIVO = 10 * 1024 * 1024;
export const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// ───────── Almacén ─────────
interface Almacen { v: number; consultas: Record<string, ConsultaPreliminar>; ultimo?: string }
const LLAVE = 'kairovolt:demo-consultas:v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const ahora = () => new Date().toISOString();

/** Caso ejemplo para ver el seguimiento sin llenar el formulario: IDC pidió información adicional. */
function ejemplo(): ConsultaPreliminar {
  return {
    idPreliminar: 'PRE-2026-000', codigoSeguimiento: 'PRUEBA-0000', nombre: 'Cliente de ejemplo', correo: 'cliente-ejemplo@example.invalid', medioContacto: 'correo', horarioContacto: 'Mañana (9:00 – 13:00)', consentimientoContacto: true,
    motivo: 'interconectar', tipoInmueble: 'comercial', ubicacion: 'Hermosillo, Sonora', potenciaKw: null, nivelTension: 'no_se', etapa: 'propuesta', descripcion: 'Tengo una cotización de paneles y quiero saber cómo seguir (texto ficticio).',
    adjuntos: [], fechaSolicitud: diaDemo(-3, 11), estado: 'info_solicitada', responsable: { nombre: GESTOR.nombre, rol: GESTOR.rol },
    historial: [
      { id: 'm1', fecha: diaDemo(-3, 11), de: 'sistema', texto: 'Consulta recibida. Referencia PRE-2026-000.', canal: 'portal' },
      { id: 'm2', fecha: diaDemo(-2, 9), de: 'idc', texto: 'Revisión inicial iniciada por el equipo de IDC.', canal: 'portal' },
      { id: 'm3', fecha: diaDemo(-1, 12), de: 'idc', texto: MENSAJE_INFO_ADICIONAL, canal: 'correo' },
    ],
    notificacionesGestor: [],
  };
}
function cargar(): Almacen {
  try { const c = localStorage.getItem(LLAVE); if (c) { const a = JSON.parse(c) as Almacen; if (a.v === 1) return a; } } catch { /* se siembra */ }
  return { v: 1, consultas: { 'PRE-2026-000': ejemplo() } };
}
let almacen: Almacen = cargar();
const oyentes = new Set<() => void>();
const guardar = (a: Almacen) => { almacen = a; try { localStorage.setItem(LLAVE, JSON.stringify(a)); } catch { /* sin persistencia */ } oyentes.forEach((f) => f()); };
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === LLAVE) { almacen = cargar(); oyentes.forEach((f) => f()); } });
const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
export const useConsultas = (): Almacen => useSyncExternalStore(suscribir, () => almacen);
export const leerConsulta = (id: string) => almacen.consultas[id];

function mutar(id: string, f: (c: ConsultaPreliminar) => ConsultaPreliminar) {
  const c = almacen.consultas[id]; if (!c) return;
  guardar({ ...almacen, consultas: { ...almacen.consultas, [id]: f(c) } });
}
const msg = (de: MensajeConsulta['de'], texto: string, canal: MensajeConsulta['canal'] = 'portal', adjuntos?: AdjuntoRef[]): MensajeConsulta => ({ id: 'm-' + uid(), fecha: ahora(), de, texto, canal, adjuntos });

export const borradorVacio = (): BorradorConsulta => ({
  motivo: '', tipoInmueble: 'residencial', ubicacion: '', potencia: '', nivelTension: 'no_se', descripcion: '', etapa: '', adjuntos: [],
  nombre: '', correo: '', telefono: '', medioContacto: 'correo', horarioContacto: 'Mañana (9:00 – 13:00)', consentimientoContacto: false,
});

export const accionesConsulta = {
  /** Registra la consulta y simula las notificaciones al gestor (correo y WhatsApp). No crea proyectos ni folios KV. */
  enviar(b: BorradorConsulta): ConsultaPreliminar {
    const n = Object.keys(almacen.consultas).length; // 000 es el ejemplo → la primera propia es 001
    const id = `PRE-2026-${String(n).padStart(3, '0')}`;
    const potencia = Number(b.potencia.replace(',', '.'));
    const notificaciones: NotificacionGestor[] = [
      { id: 'n-' + uid(), canal: 'correo', para: GESTOR.correo, asunto: `Nueva consulta preliminar ${id}`, texto: `${b.nombre} consulta por «${b.motivo}» (${b.tipoInmueble}, ${b.ubicacion}). Responder por ${b.medioContacto}, ${b.horarioContacto}.`, fecha: ahora() },
      { id: 'n-' + uid(), canal: 'whatsapp', para: GESTOR.whatsapp, texto: `Nueva consulta ${id}: ${b.nombre}, ${b.ubicacion}. Revisa el panel de IDC.`, fecha: ahora() },
    ];
    const c: ConsultaPreliminar = {
      idPreliminar: id, codigoSeguimiento: 'PRUEBA-' + String(n).padStart(4, '0'), nombre: b.nombre.trim(), correo: b.correo.trim(), telefono: b.telefono.trim() || undefined, medioContacto: b.medioContacto,
      horarioContacto: b.horarioContacto, consentimientoContacto: b.consentimientoContacto, motivo: b.motivo as MotivoConsulta, tipoInmueble: b.tipoInmueble, ubicacion: b.ubicacion.trim(),
      potenciaKw: Number.isFinite(potencia) && potencia > 0 ? potencia : null, nivelTension: b.nivelTension, etapa: b.etapa as EtapaProyecto, descripcion: b.descripcion.trim(), adjuntos: b.adjuntos,
      fechaSolicitud: ahora(), estado: 'recibida', responsable: null,
      historial: [msg('sistema', `Consulta recibida. Referencia ${id}. (Simulación: no se envió información real.)`)], notificacionesGestor: notificaciones,
    };
    guardar({ ...almacen, consultas: { ...almacen.consultas, [id]: c }, ultimo: id });
    return c;
  },
  responder(id: string, texto: string, adjuntos: AdjuntoRef[]) {
    mutar(id, (c) => ({ ...c, adjuntos: [...c.adjuntos, ...adjuntos], estado: c.estado === 'info_solicitada' ? 'en_revision' : c.estado, historial: [...c.historial, msg('cliente', texto, 'portal', adjuntos)] }));
  },
  solicitarAsesoria(id: string, tipo: TipoAsesoria, fecha: string, hora: string, nota: string) {
    mutar(id, (c) => ({ ...c, cita: { id: 'ASE-' + uid().toUpperCase(), tipo, fecha, hora, nota: nota || undefined, estado: 'pendiente_confirmacion', creadaEn: ahora() },
      historial: [...c.historial, msg('cliente', `Solicité una asesoría ${tipo} para el ${fecha} a las ${hora}. Pendiente de confirmación de IDC.`)] }));
  },
  /** Controles de presentación: simulan lo que registraría IDC (no modifican ningún panel). */
  simularIdc(id: string, estado: EstadoConsulta) {
    const textos: Partial<Record<EstadoConsulta, string>> = {
      en_revision: 'El equipo de IDC inició la revisión de tu consulta.', info_solicitada: MENSAJE_INFO_ADICIONAL,
      asesoria_programada: 'IDC confirmó tu asesoría. Te contactaremos en el horario acordado.', propuesta_en_preparacion: 'Estamos preparando una propuesta de acompañamiento (sin garantía de viabilidad técnica ni aprobación de CFE).',
      proyecto_formalizado: 'Tu proyecto se formalizó con IDC. Un asesor te compartirá tu folio y acceso al portal.', cerrada: 'La consulta se cerró. Puedes iniciar una nueva cuando quieras.',
    };
    mutar(id, (c) => ({ ...c, estado, responsable: c.responsable ?? { nombre: GESTOR.nombre, rol: GESTOR.rol },
      cita: estado === 'asesoria_programada' && c.cita ? { ...c.cita, estado: 'confirmada' } : c.cita,
      historial: [...c.historial, ...(textos[estado] ? [msg('idc', textos[estado]!, estado === 'info_solicitada' ? 'correo' : 'portal')] : [])] }));
  },
  reiniciar() { guardar({ v: 1, consultas: { 'PRE-2026-000': ejemplo() } }); },
};

/** Valida el acceso de seguimiento de PRUEBA: el identificador público por sí solo no basta. */
export function accederSeguimiento(id: string, codigo: string): ConsultaPreliminar | null {
  const c = almacen.consultas[id.trim().toUpperCase()];
  return c && c.codigoSeguimiento === codigo.trim().toUpperCase() ? c : null;
}
