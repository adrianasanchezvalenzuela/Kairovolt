import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface PlantillaDemo {
  titulo: string;
  aviso: string;
  campos: [string, string][];
  pie: string;
}

const PLANTILLAS: Record<string, PlantillaDemo> = {
  recibo_cfe: {
    titulo: 'Ejemplo de recibo eléctrico',
    aviso: 'MUESTRA FICTICIA · NO EMITIDA POR CFE',
    campos: [
      ['Titular', 'Persona titular de demostración'],
      ['Identificador', 'SERVICIO-DEMO'],
      ['Periodo', 'Último corte · sin adeudos (ficticio)'],
      ['Domicilio', 'Ubicación ficticia · Hermosillo, Sonora'],
    ],
    pie: 'Material de práctica. No acredita suministro ni pago.',
  },
  identificacion_oficial: {
    titulo: 'Ficha de identificación ficticia',
    aviso: 'MUESTRA · SIN VALIDEZ COMO IDENTIFICACIÓN',
    campos: [
      ['Titular', 'Persona ficticia de demostración'],
      ['Referencia', 'IDENTIFICACION-DEMO'],
      ['Vigencia', 'Vigente (dato ficticio)'],
    ],
    pie: 'Material de práctica. Sin validez oficial.',
  },
  constancia_situacion_fiscal: {
    titulo: 'Constancia fiscal ilustrativa',
    aviso: 'MUESTRA FICTICIA · NO EMITIDA POR EL SAT',
    campos: [
      ['Nombre / Razón social', 'Titular ficticio de demostración'],
      ['RFC ilustrativo', 'DEMO000000XXX'],
      ['Régimen', 'Dato ilustrativo de prueba'],
    ],
    pie: 'Material de práctica. No sustituye una constancia oficial del SAT.',
  },
  croquis: {
    titulo: 'Croquis ilustrativo de ubicación',
    aviso: 'EJEMPLO ILUSTRATIVO · NO ES FORMATO OFICIAL',
    campos: [
      ['Calles de referencia', 'Blvd. Ejemplo Norte y Calle Solar'],
      ['Orientación', 'Norte indicado en plano ficticio'],
      ['Ubicación', 'Hermosillo, Sonora (ficticio)'],
    ],
    pie: 'Material de práctica para revisión de ubicación.',
  },
  diagrama_unifilar: {
    titulo: 'Diagrama unifilar ilustrativo',
    aviso: 'MUESTRA TÉCNICA FICTICIA · ELABORADO POR ESPECIALISTA DEMO',
    campos: [
      ['Sistema', 'Media tensión · arreglo fotovoltaico ilustrativo'],
      ['Elaborado por', 'Especialista eléctrico ficticio'],
      ['Estado', 'Revisión digital ilustrativa'],
    ],
    pie: 'Material de práctica. Un diagrama real debe ser elaborado por especialista autorizado.',
  },
  ficha_tecnica: {
    titulo: 'Fichas técnicas de paneles e inversor',
    aviso: 'MUESTRA FICTICIA DE FABRICANTE',
    campos: [
      ['Módulos FV', 'Panel solar ilustrativo · hoja de especificaciones'],
      ['Inversor', 'Inversor trifásico ilustrativo · hoja técnica'],
      ['Emisor', 'Fabricante (documento de demostración)'],
    ],
    pie: 'Material de práctica. Sin especificaciones vinculantes.',
  },
  certificado: {
    titulo: 'Certificados UL ilustrativos',
    aviso: 'MUESTRA FICTICIA DE CERTIFICACIÓN DE EQUIPOS',
    campos: [
      ['Paneles', 'Certificado UL ilustrativo de módulo FV'],
      ['Inversor', 'Certificado UL ilustrativo de inversor'],
      ['Emisor', 'Organismo certificador / fabricante (demo)'],
    ],
    pie: 'Material de práctica. No constituye certificación oficial.',
  },
  solicitud: {
    titulo: 'Formato de solicitud ilustrativo',
    aviso: 'MUESTRA FICTICIA · NO ES FORMATO OFICIAL DE CFE',
    campos: [
      ['Tipo de trámite', 'Interconexión de generación distribuida (demo)'],
      ['Solicitante', 'Titular ficticio de demostración'],
      ['Firmas', 'Espacio de firma autógrafa para entrega física'],
    ],
    pie: 'Material de práctica. Confirma el formato vigente con IDC.',
  },
  evidencia_fotografica: {
    titulo: 'Registro fotográfico del sistema',
    aviso: 'MUESTRA ILUSTRATIVA DE EVIDENCIA FOTOGRÁFICA',
    campos: [
      ['Vistas incluidas', 'Vista general · Paneles solares · Inversores'],
      ['Condición', 'Sistema instalado y operando (demo)'],
    ],
    pie: 'Material de práctica. En tu expediente puedes subir varias fotografías.',
  },
  dictamen_uvie: {
    titulo: 'Dictamen de verificación UVIE ilustrativo',
    aviso: 'MUESTRA FICTICIA · SOLO UNA UVIE ACREDITADA EMITE DICTAMEN',
    campos: [
      ['Unidad emisora', 'UVIE acreditada ficticia (demostración)'],
      ['Resultado', 'Revisión digital ilustrativa'],
      ['Entrega física', 'Confirmar ejemplar físico con IDC'],
    ],
    pie: 'Material de práctica. El cliente no puede emitir un dictamen UVIE.',
  },
};

export async function generarDocumentoIlustrativo(tipoDocumento: string): Promise<Uint8Array> {
  const plantilla = PLANTILLAS[tipoDocumento] ?? PLANTILLAS.recibo_cfe!;
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([500, 600]);
  const texto = await pdf.embedFont(StandardFonts.Helvetica);
  const grande = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.06, 0.17, 0.25);
  pagina.drawRectangle({ x: 0, y: 480, width: 500, height: 120, color: tinta });
  pagina.drawText('KairóVolt · material ilustrativo de demostración', { x: 36, y: 552, size: 12, font: texto, color: rgb(0.95, 0.74, 0.33) });
  pagina.drawText(plantilla.titulo, { x: 36, y: 512, size: 21, font: grande, color: rgb(1, 1, 1) });
  pagina.drawText(plantilla.aviso, { x: 36, y: 448, size: 11, font: grande, color: tinta });
  plantilla.campos.forEach(([etiqueta, valor], i) => {
    const y = 392 - i * 64;
    pagina.drawText(etiqueta, { x: 36, y, size: 11, font: grande, color: tinta });
    pagina.drawText(valor, { x: 36, y: y - 22, size: 14, font: texto, color: tinta });
  });
  pagina.drawText(plantilla.pie, { x: 36, y: 54, size: 10, font: texto, color: tinta });
  return pdf.save();
}

export async function generarReciboIlustrativo(identificacion = false): Promise<Uint8Array> {
  return generarDocumentoIlustrativo(identificacion ? 'identificacion_oficial' : 'recibo_cfe');
}
