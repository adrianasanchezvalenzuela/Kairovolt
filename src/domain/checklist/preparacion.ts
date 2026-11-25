export type RevisionDigital = 'opcional' | 'obligatoria' | 'no_disponible';

export interface GuiaPreparacion {
  motivo?: string;
  oficial?: string;
  pasos?: string[];
  comprobaciones?: string[];
  entrega?: string;
  originalOCopia?: string;
  firmas?: string;
  legibilidad?: string;
  revisadaEn?: string;
}

export interface ProgresoPreparacion {
  documento: string;
  marcadas: number[];
  preparado: boolean;
}

export const guiasDemo: Record<string, GuiaPreparacion> = {
  recibo_cfe: {
    motivo: 'Permite identificar el servicio eléctrico asociado a la instalación.',
    oficial: 'https://www.cfe.mx/',
    pasos: ['Puedes usar un recibo que ya tengas. Si necesitas consultarlo, entra al portal oficial de CFE.'],
    comprobaciones: ['Revisé el titular', 'Localicé el número de servicio', 'Revisé el domicilio', 'El recibo se lee completo'],
  },
  constancia_situacion_fiscal: {
    motivo: 'Permite revisar los datos fiscales del titular.',
    oficial: 'https://sat.gob.mx/portal/public/tramites/constancia-de-situacion-fiscal',
    pasos: ['Consulta las opciones para obtener la constancia en el portal del SAT. Realiza el trámite en el sitio oficial.'],
    comprobaciones: ['Revisé el nombre o razón social', 'Localicé el RFC', 'La constancia se lee completa'],
  },
  identificacion_oficial: {
    motivo: 'Ayuda a cotejar quién figura como titular del trámite.',
    pasos: ['Conserva tu identificación. Si decides enviar una copia, comprueba que se vea completa y sin reflejos.'],
    comprobaciones: ['El nombre se puede leer', 'La imagen está enfocada y sin recortes'],
  },
  carta_poder: {
    motivo: 'Orienta la preparación de los datos de quien participa en la representación.',
    pasos: ['Confirma los datos en Mis datos. La muestra de KairóVolt sirve para revisar el diseño y los espacios de firma.'],
    comprobaciones: ['Revisé el titular', 'Revisé quién tramita', 'Consulté con IDC qué firmas corresponden'],
    entrega: 'Confirma con IDC la plantilla y las firmas requeridas antes de programar una entrega.',
  },
};

export function leerGuiaPreparacion(valor: unknown): GuiaPreparacion {
  if (!valor || typeof valor !== 'object') return {};
  const g = valor as Record<string, unknown>;
  const texto = (k: string) => typeof g[k] === 'string' ? g[k] as string : undefined;
  const lista = (k: string) => Array.isArray(g[k]) ? g[k].filter((v): v is string => typeof v === 'string').slice(0, 30) : undefined;
  const url = texto('oficial');
  return {
    motivo: texto('motivo'), oficial: url && /^https:\/\//i.test(url) ? url : undefined,
    pasos: lista('pasos'), comprobaciones: lista('comprobaciones'), entrega: texto('entrega'),
    originalOCopia: texto('originalOCopia'), firmas: texto('firmas'), legibilidad: texto('legibilidad'), revisadaEn: texto('revisadaEn'),
  };
}
