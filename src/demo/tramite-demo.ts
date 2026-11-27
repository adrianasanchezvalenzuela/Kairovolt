/**
 * Estado MOCK del trámite posterior a la entrega física (demos 4, 5 y 6), compartido por folio entre el portal del
 * cliente y el panel IDC de demostración. Vive en localStorage: no toca Supabase, Zoho ni CFE ni envía correos.
 * El flujo sigue el Manual 4 (interconexión FV, escenario sin estudio ni obra): solicitud, registro y número,
 * resolución favorable, contratos (interconexión y contraprestación), medidor bidireccional e incorporación al sistema comercial.
 */
import { useSyncExternalStore } from 'react';
import type { Notificacion, VistaPortal } from '../application/portal-cliente';
import { FOLIOS_TRAMITE_DEMO } from '../data/demos-portal';
import { diaDemo } from '../data/personas-demo';
import { CORREO_CLIENTE_DEMO, expedienteDemoCompleto, leerExpedienteDemo } from './expediente-demo';

export const esFolioTramite = (folio: string) => FOLIOS_TRAMITE_DEMO.includes(folio);
export const FOLIO_APROBADA = FOLIOS_TRAMITE_DEMO[0] as string;
export const FOLIO_MEDIDOR = FOLIOS_TRAMITE_DEMO[1] as string;
export const FOLIO_CONCLUIDA = FOLIOS_TRAMITE_DEMO[2] as string;

/** Datos fijos del escenario: todas las pantallas leen de aquí. */
export const ESCENARIO = {
  numeroSolicitud: 'SOL-DEMO-0042',
  esquema: 'Medición neta (Net Metering)',
  capacidadAcKw: 40,
  capacidadDcKwp: 40,
  tipoTramite: 'Interconexión FV en media tensión · Generación Distribuida',
  medidor: 'MED-DEMO-00417',
  firma: {
    lugar: 'Oficina de CFE de la zona (dirección ficticia de demostración)',
    responsable: 'CFE Distribución (interconexión) y CFE Suministrador (contraprestación)',
    acompana: 'Ing. Paola Quintero, IDC Sistemas Eléctricos',
  },
  instalacionPor: 'CFE',
  seguimientoPor: 'IDC',
  tipoVisita: 'Cambio a medidor bidireccional',
} as const;

export type ClaveContrato = 'interconexion' | 'contraprestacion';
export type EstadoContrato = 'no_disponible' | 'disponible' | 'formalizado';
export type EstadoInstalacion = 'no_habilitada' | 'pendiente_cfe' | 'programada' | 'reprogramada' | 'pendiente_nueva_fecha' | 'instalada';
export type Responsable = 'IDC' | 'CFE' | 'Cliente' | 'KairóVolt';

export interface ContratoDemo {
  estado: EstadoContrato; preparadoEn?: string; revisadoPorCliente?: string; reportes: { texto: string; fecha: string }[];
  coordinacion?: { fecha: string; hora: string }; formalizadoEn?: string;
}
export interface FranjaFecha { fecha: string; franja: string }
export interface InstalacionDemo {
  estado: EstadoInstalacion; seguimientoIdc?: string; programada?: FranjaFecha; anterior?: FranjaFecha; motivo?: string; actualizadoEn?: string;
  medidor?: { numero: string; fecha: string }; disponibilidad?: { estado: 'confirmada' | 'inconveniente'; texto?: string; fecha: string }; checklist: string[];
}
export interface EventoTramite { id: string; fecha: string; titulo: string; responsable: Responsable }
export interface CorreoTramite { asunto: string; para: string; parrafos: string[]; boton: string }
export interface AvisoTramite { id: string; fecha: string; titulo: string; detalle: string; leido: boolean; ruta: string; accion: string; correo: CorreoTramite }
export interface TramiteDemo {
  recepcionFisica?: string; ingresoCfe?: string; numeroSolicitud?: string; registroEn?: string; enRevision?: string;
  resolucion?: { fecha: string; archivo: string };
  contratos: Record<ClaveContrato, ContratoDemo>;
  instalacion: InstalacionDemo;
  interconexionFisica?: string; sistemaComercial?: string; cierre?: string;
  eventos: EventoTramite[]; avisos: AvisoTramite[];
  encuesta?: { estrellas: number; comentario: string; fecha: string };
}
interface Almacen { v: number; folios: Record<string, TramiteDemo> }

const LLAVE = 'kairovolt:demo-tramite:v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const ahora = () => new Date().toISOString();
/** ISO con hora fija; `d` días respecto a hoy (negativo = pasado). */
const dia = (d: number, h = 10) => diaDemo(d, h);
const soloFecha = (iso: string) => iso.slice(0, 10);

