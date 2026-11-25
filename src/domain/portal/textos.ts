import type { CompuertaId, EstadoCompuerta } from '../compuertas/compuerta';
import type { TipoHito } from '../entidades/hito';

/**
 * Lenguaje PARA EL CLIENTE. El portal nunca muestra textos libres de los datos internos (nombres de actividades, observaciones,
 * responsables): solo estas etiquetas fijas. Así lo que ve el cliente está bajo control y no depende de cómo capture IDC.
 */
export const ETAPA_CLIENTE: Readonly<Record<CompuertaId, { nombre: string; descripcion: string }>> = {
  G0: { nombre: 'Revisión inicial', descripcion: 'IDC revisa la viabilidad de tu proyecto con la red de CFE.' },
  G1: { nombre: 'Documentos y diseño', descripcion: 'Reunimos tus documentos y preparamos el diseño técnico.' },
  G2: { nombre: 'Validación del expediente', descripcion: 'IDC comprueba que todo el expediente sea correcto antes de enviarlo.' },
  G3: { nombre: 'Verificación y conexión', descripcion: 'Verificación de la instalación, contrato con CFE y conexión a la red.' },
};

/** «Bloqueada» es un estado interno: al cliente se le dice «En pausa», sin el motivo. */
export const ESTADO_CLIENTE: Readonly<Record<EstadoCompuerta, { texto: string; tono: 'ok' | 'alerta' | 'neutro' | 'info' }>> = {
  pendiente: { texto: 'Por iniciar', tono: 'neutro' },
  en_revision: { texto: 'En curso', tono: 'info' },
  liberada: { texto: 'Completada', tono: 'ok' },
  bloqueada: { texto: 'En pausa', tono: 'alerta' },
};

/** Únicos hitos que aparecen en el historial público, con su etiqueta fija. Un hito sin tipo conocido no se muestra. */
export const HITO_PUBLICO: Readonly<Partial<Record<TipoHito, string>>> = {
  inicio_proyecto: 'Proyecto registrado',
  consulta_capacidad: 'Capacidad de la red confirmada',
  acopio_completo: 'Documentos completos',
  validacion_g2: 'Expediente validado',
  obra_terminada: 'Instalación terminada',
  ingreso_cfe: 'Solicitud ingresada a CFE',
  dictamen_uvie: 'Verificación UVIE concluida',
  contrato_firmado: 'Contrato firmado',
  interconexion: 'Conexión a la red completada',
};
