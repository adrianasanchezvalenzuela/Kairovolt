export type RevisionDigital = 'opcional' | 'obligatoria' | 'no_disponible';

export type CategoriaPortal =
  | 'identificacion_datos'
  | 'servicio_electrico'
  | 'ubicacion_instalacion'
  | 'documentacion_tecnica'
  | 'solicitudes_verificaciones';

export const ETIQUETA_CATEGORIA_PORTAL: Readonly<Record<CategoriaPortal, string>> = {
  identificacion_datos: 'Identificación y datos',
  servicio_electrico: 'Servicio eléctrico',
  ubicacion_instalacion: 'Ubicación e instalación',
  documentacion_tecnica: 'Documentación técnica',
  solicitudes_verificaciones: 'Solicitudes y verificaciones',
};

export const ORDEN_CATEGORIAS_PORTAL: readonly CategoriaPortal[] = [
  'identificacion_datos',
  'servicio_electrico',
  'ubicacion_instalacion',
  'documentacion_tecnica',
  'solicitudes_verificaciones',
];

export type EmisorDocumento =
  | 'cliente'
  | 'cfe'
  | 'sat'
  | 'especialista'
  | 'fabricante'
  | 'instalador'
  | 'idc'
  | 'uvie'
  | 'tercero'
  | 'pendiente';

export const ETIQUETA_EMISOR: Readonly<Record<EmisorDocumento, string>> = {
  cliente: 'Titular o representante',
  cfe: 'CFE',
  sat: 'SAT',
  especialista: 'Especialista eléctrico o proyectista',
  fabricante: 'Fabricante o instalador',
  instalador: 'Instalador o responsable técnico',
  idc: 'IDC Sistemas Eléctricos',
  uvie: 'Unidad de Verificación (UVIE) acreditada',
  tercero: 'Responsable externo autorizado',
  pendiente: 'Por confirmar con IDC',
};

export type RequiereEntregaFisica = 'si' | 'no' | 'por_confirmar';

export interface GuiaPreparacion {
  queEs?: string;
  motivo?: string;
  quienElabora?: string;
  dondeConseguir?: string;
  oficial?: string;
  pasos?: string[];
  comprobaciones?: string[];
  comoSubir?: string;
  entrega?: string;
  requiereEntregaFisica?: RequiereEntregaFisica;
  requiereFirmas?: boolean;
  originalOCopia?: string;
  firmas?: string;
  legibilidad?: string;
  revisadaEn?: string;
  ilustracion?: 'croquis' | 'fotos';
  permiteMultiples?: boolean;
  capturaCamara?: boolean;
}

export interface ProgresoPreparacion {
  documento: string;
  marcadas: number[];
  preparado: boolean;
}

/**
 * Guías orientativas para el escenario de demostración de media tensión (11 documentos + condicional).
 * Ninguna guía declara requisitos oficiales de CFE ni sustituye las indicaciones validadas por IDC.
 */