export const CHECKLIST_INSTALACION: readonly { id: string; texto: string }[] = [
  { id: 'persona', texto: 'Confirmar que habrá una persona disponible en el inmueble.' },
  { id: 'acceso', texto: 'Facilitar el acceso autorizado al área del medidor.' },
  { id: 'info', texto: 'Tener disponible la información del servicio si se solicita.' },
  { id: 'avisos', texto: 'Revisar los avisos de IDC.' },
  { id: 'contacto', texto: 'Mantener actualizados los datos de contacto.' },
];

// ───────────────────────── Semillas ─────────────────────────
function aviso(fecha: string, titulo: string, detalle: string, ruta: string, accion: string, leido = false, parrafos?: string[]): AvisoTramite {
  return { id: 'a-' + uid(), fecha, titulo, detalle, leido, ruta, accion, correo: { asunto: 'KairóVolt | ' + titulo, para: CORREO_CLIENTE_DEMO, parrafos: parrafos ?? ['Hola, cliente de demostración.', detalle], boton: accion } };
}
const ev = (fecha: string, titulo: string, responsable: Responsable): EventoTramite => ({ id: 'e-' + uid(), fecha, titulo, responsable });

function base(): TramiteDemo {
  return {
    contratos: { interconexion: { estado: 'no_disponible', reportes: [] }, contraprestacion: { estado: 'no_disponible', reportes: [] } },
    instalacion: { estado: 'no_habilitada', checklist: [] }, eventos: [], avisos: [],
  };
}

function hastaResolucion(): TramiteDemo {
  const t = base();
  t.recepcionFisica = dia(-26); t.ingresoCfe = dia(-25, 12); t.registroEn = dia(-24, 9); t.numeroSolicitud = ESCENARIO.numeroSolicitud; t.enRevision = dia(-23);
  t.resolucion = { fecha: dia(-17, 11), archivo: 'oficio-resolutivo-demostracion.pdf' };
  for (const k of ['interconexion', 'contraprestacion'] as const) t.contratos[k] = { estado: 'disponible', preparadoEn: dia(-16), reportes: [] };
  t.eventos = [
    ev(dia(-26), 'Expediente físico recibido por IDC', 'IDC'),
    ev(dia(-25, 12), 'Expediente ingresado ante CFE', 'IDC'),
    ev(dia(-24, 9), `Número de solicitud registrado (${ESCENARIO.numeroSolicitud})`, 'CFE'),
    ev(dia(-23), 'Solicitud en revisión', 'CFE'),
    ev(dia(-17, 11), 'Resolución favorable recibida', 'CFE'),
    ev(dia(-16), 'Contratos disponibles', 'IDC'),
  ];
  t.avisos = [
    aviso(dia(-16), 'Tus contratos están disponibles', 'Revisa el contrato de interconexión y el de contraprestación para continuar.', '/portal/contratos', 'Revisar mis contratos'),
    aviso(dia(-17, 11), 'Tu solicitud recibió una resolución favorable', 'CFE emitió una resolución favorable para tu solicitud.', '/portal/documentos', 'Consultar el oficio', true),
    aviso(dia(-25, 12), 'Tu expediente fue ingresado ante CFE', 'IDC ingresó tu expediente. Te avisaremos de cada avance.', '/portal/recorrido', 'Ver mi recorrido', true),
  ];
  return t;
}

function hastaContratos(): TramiteDemo {
  const t = hastaResolucion();
  t.contratos.interconexion = { ...t.contratos.interconexion, estado: 'formalizado', revisadoPorCliente: dia(-12), coordinacion: { fecha: soloFecha(dia(-9)), hora: '10:00' }, formalizadoEn: dia(-9, 11) };
  t.contratos.contraprestacion = { ...t.contratos.contraprestacion, estado: 'formalizado', revisadoPorCliente: dia(-12), coordinacion: { fecha: soloFecha(dia(-9)), hora: '10:00' }, formalizadoEn: dia(-9, 12) };
  t.instalacion = { estado: 'pendiente_cfe', seguimientoIdc: soloFecha(dia(3)), actualizadoEn: dia(-1), checklist: [] };
  t.eventos.unshift(ev(dia(-9, 12), 'Contratos formalizados', 'CFE'));
  t.avisos.unshift(aviso(dia(-9, 12), 'Tus contratos fueron formalizados', 'Ya firmaste ambos contratos. Ahora esperamos la fecha de instalación de tu medidor.', '/portal/instalacion', 'Ver mi instalación'));
  return t;
}

