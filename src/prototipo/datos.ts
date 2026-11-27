/**
 * PROTOTIPO VISUAL — datos 100 % ficticios.
 * Aislado de Supabase y Zoho: nada de este módulo llega a un servidor.
 */
export type EstadoDoc = 'pendiente' | 'en_revision' | 'observado' | 'aceptado';
export type EstadoCita = 'solicitada' | 'confirmada' | 'reprogramada';
export type Etapa = 'G0' | 'G1' | 'G2' | 'G3';

export interface VersionDoc { n: number; archivo: string; fecha: string; autor: 'cliente' | 'idc' }
export interface Documento {
  id: string; nombre: string; corto: string; etapa: Etapa; descripcion: string; estado: EstadoDoc;
  versiones: VersionDoc[]; observacion?: string; fisico?: boolean;
}
export interface Cita { id: string; fecha: string; hora: string; estado: EstadoCita; motivo: string; nota?: string }
export interface Evento { id: string; fecha: string; titulo: string; detalle: string; tono: 'ok' | 'alerta' | 'info'; quien: 'cliente' | 'idc' | 'sistema' }
export interface Aviso { id: string; fecha: string; titulo: string; cuerpo: string; leido: boolean; accion?: string; ruta?: string }
export interface Correo { id: string; fecha: string; de: string; para: string; asunto: string; vista: string; cuerpo: string[]; cta?: string; leido: boolean }

export interface Estado {
  v: number;
  documentos: Documento[];
  cita: Cita | null;
  eventos: Evento[];
  avisos: Aviso[];
  correos: Correo[];
}

export const CLIENTE = {
  folio: 'KV-2026-018',
  titular: 'Agroenergía del Yaqui, S.A. de C.V.',
  contacto: 'Mariana Ochoa Beltrán',
  correo: 'mariana.ochoa@agroyaqui.example',
  sitio: 'Rancho El Mezquite, Cd. Obregón, Sonora',
  sistema: '38.4 kWp · 64 paneles de 600 W · media tensión',
  ingeniero: 'Ing. Ricardo Valenzuela',
  coordinadora: 'Ing. Paola Quintero',
};

export const ETAPAS: { id: Etapa; nombre: string; frase: string }[] = [
  { id: 'G0', nombre: 'Identidad', frase: 'Quién eres y quién firma' },
  { id: 'G1', nombre: 'Proyecto', frase: 'Qué vamos a instalar' },
  { id: 'G2', nombre: 'Evidencia', frase: 'Cómo quedó el sistema' },
  { id: 'G3', nombre: 'Entrega', frase: 'Llevar el expediente a ventanilla' },
];

const h = (d: number, hh = 10, mm = 0) => {
  const f = new Date(); f.setDate(f.getDate() + d); f.setHours(hh, mm, 0, 0); return f.toISOString();
};

const base: [string, string, string, Etapa, string, EstadoDoc, string?][] = [
  ['recibo_cfe', 'Recibo CFE del último corte', 'Recibo CFE', 'G0', 'Sin adeudos, con número de servicio legible.', 'aceptado'],
  ['identificacion', 'Identificación oficial vigente', 'Identificación', 'G0', 'INE o pasaporte del representante legal.', 'aceptado'],
  ['csf', 'Constancia de Situación Fiscal', 'Constancia fiscal', 'G0', 'Emitida por el SAT, de los últimos 3 meses.', 'aceptado'],
  ['carta_poder', 'Carta Poder con identificaciones', 'Carta Poder', 'G0', 'Firmada por titular, apoderado y dos testigos.', 'observado', 'Falta la firma del segundo testigo y la copia de su INE. Puedes subir la hoja corregida sin volver a enviar el resto.'],
  ['croquis', 'Croquis de ubicación', 'Croquis', 'G1', 'Calles, referencias cercanas y orientación al Norte.', 'en_revision'],
  ['unifilar', 'Diagrama unifilar', 'Diagrama unifilar', 'G1', 'Esquema eléctrico firmado por el ingeniero responsable.', 'aceptado'],
  ['fichas', 'Fichas técnicas de paneles e inversor', 'Fichas técnicas', 'G1', 'Del fabricante, con modelo y potencia.', 'pendiente'],
  ['ul', 'Certificados UL de paneles e inversor', 'Certificados UL', 'G1', 'Certificación de seguridad del equipo.', 'pendiente'],
  ['solicitud', 'Formato de solicitud de interconexión', 'Solicitud', 'G1', 'IDC lo prellena; tú solo revisas y firmas.', 'en_revision'],
  ['fotos', 'Fotografías del sistema funcionando', 'Fotos del sistema', 'G2', 'Paneles, inversor y medidor, con buena luz.', 'pendiente'],
  ['uvie', 'Dictamen de verificación UVIE', 'Dictamen UVIE', 'G3', 'Lo emite la unidad verificadora; IDC lo coordina.', 'pendiente'],
];

export function estadoInicial(): Estado {
  return {
    v: 1,
    documentos: base.map(([id, nombre, corto, etapa, descripcion, estado, observacion], i) => ({
      id, nombre, corto, etapa, descripcion, estado, observacion,
      fisico: ['carta_poder', 'solicitud', 'unifilar'].includes(id),
      versiones: estado === 'pendiente' ? [] : [{ n: 1, archivo: id + '_v1.pdf', fecha: h(-9 + i), autor: 'cliente' as const }],
    })),
    cita: null,
    eventos: [
      { id: 'e0', fecha: h(-12), titulo: 'Expediente abierto', detalle: 'IDC creó tu expediente KV-2026-018.', tono: 'info', quien: 'idc' },
      { id: 'e1', fecha: h(-8), titulo: 'Documentos de identidad aceptados', detalle: 'Recibo CFE, identificación y constancia fiscal quedaron al corriente.', tono: 'ok', quien: 'idc' },
      { id: 'e2', fecha: h(-3), titulo: 'Diagrama unifilar aceptado', detalle: 'El Ing. Valenzuela lo revisó sin comentarios.', tono: 'ok', quien: 'idc' },
      { id: 'e3', fecha: h(-1), titulo: 'Carta Poder con observación', detalle: 'IDC pidió completar firmas de testigos.', tono: 'alerta', quien: 'idc' },
    ],
    avisos: [
      { id: 'a1', fecha: h(-1, 16), titulo: 'IDC dejó una observación en tu Carta Poder', cuerpo: 'Falta la firma del segundo testigo y la copia de su INE.', leido: false, accion: 'Corregir ahora', ruta: 'documentos' },
    ],
    correos: [],
  };
}
