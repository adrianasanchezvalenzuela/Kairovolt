/**
 * Datos FICTICIOS del escenario de demostración (interconexión FV de 40 kW en media tensión).
 * Son fijos: la solicitud generada es idéntica cada vez. Nada aquí proviene del ejemplo anonimizado
 * ni está validado por IDC o CFE. No se escribe en Supabase ni en Zoho.
 */
export interface DomicilioSolicitud {
  calle: string; numExt: string; numInt: string; cp: string; colonia: string; municipio: string; estado: string;
  telefono: string; correo: string;
}
export interface DatosSolicitud {
  fecha: string;
  solicitante: DomicilioSolicitud & { nombre: string };
  contacto: DomicilioSolicitud & { nombre: string; puesto: string };
  modalidad: 'media' | 'baja';
  utilizacion: 'carga' | 'excedentes' | 'venta';
  rpu: string;
  nivelTension: string;
  central: { fechaOperacion: string; capacidadBruta: string; incremento: string; generacionMensual: string };
  unidades: string;
  utmX: string;
  utmY: string;
}

export const SOLICITUD_FIJA = {
  titularDemo: 'Alejandro Mendoza Ruiz',
  contactoDemo: 'Mariana Torres López',
  puestoDemo: 'Apoderada',
  domicilio: {
    calle: 'Calle Ejemplo', numExt: '100', numInt: '', cp: '83000', colonia: 'Colonia Ejemplo',
    municipio: 'Hermosillo', estado: 'Sonora', telefono: '662 000 0000', correo: 'contacto@ejemplo.invalid',
  } satisfies DomicilioSolicitud,
  rpu: '999 000 000 042',
  nivelTension: 'Media tensión (dato ficticio)',
  capacidadBrutaKw: '40',
  generacionMensualKwh: '6600',
  fechaOperacion: '15/01/2027',
  unidades: '64 paneles de 625 W',
  utmX: '500000',
  utmY: '3216000',
} as const;

export interface DatosPersonasMisDatos { titular?: string; contacto?: string; puesto?: string }

/** Combina lo capturado en «Mis datos» (si existe) con los datos técnicos ficticios fijos. */
export function solicitudInicial(misDatos: DatosPersonasMisDatos = {}, hoy = new Date()): DatosSolicitud {
  const d = SOLICITUD_FIJA.domicilio;
  const titular = misDatos.titular?.trim() || SOLICITUD_FIJA.titularDemo;
  const contacto = misDatos.contacto?.trim() || misDatos.titular?.trim() || SOLICITUD_FIJA.contactoDemo;
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Hermosillo' }).format(hoy),
    solicitante: { nombre: titular, ...d },
    contacto: { nombre: contacto, puesto: misDatos.puesto || SOLICITUD_FIJA.puestoDemo, ...d },
    modalidad: 'media',
    utilizacion: 'carga',
    rpu: SOLICITUD_FIJA.rpu,
    nivelTension: SOLICITUD_FIJA.nivelTension,
    central: { fechaOperacion: SOLICITUD_FIJA.fechaOperacion, capacidadBruta: SOLICITUD_FIJA.capacidadBrutaKw, incremento: '', generacionMensual: SOLICITUD_FIJA.generacionMensualKwh },
    unidades: SOLICITUD_FIJA.unidades,
    utmX: SOLICITUD_FIJA.utmX,
    utmY: SOLICITUD_FIJA.utmY,
  };
}