/** Demo 5: instalación ya comunicada por CFE para el jueves 10 de diciembre (fecha ficticia fija). */
function programadaDic(): TramiteDemo {
  const t = hastaContratos();
  t.instalacion = { ...t.instalacion, estado: 'programada', programada: { fecha: '2026-12-10', franja: '09:00 – 13:00' }, actualizadoEn: dia(-1), seguimientoIdc: undefined };
  t.eventos = [ev(dia(-1), 'Instalación programada', 'CFE'), ...t.eventos];
  t.avisos = [aviso(dia(-1), 'Tu instalación fue programada', 'CFE comunicó el 2026-12-10 (09:00 – 13:00) para instalar tu medidor.', '/portal/instalacion', 'Ver mi instalación'), ...t.avisos];
  return t;
}

function concluida(): TramiteDemo {
  const t = hastaContratos();
  t.instalacion = { estado: 'instalada', programada: { fecha: soloFecha(dia(-6)), franja: '09:00 – 13:00' }, actualizadoEn: dia(-6, 13), medidor: { numero: ESCENARIO.medidor, fecha: soloFecha(dia(-6)) }, disponibilidad: { estado: 'confirmada', fecha: dia(-7) }, checklist: CHECKLIST_INSTALACION.map((c) => c.id) };
  t.interconexionFisica = dia(-6, 15); t.sistemaComercial = dia(-5, 10); t.cierre = dia(-5, 12);
  t.eventos.unshift(
    ev(dia(-5, 12), 'Trámite cerrado', 'IDC'), ev(dia(-5, 10), 'Incorporación al sistema comercial confirmada', 'CFE'),
    ev(dia(-6, 15), 'Interconexión física confirmada', 'CFE'), ev(dia(-6, 13), 'Medidor bidireccional instalado', 'CFE'),
    ev(dia(-8), 'Instalación programada', 'CFE'),
  );
  t.avisos.unshift(
    aviso(dia(-5, 12), 'Tu interconexión ha concluido', 'Tu sistema fotovoltaico ya está interconectado. Gracias por recorrer este camino con nosotros.', '/portal/expediente', 'Ver mi expediente final'),
    aviso(dia(-6, 13), 'Tu medidor fue instalado', `CFE instaló tu medidor bidireccional (${ESCENARIO.medidor}).`, '/portal/instalacion', 'Ver mi instalación', true),
    aviso(dia(-8), 'Tu instalación fue programada', 'CFE comunicó la fecha de instalación de tu medidor.', '/portal/instalacion', 'Ver mi instalación', true),
  );
  return t;
}

function semilla(folio: string): TramiteDemo {
  const t = folio === FOLIO_CONCLUIDA ? concluida() : folio === FOLIO_MEDIDOR ? programadaDic() : hastaResolucion();
  // Más reciente primero.
  t.eventos.sort((a, b) => b.fecha.localeCompare(a.fecha)); t.avisos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return t;
}

// ───────────────────────── Almacén reactivo ─────────────────────────
function cargar(): Almacen {
  try { const c = localStorage.getItem(LLAVE); if (c) { const a = JSON.parse(c) as Almacen; if (a.v === 1) return a; } } catch { /* se siembra */ }
  return { v: 1, folios: {} };
}
let almacen: Almacen = cargar();
const oyentes = new Set<() => void>();
const guardar = (a: Almacen) => { almacen = a; try { localStorage.setItem(LLAVE, JSON.stringify(a)); } catch { /* sin persistencia */ } oyentes.forEach((f) => f()); };
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === LLAVE) { almacen = cargar(); oyentes.forEach((f) => f()); } });
const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };

export function leerTramite(folio: string): TramiteDemo {
  const t = almacen.folios[folio];
  if (t) return t;
  const n = semilla(folio);
  almacen = { ...almacen, folios: { ...almacen.folios, [folio]: n } };
  return n;
}
export const useTramiteDemo = (folio: string): TramiteDemo => useSyncExternalStore(suscribir, () => leerTramite(folio));
export const useVersionTramiteDemo = (): unknown => useSyncExternalStore(suscribir, () => almacen);

function mutar(folio: string, f: (t: TramiteDemo) => TramiteDemo) { guardar({ ...almacen, folios: { ...almacen.folios, [folio]: f(leerTramite(folio)) } }); }
function registrar(t: TramiteDemo, titulo: string, resp: Responsable, a?: Omit<AvisoTramite, 'id' | 'fecha' | 'leido' | 'correo'> & { parrafos?: string[] }): TramiteDemo {
  const f = ahora();
  return {
    ...t, eventos: [{ id: 'e-' + uid(), fecha: f, titulo, responsable: resp }, ...t.eventos],
    avisos: a ? [aviso(f, a.titulo, a.detalle, a.ruta, a.accion, false, a.parrafos), ...t.avisos] : t.avisos,
  };
}