export const guiasDemo: Record<string, GuiaPreparacion> = {
  recibo_cfe: {
    queEs: 'Comprobante del último corte de facturación del servicio eléctrico donde se instalará el sistema.',
    motivo: 'Permite identificar al titular del servicio, el número de servicio y verificar que no existan adeudos en el último corte.',
    quienElabora: 'Emitido por CFE. Puedes descargarlo o usar tu recibo más reciente.',
    dondeConseguir: 'En el portal oficial de CFE, la app CFE Contigo o tu recibo impreso más reciente.',
    oficial: 'https://www.cfe.mx/',
    pasos: [
      'Ubica tu recibo CFE del último corte de facturación.',
      'Verifica que aparezca sin adeudos y que los datos del servicio sean legibles.',
      'Si lo tienes en papel, tómale una foto clara o escanéalo completo en PDF o imagen.',
    ],
    comprobaciones: [
      'Revisé el nombre del titular del servicio',
      'Localicé el número de servicio o RPU',
      'Verifiqué el domicilio de la instalación',
      'El recibo se lee completo y sin recortes',
    ],
    comoSubir: 'Sube el PDF original de CFE o una fotografía nítida en JPG, PNG o WEBP (máximo 10 MB).',
    entrega: 'Llévalo impreso en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  identificacion_oficial: {
    queEs: 'Identificación oficial vigente del propietario del servicio o del representante legal/apoderado.',
    motivo: 'Permite cotejar la identidad de quien figura como titular o representante en el expediente.',
    quienElabora: 'Emitida por la autoridad correspondiente; la aporta el titular o su representante.',
    dondeConseguir: 'Usa la identificación oficial vigente que ya tengas disponible.',
    pasos: [
      'Asegúrate de contar con ambos lados legibles cuando aplique a tu identificación.',
      'Evita reflejos, sombras o esquinas cortadas al capturar la imagen.',
    ],
    comprobaciones: [
      'El nombre completo se puede leer con claridad',
      'La imagen está enfocada, completa y sin reflejos',
      'Confirmé que esté vigente',
    ],
    comoSubir: 'Puedes subir un PDF con ambos lados o una imagen clara en JPG, PNG o WEBP.',
    entrega: 'Llévala en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  constancia_situacion_fiscal: {
    queEs: 'Documento fiscal emitido por el SAT con el nombre o razón social, RFC y domicilio fiscal del titular.',
    motivo: 'Permite verificar la consistencia de los datos fiscales del titular del proyecto.',
    quienElabora: 'Emitida por el SAT. El titular o su contador pueden descargarla y subirla al portal.',
    dondeConseguir: 'En el portal oficial del SAT (Trámites y servicios) o mediante SAT ID.',
    oficial: 'https://sat.gob.mx/portal/public/tramites/constancia-de-situacion-fiscal',
    pasos: [
      'Descarga tu Constancia de Situación Fiscal desde los canales oficiales del SAT.',
      'Verifica que el archivo PDF abra correctamente y muestre tu nombre o razón social y RFC.',
    ],
    comprobaciones: [
      'Revisé el nombre o razón social',
      'Localicé el RFC completo',
      'La constancia se lee completa en todas sus páginas',
    ],
    comoSubir: 'Preferentemente sube el archivo PDF descargado del SAT (máximo 10 MB).',
    entrega: 'Llévala impresa en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  carta_poder: {
    queEs: 'Documento donde el titular designa a un apoderado o representante para gestionar la documentación del trámite, acompañado de las identificaciones correspondientes.',
    motivo: 'Acredita la representación cuando otra persona realiza gestiones del expediente en nombre del titular.',
    quienElabora: 'La prepara el titular con apoyo de IDC y la firman otorgante, apoderado/representante y testigos cuando corresponda.',
    dondeConseguir: 'Puedes revisar los datos en Mis datos y generar la muestra orientativa en KairóVolt; confirma con IDC la plantilla autorizada.',
    pasos: [
      'Confirma los datos del titular, apoderado o representante y testigos en la sección Mis datos.',
      'Revisa la plantilla autorizada por IDC y recaba todas las firmas autógrafas requeridas.',
      'Adjunta o ten listas las identificaciones correspondientes de los firmantes según indicaciones de IDC.',
    ],
    comprobaciones: [
      'Revisé el nombre completo del titular y de quien tramita',
      'Verifiqué los nombres de los testigos cuando corresponden',
      'Confirmé con IDC la plantilla y las firmas autógrafas requeridas',
    ],
    comoSubir: 'Sube una copia escaneada o foto clara en PDF o imagen para que IDC revise que no falten firmas antes de tu visita.',
    entrega: 'Llévala firmada, con las identificaciones que correspondan.',
    requiereEntregaFisica: 'si',
    requiereFirmas: true,
    firmas: 'Requiere firma autógrafa del otorgante, apoderado/representante y testigos según la plantilla autorizada por IDC.',
  },
  acta_constitutiva: {
    queEs: 'Escritura constitutiva o documento que acredite propiedad o posesión cuando el caso lo requiere.',
    motivo: 'Permite acreditar la personalidad jurídica de personas morales o la relación con el inmueble cuando IDC confirme que aplica.',
    quienElabora: 'Emitida ante fedatario público o autoridad competente; la aporta el titular o representante legal.',
    dondeConseguir: 'Copia del expediente legal de la empresa o del inmueble.',
    pasos: [
      'Confirma con IDC si este requisito aplica para tu tipo de titular.',
      'En caso afirmativo, reúne las páginas donde constan razón social, objeto y facultades del representante.',
    ],
    comprobaciones: [
      'Confirmé con IDC si aplica a mi proyecto',
      'Las páginas clave se leen completas',
    ],
    comoSubir: 'Sube el documento en formato PDF (máximo 10 MB).',
    entrega: 'Llévala en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  croquis: {
    queEs: 'Representación clara de la ubicación exacta de la instalación, calles cercanas, referencias visibles y orientación.',
    motivo: 'Facilita ubicar el punto de instalación y servicio eléctrico durante la revisión documental y la inspección.',
    quienElabora: 'Puede elaborarlo el cliente, el instalador o el equipo técnico de IDC. Si ya lo tienes, puedes subirlo directamente.',
    dondeConseguir: 'Puedes dibujarlo de forma limpia, exportarlo desde un plano o solicitar apoyo a tu instalador o a IDC.',
    pasos: [
      'Indica claramente las calles principales y secundarias que rodean el inmueble.',
      'Marca la ubicación de la instalación y agrega referencias cercanas fáciles de ubicar (esquinas, comercios o avenidas).',
      'Incluye la orientación (flecha hacia el Norte) y revisa que todos los nombres de calles sean legibles.',
    ],
    comprobaciones: [
      'Se distinguen los nombres de las calles principales y entre calles',
      'Está marcada la ubicación exacta de la instalación',
      'Incluye referencias cercanas y orientación hacia el Norte',
      'La imagen o PDF es legible sin zonas borrosas',
    ],
    comoSubir: 'Puedes subir una fotografía clara, imagen (JPG, PNG, WEBP) o PDF del croquis. En móvil también puedes tomar la foto directamente.',
    entrega: 'Llévalo impreso en tu carpeta física.',
    requiereEntregaFisica: 'si',
    ilustracion: 'croquis',
    capturaCamara: true,
  },
  diagrama_unifilar: {
    queEs: 'Plano técnico eléctrico que muestra la conexión de paneles, inversores, protecciones, tablero y punto de interconexión.',
    motivo: 'Permite verificar la configuración eléctrica del sistema y su consistencia con los equipos declarados.',
    quienElabora: 'Debe ser elaborado por un especialista eléctrico, proyectista o el área técnica de IDC. Si ya cuentas con el archivo emitido por tu especialista, puedes subirlo aquí.',
    dondeConseguir: 'Solicítalo a tu proyectista, instalador eléctrico o al equipo de ingeniería de IDC.',
    pasos: [
      'Obtén la versión más reciente del diagrama unifilar emitida por el especialista o IDC.',
      'Verifica que el archivo corresponda a tu instalación y que los textos técnicos sean legibles al hacer zoom.',
    ],
    comprobaciones: [
      'El diagrama fue elaborado por un especialista o por el equipo técnico',
      'Corresponde al proyecto de este folio',
      'Los textos y símbolos son legibles en el PDF o imagen',
    ],
    comoSubir: 'Sube el archivo en PDF (recomendado para conservar nitidez) o imagen de alta resolución.',
    entrega: 'Llévalo impreso en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  ficha_tecnica: {
    queEs: 'Hojas de especificaciones del fabricante para los módulos fotovoltaicos (paneles) y el inversor instalados.',
    motivo: 'Acredita las características técnicas de potencia, voltaje y modelo de los equipos del sistema.',
    quienElabora: 'Emitidas por el fabricante de los paneles e inversores; las puede compartir tu instalador, proveedor o IDC. Si ya las tienes, puedes cargarlas.',
    dondeConseguir: 'Solicítalas a tu instalador/distribuidor o descárgalas del sitio oficial del fabricante indicando el modelo exacto.',
    pasos: [
      'Reúne la ficha técnica de los paneles solares y la ficha técnica del inversor.',
      'Confirma que los modelos indicados coincidan con los equipos instalados.',
    ],
    comprobaciones: [
      'Tengo la ficha técnica de los paneles solares',
      'Tengo la ficha técnica del inversor',
      'Los modelos coinciden con mi instalación y se leen completos',
    ],
    comoSubir: 'Puedes subir un PDF combinado con ambas fichas o cargar el archivo técnico disponible (máximo 10 MB).',
    entrega: 'Llévalas impresas en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  certificado: {
    queEs: 'Certificados de cumplimiento (como UL) correspondientes a los paneles solares y al inversor instalados.',
    motivo: 'Respalda que los equipos cumplen con los estándares de seguridad y operación aplicables al proyecto.',
    quienElabora: 'Emitidos por organismos certificadores y proporcionados por el fabricante o instalador. Si ya cuentas con ellos, puedes subirlos al portal.',
    dondeConseguir: 'Pídelos a tu instalador, proveedor de equipos o al equipo técnico de IDC.',
    pasos: [
      'Verifica que los certificados correspondan exactamente a la marca y modelo de tus paneles e inversor.',
      'Revisa que las páginas del certificado estén completas y legibles.',
    ],
    comprobaciones: [
      'Cuento con el certificado de los paneles y del inversor',
      'El modelo en el certificado coincide con los equipos instalados',
      'El documento está completo y legible',
    ],
    comoSubir: 'Sube los certificados en PDF (máximo 10 MB).',
    entrega: 'Llévalos impresos en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
  solicitud: {
    queEs: 'Formato de solicitud de interconexión para el expediente ante CFE.',
    motivo: 'Formaliza los datos del solicitante y las características del sistema para el ingreso del trámite.',
    quienElabora: 'Se integra con datos técnicos y del titular (habitualmente preparado con apoyo de IDC) y requiere la firma del titular o representante.',
    dondeConseguir: 'IDC te proporcionará el formato llenado para revisión y firma, o puedes cargar la versión que ya tengas firmada.',
    pasos: [
      'Revisa que el nombre del titular, domicilio y datos generales coincidan con tu recibo CFE.',
      'Verifica con IDC los espacios de firma antes de acudir a tu visita.',
    ],
    comprobaciones: [
      'Revisé los datos generales del titular en el formato',
      'Confirmé con IDC la versión vigente y los espacios de firma',
    ],
    comoSubir: 'Sube el PDF o imagen clara del formato para revisión previa antes de la entrega física.',
    entrega: 'Llévalo impreso y firmado.',
    requiereEntregaFisica: 'si',
    requiereFirmas: true,
    firmas: 'Requiere firma autógrafa del titular o representante autorizado según indicaciones de IDC.',
  },
  evidencia_fotografica: {
    queEs: 'Serie de fotografías claras del sistema fotovoltaico instalado y funcionando.',
    motivo: 'Muestra la instalación física real de paneles, inversores y elementos visibles del sistema antes de la integración final.',
    quienElabora: 'Puede tomarlas el cliente, el instalador o el supervisor de campo. Puedes subir varias fotografías directamente desde tu teléfono o computadora.',
    dondeConseguir: 'Tómalas directamente en el sitio de instalación con buena luz natural.',
    pasos: [
      'Toma una vista general de la instalación donde se aprecie el entorno.',
      'Toma fotografías claras de los paneles solares montados.',
      'Fotografía el o los inversores (preferentemente en operación y con etiqueta legible).',
      'Agrega fotos del tablero eléctrico o medidor cuando IDC te lo indique.',
    ],
    comprobaciones: [
      'Incluí una vista general de la instalación',
      'Incluí fotografías claras de los paneles solares',
      'Incluí fotografías de los inversores',
      'Las fotos están bien iluminadas, enfocadas y sin contraluz excesivo',
    ],
    comoSubir: 'Puedes seleccionar varias fotografías a la vez (JPG, PNG, WEBP o PDF) o usar la cámara de tu celular.',
    entrega: 'Llévalas impresas en tu carpeta física.',
    requiereEntregaFisica: 'si',
    ilustracion: 'fotos',
    permiteMultiples: true,
    capturaCamara: true,
  },
  dictamen_uvie: {
    queEs: 'Dictamen técnico emitido por una Unidad de Verificación de Instalaciones Eléctricas (UVIE) acreditada.',
    motivo: 'Verifica el cumplimiento técnico de la instalación eléctrica cuando el proyecto requiere verificación UVIE.',
    quienElabora: 'Únicamente puede emitirlo una Unidad de Verificación (UVIE) acreditada y autorizada. El cliente no puede emitirlo por su cuenta, pero sí puede subirlo al portal si ya se lo entregaron.',
    dondeConseguir: 'Se gestiona a través de una UVIE acreditada, en coordinación con el equipo técnico de IDC.',
    pasos: [
      'Confirma con IDC la etapa y coordinación con la Unidad de Verificación (UVIE).',
      'Una vez que la UVIE emita el dictamen, puedes subir la copia digital aquí o entregarlo en tu visita.',
    ],
    comprobaciones: [
      'El dictamen fue emitido por una UVIE acreditada',
      'El documento incluye firma y datos de la unidad verificadora',
      'El archivo o ejemplar está completo y legible',
    ],
    comoSubir: 'Si ya recibiste tu dictamen emitido por la UVIE, súbelo en formato PDF para revisión previa.',
    entrega: 'Llévalo en tu carpeta física.',
    requiereEntregaFisica: 'si',
  },
};

export function leerGuiaPreparacion(valor: unknown): GuiaPreparacion {
  if (!valor || typeof valor !== 'object') return {};
  const g = valor as Record<string, unknown>;
  const texto = (k: string) => (typeof g[k] === 'string' ? (g[k] as string) : undefined);
  const lista = (k: string) =>
    Array.isArray(g[k]) ? g[k].filter((v): v is string => typeof v === 'string').slice(0, 30) : undefined;
  const bool = (k: string) => (typeof g[k] === 'boolean' ? (g[k] as boolean) : undefined);
  const url = texto('oficial');
  const reqFisica = texto('requiereEntregaFisica');
  const ilus = texto('ilustracion');
  return {
    queEs: texto('queEs'),
    motivo: texto('motivo'),
    quienElabora: texto('quienElabora'),
    dondeConseguir: texto('dondeConseguir'),
    oficial: url && /^https:\/\//i.test(url) ? url : undefined,
    pasos: lista('pasos'),
    comprobaciones: lista('comprobaciones'),
    comoSubir: texto('comoSubir'),
    entrega: texto('entrega'),
    requiereEntregaFisica: reqFisica === 'si' || reqFisica === 'no' || reqFisica === 'por_confirmar' ? reqFisica : undefined,
    requiereFirmas: bool('requiereFirmas'),
    originalOCopia: texto('originalOCopia'),
    firmas: texto('firmas'),
    legibilidad: texto('legibilidad'),
    revisadaEn: texto('revisadaEn'),
    ilustracion: ilus === 'croquis' || ilus === 'fotos' ? ilus : undefined,
    permiteMultiples: bool('permiteMultiples'),
    capturaCamara: bool('capturaCamara'),
  };
}
