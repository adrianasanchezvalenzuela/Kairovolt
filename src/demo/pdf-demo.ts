import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generarSolicitudDemo, RUTA_FORMATO_SOLICITUD } from '../application/solicitud-demo';
import { solicitudInicial } from '../data/solicitud-demo';
import { LEYENDA_DEMO, type DefDocumento, type VersionDemo } from './expediente-demo';

const NAVY = rgb(0.063, 0.169, 0.251), TEAL = rgb(0.09, 0.42, 0.44), AMBAR = rgb(0.95, 0.74, 0.33), SUAVE = rgb(0.32, 0.4, 0.47);

/** PDF ficticio para vista previa y descarga. Nunca contiene datos reales. */
export async function pdfDocumentoDemo(def: DefDocumento, v: VersionDemo): Promise<Uint8Array> {
  if (def.id === 'solicitud' && v.autor === 'idc') {
    const r = await fetch(RUTA_FORMATO_SOLICITUD);
    if (r.ok) return generarSolicitudDemo(solicitudInicial(), new Uint8Array(await r.arrayBuffer()));
  }
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([595, 842]);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const alto = p.getHeight();
  p.drawRectangle({ x: 0, y: alto - 100, width: 595, height: 100, color: NAVY });
  p.drawCircle({ x: 523, y: alto - 50, size: 24, color: AMBAR });
  p.drawText('KairóVolt', { x: 48, y: alto - 56, size: 26, font: serif, color: rgb(1, 1, 1) });
  p.drawText(LEYENDA_DEMO.toUpperCase() + '.', { x: 48, y: alto - 80, size: 10, font: bold, color: AMBAR });
  p.drawText(def.nombre, { x: 48, y: alto - 160, size: 21, font: serif, color: NAVY, maxWidth: 500 });
  p.drawText(`Versión ${v.n} · ${v.autor === 'idc' ? 'cargada por IDC' : 'enviada por el cliente'} · ${v.archivo}`, { x: 48, y: alto - 190, size: 10.5, font: bold, color: TEAL });
  const lineas = def.id === 'dictamen_uvie'
    ? ['Ejemplo ficticio. En un caso real, este dictamen lo emite una Unidad de Verificación de Instalaciones', 'Eléctricas (UVIE) y IDC lo gestiona. KairóVolt no lo genera.']
    : ['Archivo de ejemplo generado por el prototipo de KairóVolt.', def.sirve];
  lineas.concat(['No contiene información real ni tiene validez ante CFE o IDC.']).forEach((l, i) =>
    p.drawText(l, { x: 48, y: alto - 235 - i * 18, size: 11, font: sans, color: SUAVE, maxWidth: 500 }));
  p.drawRectangle({ x: 48, y: 120, width: 500, height: 330, borderColor: rgb(0.8, 0.85, 0.88), borderWidth: 1, borderDashArray: [4, 4] });
  p.drawText('Contenido ilustrativo del documento', { x: 190, y: 280, size: 12, font: sans, color: SUAVE });
  p.drawText(LEYENDA_DEMO.toUpperCase() + '.', { x: 48, y: 60, size: 9, font: bold, color: AMBAR });
  return pdf.save();
}

export async function urlDocumentoDemo(def: DefDocumento, v: VersionDemo): Promise<string> {
  return URL.createObjectURL(new Blob([(await pdfDocumentoDemo(def, v)) as BlobPart], { type: 'application/pdf' }));
}

export async function descargarDocumentoDemo(def: DefDocumento, v: VersionDemo) {
  const url = await urlDocumentoDemo(def, v);
  const a = document.createElement('a');
  a.href = url; a.download = `${def.id}-v${v.n}-demostracion.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