// ───────────────────────── Reglas de prerequisitos (las usa el panel IDC y el portal) ─────────────────────────
export const contratosFormalizados = (t: TramiteDemo) => t.contratos.interconexion.estado === 'formalizado' && t.contratos.contraprestacion.estado === 'formalizado';
export const instalacionHabilitada = (t: TramiteDemo) => contratosFormalizados(t) && t.instalacion.estado !== 'no_habilitada';
/** Razón por la que una acción no se puede registrar todavía (null = se puede). */
export const bloqueo = {
  ingreso: (t: TramiteDemo) => (t.recepcionFisica ? null : 'Primero registra la recepción física del expediente.'),
  numero: (t: TramiteDemo) => (t.ingresoCfe ? null : 'Primero registra el ingreso ante CFE.'),
  resolucion: (t: TramiteDemo) => (t.numeroSolicitud ? null : 'Primero captura el número de solicitud.'),
  contratos: (t: TramiteDemo) => (t.resolucion ? null : 'Se publican después de la resolución favorable.'),
  formalizar: (t: TramiteDemo, k: ClaveContrato) => (t.contratos[k].estado === 'disponible' ? null : 'El contrato debe estar publicado.'),
  programar: (t: TramiteDemo) => (!contratosFormalizados(t) ? 'Requiere ambos contratos formalizados.' : ['pendiente_cfe', 'pendiente_nueva_fecha'].includes(t.instalacion.estado) ? null : 'Ya hay una fecha registrada; usa reprogramar.'),
  reprogramar: (t: TramiteDemo) => (['programada', 'reprogramada'].includes(t.instalacion.estado) ? null : 'Primero debe haber una fecha comunicada por CFE.'),
  instalar: (t: TramiteDemo) => (['programada', 'reprogramada'].includes(t.instalacion.estado) ? null : 'Requiere una instalación programada y confirmada.'),
  fisica: (t: TramiteDemo) => (t.instalacion.estado === 'instalada' ? (t.interconexionFisica ? 'Ya está confirmada.' : null) : 'Primero registra la instalación del medidor.'),
  comercial: (t: TramiteDemo) => (!t.interconexionFisica ? 'Primero confirma la interconexión física.' : t.sistemaComercial ? 'Ya está confirmada.' : null),
  cerrar: (t: TramiteDemo) => (!t.sistemaComercial ? 'Faltan la interconexión física y la incorporación al sistema comercial.' : t.cierre ? 'El trámite ya está cerrado.' : null),
};

