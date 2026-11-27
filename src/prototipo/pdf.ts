import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CLIENTE, type Documento } from './datos';

const NAVY = rgb(0.063, 0.169, 0.251);
const TEAL = rgb(0.09, 0.42, 0.44);
const AMBAR = rgb(0.95, 0.74, 0.33);
const SUAVE = rgb(0.32, 0.4, 0.47);

/** Genera un PDF demostrativo (sin datos reales) para vista previa y descarga. */
export async function pdfDemo(d: Documento, version: number, corregido = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([595, 842]);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { height } = p.getSize();

  p.drawRectangle({ x: 0, y: height - 110, width: 595, height: 110, color: NAVY });
  p.drawCircle({ x: 520, y: height - 55, size: 26, color: AMBAR });
  p.drawText('KairóVolt', { x: 48, y: height - 58, size: 26, font: serif, color: rgb(1, 1, 1) });
  p.drawText('Documento de demostración · IDC Sistemas Eléctricos', { x: 48, y: height - 82, size: 10, font: sans, color: rgb(0.8, 0.88, 0.9) });

  p.drawText(d.nombre, { x: 48, y: height - 170, size: 22, font: serif, color: NAVY, maxWidth: 500 });
  p.drawText(`Expediente ${CLIENTE.folio}  ·  Versión ${version}${corregido ? '  ·  corregida' : ''}`, { x: 48, y: height - 196, size: 11, font: bold, color: TEAL });

  const filas: [string, string][] = [
    ['Titular', CLIENTE.titular], ['Representante', CLIENTE.contacto],
    ['Sitio', CLIENTE.sitio], ['Sistema', CLIENTE.sistema], ['Etapa', d.etapa],
  ];
  let y = height - 250;
  for (const [k, v] of filas) {
    p.drawText(k.toUpperCase(), { x: 48, y, size: 8, font: bold, color: SUAVE });
    p.drawText(v, { x: 150, y, size: 11, font: sans, color: NAVY });
    p.drawLine({ start: { x: 48, y: y - 10 }, end: { x: 547, y: y - 10 }, thickness: 0.5, color: rgb(0.84, 0.87, 0.9) });
    y -= 34;
  }

  p.drawText('Contenido simulado', { x: 48, y: y - 10, size: 12, font: bold, color: NAVY });
  const lineas = [d.descripcion, 'Este archivo es un ejemplo generado por el prototipo de KairóVolt.',
    'No contiene información real ni tiene validez ante CFE o IDC.'];
  lineas.forEach((l, i) => p.drawText(l, { x: 48, y: y - 34 - i * 18, size: 11, font: sans, color: SUAVE, maxWidth: 500 }));

  p.drawRectangle({ x: 48, y: 90, width: 220, height: 56, borderColor: SUAVE, borderWidth: 0.8, borderDashArray: [3, 3] });
  p.drawText('Firma / sello (ejemplo)', { x: 60, y: 112, size: 9, font: sans, color: SUAVE });
  p.drawText('KV · PROTOTIPO · SIN VALIDEZ', { x: 330, y: 60, size: 9, font: bold, color: AMBAR });
  return pdf.save();
}

export async function urlPdfDemo(d: Documento, version: number, corregido = false): Promise<string> {
  const bytes = await pdfDemo(d, version, corregido);
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
}

export async function descargarPdfDemo(d: Documento, version: number, corregido = false) {
  const url = await urlPdfDemo(d, version, corregido);
  const a = document.createElement('a');
  a.href = url; a.download = `${d.id}_v${version}_demo.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