// ───────────────────────── Acciones ─────────────────────────
export const accionesTramite = {
  reiniciar(folio: string) { mutar(folio, () => semilla(folio)); },

  // IDC
  recepcionFisica(folio: string) { mutar(folio, (t) => registrar({ ...t, recepcionFisica: ahora() }, 'Expediente físico recibido por IDC', 'IDC')); },
  ingresoCfe(folio: string) {
    mutar(folio, (t) => bloqueo.ingreso(t) ? t : registrar({ ...t, ingresoCfe: ahora() }, 'Expediente ingresado ante CFE', 'IDC',
      { titulo: 'Tu expediente fue ingresado ante CFE', detalle: 'IDC ingresó tu expediente. Te avisaremos cuando CFE registre tu solicitud.', ruta: '/portal/recorrido', accion: 'Ver mi recorrido' }));
  },
  numeroSolicitud(folio: string, numero: string) {
    mutar(folio, (t) => bloqueo.numero(t) || !numero.trim() ? t : registrar(registrar({ ...t, numeroSolicitud: numero.trim(), registroEn: ahora(), enRevision: ahora() }, `Número de solicitud registrado (${numero.trim()})`, 'CFE'), 'Solicitud en revisión', 'CFE'));
  },
  resolucion(folio: string, archivo: string) {
    mutar(folio, (t) => bloqueo.resolucion(t) ? t : registrar({ ...t, resolucion: { fecha: ahora(), archivo } }, 'Resolución favorable recibida', 'CFE',
      { titulo: 'Tu solicitud recibió una resolución favorable', detalle: 'CFE emitió una resolución favorable. Estamos más cerca de conectar tu sistema solar.', ruta: '/portal/inicio', accion: 'Ver mi avance' }));
  },
  publicarContratos(folio: string) {
    mutar(folio, (t) => bloqueo.contratos(t) || t.contratos.interconexion.estado !== 'no_disponible' ? t : registrar({
      ...t, contratos: { interconexion: { ...t.contratos.interconexion, estado: 'disponible', preparadoEn: ahora() }, contraprestacion: { ...t.contratos.contraprestacion, estado: 'disponible', preparadoEn: ahora() } },
    }, 'Contratos disponibles', 'IDC', { titulo: 'Tus contratos están disponibles', detalle: 'Revisa el contrato de interconexión y el de contraprestación para continuar.', ruta: '/portal/contratos', accion: 'Revisar mis contratos' }));
  },
  coordinarFirma(folio: string, clave: ClaveContrato, fecha: string, hora: string) {
    mutar(folio, (t) => registrar({ ...t, contratos: { ...t.contratos, [clave]: { ...t.contratos[clave], coordinacion: { fecha, hora } } } }, `Firma coordinada para el contrato de ${clave === 'interconexion' ? 'interconexión' : 'contraprestación'}`, 'IDC',
      { titulo: 'IDC coordinó tu firma', detalle: `${fecha} · ${hora}. ${ESCENARIO.firma.lugar}.`, ruta: '/portal/contratos', accion: 'Ver detalles' }));
  },
  formalizar(folio: string, clave: ClaveContrato) {
    mutar(folio, (t) => {
      if (bloqueo.formalizar(t, clave)) return t;
      let n = registrar({ ...t, contratos: { ...t.contratos, [clave]: { ...t.contratos[clave], estado: 'formalizado' as const, formalizadoEn: ahora() } } },
        `Contrato de ${clave === 'interconexion' ? 'interconexión' : 'contraprestación'} formalizado`, clave === 'interconexion' ? 'CFE' : 'CFE');
      if (contratosFormalizados(n)) {
        n = registrar({ ...n, instalacion: { ...n.instalacion, estado: 'pendiente_cfe', seguimientoIdc: soloFecha(dia(3)), actualizadoEn: ahora() } }, 'Contratos formalizados', 'IDC',
          { titulo: 'Tus contratos fueron formalizados', detalle: 'Ya están firmados ambos contratos. Ahora esperamos la fecha de instalación de tu medidor.', ruta: '/portal/instalacion', accion: 'Ver mi instalación' });
      }
      return n;
    });
  },
  programarInstalacion(folio: string, fecha: string, franja: string) {
    mutar(folio, (t) => bloqueo.programar(t) ? t : registrar({ ...t, instalacion: { ...t.instalacion, estado: 'programada', programada: { fecha, franja }, anterior: undefined, motivo: undefined, actualizadoEn: ahora(), seguimientoIdc: undefined } },
      'Instalación programada', 'CFE', { titulo: 'Tu instalación fue programada', detalle: `CFE comunicó ${fecha} (${franja}) para instalar tu medidor.`, ruta: '/portal/instalacion', accion: 'Ver mi instalación' }));
  },
  reprogramarInstalacion(folio: string, nueva: FranjaFecha | null, motivo: string) {
    mutar(folio, (t) => {
      if (bloqueo.reprogramar(t) || !t.instalacion.programada) return t;
      const anterior = t.instalacion.programada;
      const inst: InstalacionDemo = nueva
        ? { ...t.instalacion, estado: 'reprogramada', anterior, programada: nueva, motivo, actualizadoEn: ahora() }
        : { ...t.instalacion, estado: 'pendiente_nueva_fecha', anterior, programada: undefined, motivo, actualizadoEn: ahora(), seguimientoIdc: soloFecha(dia(2)) };
      const detalle = nueva ? `CFE cambió la fecha. Nueva fecha: ${nueva.fecha} (${nueva.franja}). Motivo: ${motivo}` : `CFE canceló la fecha anterior y aún no comunica una nueva. Motivo: ${motivo}`;
      return registrar({ ...t, instalacion: inst }, nueva ? 'Instalación reprogramada' : 'Instalación pendiente de nueva fecha', 'CFE',
        { titulo: 'Tu instalación fue reprogramada', detalle, ruta: '/portal/instalacion', accion: 'Ver mi instalación', parrafos: ['Hola, cliente de demostración.', detalle, 'IDC da seguimiento y te avisará de cualquier cambio.'] });
    });
  },
  registrarInstalacion(folio: string, fecha: string, numero: string) {
    mutar(folio, (t) => bloqueo.instalar(t) ? t : registrar({ ...t, instalacion: { ...t.instalacion, estado: 'instalada', medidor: { numero: numero.trim() || ESCENARIO.medidor, fecha }, actualizadoEn: ahora() } },
      'Medidor bidireccional instalado', 'CFE', { titulo: 'Tu medidor fue instalado', detalle: `CFE instaló tu medidor bidireccional el ${fecha}. Falta confirmar la interconexión física y la incorporación al sistema comercial.`, ruta: '/portal/instalacion', accion: 'Ver mi instalación' }));
  },
  confirmarFisica(folio: string) { mutar(folio, (t) => bloqueo.fisica(t) ? t : registrar({ ...t, interconexionFisica: ahora() }, 'Interconexión física confirmada', 'CFE')); },
  confirmarComercial(folio: string) { mutar(folio, (t) => bloqueo.comercial(t) ? t : registrar({ ...t, sistemaComercial: ahora() }, 'Incorporación al sistema comercial confirmada', 'CFE')); },
  cerrar(folio: string) {
    mutar(folio, (t) => bloqueo.cerrar(t) ? t : registrar({ ...t, cierre: ahora() }, 'Trámite cerrado', 'IDC',
      { titulo: 'Tu interconexión ha concluido', detalle: 'Tu sistema fotovoltaico ya está interconectado. Gracias por recorrer este camino con nosotros.', ruta: '/portal/expediente', accion: 'Ver mi expediente final' }));
  },
  /** Atajo de presentación: coloca la instalación en un estado coherente (siempre con los requisitos previos cumplidos). */
  atajoInstalacion(folio: string, a: 'A' | 'B' | 'C' | 'D') {
    guardar({ ...almacen, folios: { ...almacen.folios, [folio]: (() => {
      let t = hastaContratos();
      if (a === 'A') return t;
      t = programadaDic();
      if (a === 'B') return t;
      if (a === 'C') {
        const nueva = { fecha: '2026-12-15', franja: '13:00 – 17:00' };
        t = { ...t, instalacion: { ...t.instalacion, estado: 'reprogramada', anterior: t.instalacion.programada, programada: nueva, motivo: 'Ajuste de agenda de la cuadrilla de CFE (motivo ficticio).', actualizadoEn: ahora() } };
        const d = `CFE cambió la fecha. Nueva fecha: ${nueva.fecha} (${nueva.franja}).`;
        t.eventos = [ev(ahora(), 'Instalación reprogramada', 'CFE'), ...t.eventos];
        t.avisos = [aviso(ahora(), 'Tu instalación fue reprogramada', d, '/portal/instalacion', 'Ver mi instalación', false, ['Hola, cliente de demostración.', d, 'IDC da seguimiento y te avisará de cualquier cambio.']), ...t.avisos];
        return t;
      }
      const fecha = soloFecha(dia(-1));
      t = { ...t, instalacion: { ...t.instalacion, estado: 'instalada', medidor: { numero: ESCENARIO.medidor, fecha }, actualizadoEn: ahora() } };
      t.eventos = [ev(ahora(), 'Medidor bidireccional instalado', 'CFE'), ...t.eventos];
      t.avisos = [aviso(ahora(), 'Tu medidor fue instalado', `CFE instaló tu medidor bidireccional el ${fecha}.`, '/portal/instalacion', 'Ver mi instalación'), ...t.avisos];
      return t;
    })() } });
  },

  // Cliente
  revisarContrato(folio: string, clave: ClaveContrato) {
    mutar(folio, (t) => t.contratos[clave].estado !== 'disponible' ? t : registrar({ ...t, contratos: { ...t.contratos, [clave]: { ...t.contratos[clave], revisadoPorCliente: ahora() } } },
      `Revisaste el contrato de ${clave === 'interconexion' ? 'interconexión' : 'contraprestación'} y está preparado para tu firma`, 'Cliente'));
  },
  reportarContrato(folio: string, clave: ClaveContrato, texto: string) {
    mutar(folio, (t) => registrar({ ...t, contratos: { ...t.contratos, [clave]: { ...t.contratos[clave], reportes: [{ texto, fecha: ahora() }, ...t.contratos[clave].reportes] } } },
      `Reportaste datos por revisar en el contrato de ${clave === 'interconexion' ? 'interconexión' : 'contraprestación'}`, 'Cliente'));
  },
  disponibilidad(folio: string, estado: 'confirmada' | 'inconveniente', texto?: string) {
    mutar(folio, (t) => registrar({ ...t, instalacion: { ...t.instalacion, disponibilidad: { estado, texto, fecha: ahora() } } },
      estado === 'confirmada' ? 'Confirmaste tu disponibilidad para la instalación' : 'Reportaste un inconveniente para la instalación', 'Cliente'));
  },
  alternarChecklist(folio: string, id: string) {
    mutar(folio, (t) => ({ ...t, instalacion: { ...t.instalacion, checklist: t.instalacion.checklist.includes(id) ? t.instalacion.checklist.filter((x) => x !== id) : [...t.instalacion.checklist, id] } }));
  },
  leerAviso(folio: string, id: string) { mutar(folio, (t) => ({ ...t, avisos: t.avisos.map((a) => a.id === id ? { ...a, leido: true } : a) })); },
  encuesta(folio: string, estrellas: number, comentario: string) {
    mutar(folio, (t) => registrar({ ...t, encuesta: { estrellas, comentario, fecha: ahora() } }, 'Enviaste tu opinión del servicio', 'Cliente'));
  },
};

// ───────────────────────── Hitos y progreso (derivados del estado, sin porcentajes arbitrarios) ─────────────────────────
export interface Hito { id: string; etapa: 1 | 2 | 3 | 4; titulo: string; responsable: Responsable; fecha?: string; hecho: boolean; documentos?: string[]; ruta?: string }
export const ETAPAS_RECORRIDO = [
  { n: 1 as const, nombre: 'Datos y expediente', descripcion: 'Tus datos y documentos listos y entregados a IDC.' },
  { n: 2 as const, nombre: 'Entrega y resolución CFE', descripcion: 'IDC ingresa tu solicitud y CFE emite su resolución.' },
  { n: 3 as const, nombre: 'Contratos y programación', descripcion: 'Firma de contratos y fecha de instalación del medidor.' },
  { n: 4 as const, nombre: 'Instalación e interconexión', descripcion: 'Medidor bidireccional, interconexión e incorporación al sistema comercial.' },
];

export function hitosTramite(t: TramiteDemo, folio: string): Hito[] {
  const exp = leerExpedienteDemo(folio);
  const inst = t.instalacion;
  const prog = ['programada', 'reprogramada', 'instalada'].includes(inst.estado);
  return [
    { id: 'datos', etapa: 1, titulo: 'Datos del titular confirmados', responsable: 'Cliente', hecho: true, ruta: '/portal/mis-datos' },
    { id: 'docs', etapa: 1, titulo: 'Documentos con revisión digital favorable', responsable: 'IDC', hecho: expedienteDemoCompleto(exp), documentos: ['11 requisitos de interconexión'], ruta: '/portal/documentos' },
    { id: 'fisico', etapa: 1, titulo: 'Expediente físico recibido por IDC', responsable: 'IDC', hecho: !!t.recepcionFisica, fecha: t.recepcionFisica },
    { id: 'ingreso', etapa: 2, titulo: 'Expediente ingresado ante CFE', responsable: 'IDC', hecho: !!t.ingresoCfe, fecha: t.ingresoCfe },
    { id: 'numero', etapa: 2, titulo: 'Número de solicitud registrado', responsable: 'CFE', hecho: !!t.numeroSolicitud, fecha: t.registroEn },
    { id: 'resolucion', etapa: 2, titulo: 'Resolución favorable de CFE', responsable: 'CFE', hecho: !!t.resolucion, fecha: t.resolucion?.fecha, documentos: ['Oficio resolutivo favorable (demostración)'], ruta: '/portal/documentos' },
    { id: 'c-inter', etapa: 3, titulo: 'Contrato de interconexión formalizado', responsable: 'CFE', hecho: t.contratos.interconexion.estado === 'formalizado', fecha: t.contratos.interconexion.formalizadoEn, ruta: '/portal/contratos' },
    { id: 'c-contra', etapa: 3, titulo: 'Contrato de contraprestación formalizado', responsable: 'CFE', hecho: t.contratos.contraprestacion.estado === 'formalizado', fecha: t.contratos.contraprestacion.formalizadoEn, ruta: '/portal/contratos' },
    { id: 'prog', etapa: 3, titulo: 'Fecha de instalación comunicada por CFE', responsable: 'CFE', hecho: prog, fecha: prog ? inst.actualizadoEn : undefined, ruta: '/portal/instalacion' },
    { id: 'medidor', etapa: 4, titulo: 'Medidor bidireccional instalado', responsable: 'CFE', hecho: inst.estado === 'instalada', fecha: inst.medidor?.fecha, ruta: '/portal/instalacion' },
    { id: 'fisica', etapa: 4, titulo: 'Interconexión física confirmada', responsable: 'CFE', hecho: !!t.interconexionFisica, fecha: t.interconexionFisica },
    { id: 'comercial', etapa: 4, titulo: 'Incorporación al sistema comercial', responsable: 'CFE', hecho: !!t.sistemaComercial, fecha: t.sistemaComercial },
    { id: 'cierre', etapa: 4, titulo: 'Trámite cerrado', responsable: 'IDC', hecho: !!t.cierre, fecha: t.cierre },
  ];
}
export const progresoTramite = (h: Hito[]) => ({ hechos: h.filter((x) => x.hecho).length, total: h.length, pct: Math.round((h.filter((x) => x.hecho).length / h.length) * 100) });
export type FaseTramite = 'revision' | 'aprobada' | 'instalacion' | 'concluida';
export const faseTramite = (t: TramiteDemo): FaseTramite => t.cierre ? 'concluida' : contratosFormalizados(t) ? 'instalacion' : t.resolucion ? 'aprobada' : 'revision';

// ───────────────────────── Overlay sobre la vista del servidor ─────────────────────────
export function proximaAccionTramite(t: TramiteDemo): VistaPortal['siguientePaso'] {
  const inst = t.instalacion;
  if (t.cierre) return { titulo: 'Tu trámite concluyó', detalle: 'Conserva tu expediente final y tus documentos en tu portal.', responsable: 'cliente', fechaEstimada: null };
  if (t.sistemaComercial) return { titulo: 'IDC cerrará tu trámite', detalle: 'Ya está confirmada la incorporación al sistema comercial.', responsable: 'idc', fechaEstimada: null };
  if (t.interconexionFisica) return { titulo: 'Esperando la incorporación al sistema comercial', detalle: 'IDC da seguimiento con CFE.', responsable: 'cfe', fechaEstimada: null };
  if (inst.estado === 'instalada') return { titulo: 'Falta confirmar la interconexión física', detalle: 'IDC da seguimiento con CFE. No necesitas hacer nada.', responsable: 'cfe', fechaEstimada: null };
  if (inst.estado === 'programada' || inst.estado === 'reprogramada') return { titulo: 'Prepárate para la instalación del medidor', detalle: `CFE instalará tu medidor el ${inst.programada?.fecha} (${inst.programada?.franja}).`, responsable: 'cfe', fechaEstimada: inst.programada?.fecha ?? null };
  if (inst.estado === 'pendiente_cfe' || inst.estado === 'pendiente_nueva_fecha') return { titulo: 'Esperando la fecha de instalación', detalle: 'IDC mantiene el seguimiento con CFE. No necesitas hacer nada por ahora.', responsable: 'cfe', fechaEstimada: null };
  if (t.resolucion) return { titulo: 'Es momento de firmar', detalle: 'Consulta los contratos necesarios para continuar con tu interconexión.', responsable: 'cliente', fechaEstimada: null };
  return { titulo: 'CFE revisa tu solicitud', detalle: 'IDC te avisará de la resolución.', responsable: 'cfe', fechaEstimada: null };
}

export function aplicarTramiteDemo(vista: VistaPortal, t: TramiteDemo): VistaPortal {
  const h = hitosTramite(t, vista.folio);
  const p = progresoTramite(h);
  const etapas = ETAPAS_RECORRIDO.map((e) => {
    const hs = h.filter((x) => x.etapa === e.n);
    const hechos = hs.filter((x) => x.hecho).length;
    const completa = hechos === hs.length;
    const actual = !completa && ETAPAS_RECORRIDO.slice(0, e.n - 1).every((prev) => h.filter((x) => x.etapa === prev.n).every((x) => x.hecho));
    return { id: (['G0', 'G1', 'G2', 'G3'] as const)[e.n - 1]!, nombre: e.nombre, descripcion: e.descripcion, estado: completa ? 'Completada' : actual ? 'En curso' : 'Pendiente', tono: (completa ? 'ok' : actual ? 'info' : 'neutro') as 'ok' | 'info' | 'neutro', porcentaje: Math.round((hechos / hs.length) * 100), actual };
  });
  const act = etapas.find((e) => e.actual) ?? null;
  const delTramite: Notificacion[] = t.avisos.map((a) => ({
    id: a.id, tipo: a.accion.includes('contrato') || a.titulo.includes('firm') ? 'accion' : 'avance', titulo: a.titulo, detalle: a.detalle, fecha: a.fecha,
    correoDemo: a.correo, leido: a.leido, ruta: a.ruta, accion: a.accion,
  }));
  const previas = vista.notificaciones.filter((n) => !n.id.startsWith('a-'));
  const hist = [...t.eventos.map((e) => ({ id: e.id, fecha: e.fecha, titulo: `${e.titulo} · ${e.responsable}` })), ...vista.historial.filter((x) => !t.eventos.some((e) => e.id === x.id))];
  return {
    ...vista, etapas, etapaActual: act ? { id: act.id, nombre: act.nombre, descripcion: act.descripcion } : null,
    avance: { porcentaje: p.pct, exacto: true, reglas: ['Cada hito del recorrido completado cuenta por igual.', 'El avance se calcula con los hitos registrados, no con estimaciones.'] },
    siguientePaso: proximaAccionTramite(t),
    notificaciones: [...delTramite, ...previas].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    historial: hist.sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}
