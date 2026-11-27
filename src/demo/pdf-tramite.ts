import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { DOCUMENTOS_DEMO, LEYENDA_DEMO } from './expediente-demo';
import { archivoDeVersion, cfe, type ArchivoDemo } from './archivos-demo';
import { ESCENARIO, type TramiteDemo } from './tramite-demo';
import { leerExpedienteDemo } from './expediente-demo';
import { DOMICILIO_DEMO, TITULAR_DEMO, fechaLargaDemo } from '../data/personas-demo';

const NAVY = rgb(0.063, 0.169, 0.251), AMBAR = rgb(0.95, 0.74, 0.33), SUAVE = rgb(0.32, 0.4, 0.47);

async function hoja(titulo: string, lineas: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo); pdf.setSubject(LEYENDA_DEMO);
  const p = pdf.addPage([612, 792]);
  const ser = await pdf.embedFont(StandardFonts.TimesRomanBold), reg = await pdf.embedFont(StandardFonts.Helvetica), neg = await pdf.embedFont(StandardFonts.HelveticaBold);
  p.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: NAVY });
  p.drawText('KairóVolt', { x: 40, y: 748, size: 22, font: ser, color: rgb(1, 1, 1) });
  p.drawText('DEMOSTRACIÓN — SIN VALIDEZ LEGAL', { x: 40, y: 722, size: 10, font: neg, color: AMBAR });
  p.drawCircle({ x: 560, y: 746, size: 22, color: AMBAR });
  p.drawText(titulo, { x: 40, y: 660, size: 18, font: ser, color: NAVY, maxWidth: 530 });
  let y = 620;
  for (const l of lineas) { p.drawText(l, { x: 40, y, size: 10.5, font: reg, color: rgb(0.06, 0.1, 0.16), maxWidth: 530 }); y -= 24; }
  p.drawText('DEMO — SIN VALIDEZ OFICIAL', { x: 80, y: 220, size: 34, font: neg, color: rgb(0.55, 0.6, 0.66), opacity: 0.16, rotate: degrees(33) });
  p.drawText('DEMO — Sin validez oficial', { x: 36, y: 18, size: 8, font: neg, color: SUAVE });
  return pdf.save();
}

/** Registro ilustrativo de la instalación del medidor (se genera con los datos del escenario). */
export async function registroInstalacionPdf(t: TramiteDemo): Promise<Uint8Array> {
  const i = t.instalacion;
  return hoja('Registro de instalación del medidor (demostración)', [
    `Titular: ${TITULAR_DEMO.nombre}`, `Domicilio del servicio: ${DOMICILIO_DEMO.texto}`,
    `Medidor bidireccional (ficticio): ${i.medidor?.numero ?? ESCENARIO.medidor}`, `Fecha de instalación: ${i.medidor ? fechaLargaDemo(i.medidor.fecha + 'T12:00:00-07:00') : 'pendiente'}`,
    `Instaló: ${ESCENARIO.instalacionPor} · Seguimiento: ${ESCENARIO.seguimientoPor}`,
    'Este registro es una evidencia de demostración. No sustituye ningún documento oficial.',
  ]);
}

export interface DocFinal { id: string; titulo: string; detalle: string; archivos: ArchivoDemo[]; disponible: boolean; ruta?: string }

/** Documentos del expediente final, derivados del estado del trámite (nada que no esté respaldado por un hito). */
export async function documentosExpedienteFinal(folio: string, t: TramiteDemo): Promise<DocFinal[]> {
  const exp = leerExpedienteDemo(folio);
  const iniciales: ArchivoDemo[] = DOCUMENTOS_DEMO.flatMap((d) => { const v = exp.docs[d.id]?.versiones.at(-1); return v ? [{ ...archivoDeVersion(folio, d.id, v), etiqueta: d.corto }] : []; });
  const reg: ArchivoDemo[] = t.instalacion.estado === 'instalada'
    ? [{ etiqueta: 'Registro de instalación', ruta: URL.createObjectURL(new Blob([(await registroInstalacionPdf(t)) as BlobPart], { type: 'application/pdf' })) }] : [];
  return [
    { id: 'inicial', titulo: 'Expediente documental inicial', detalle: `${iniciales.length} documentos del expediente de interconexión`, archivos: iniciales, disponible: iniciales.length > 0 },
    { id: 'acuse', titulo: 'Acuse de ingreso', detalle: t.ingresoCfe ? `Ingresado el ${fechaLargaDemo(t.ingresoCfe)}` : 'Disponible cuando IDC registre el ingreso', archivos: [{ etiqueta: 'Acuse de ingreso', ruta: cfe('acuse-ingreso.pdf') }], disponible: !!t.ingresoCfe },
    { id: 'resolucion', titulo: 'Oficio resolutivo favorable de CFE', detalle: t.resolucion ? `Resolución del ${fechaLargaDemo(t.resolucion.fecha)} (demostración)` : 'Disponible con la resolución', archivos: [{ etiqueta: 'Oficio resolutivo', ruta: cfe('resolucion-favorable.pdf') }], disponible: !!t.resolucion },
    { id: 'c-inter', titulo: 'Contrato de interconexión formalizado', detalle: t.contratos.interconexion.formalizadoEn ? `Formalizado el ${fechaLargaDemo(t.contratos.interconexion.formalizadoEn)}` : 'Disponible al formalizarse', archivos: [{ etiqueta: 'Contrato de interconexión', ruta: cfe('contrato-de-interconexion-formalizado.pdf') }], disponible: t.contratos.interconexion.estado === 'formalizado' },
    { id: 'c-contra', titulo: 'Contrato de contraprestación formalizado', detalle: t.contratos.contraprestacion.formalizadoEn ? `Formalizado el ${fechaLargaDemo(t.contratos.contraprestacion.formalizadoEn)}` : 'Disponible al formalizarse', archivos: [{ etiqueta: 'Contrato de contraprestación', ruta: cfe('contrato-de-contraprestacion-formalizado.pdf') }], disponible: t.contratos.contraprestacion.estado === 'formalizado' },
    { id: 'instalacion', titulo: 'Registro de instalación del medidor', detalle: t.instalacion.medidor ? `Medidor ${t.instalacion.medidor.numero}` : 'Disponible al instalarse el medidor', archivos: reg, disponible: reg.length > 0 },
  ];
}

/** Descarga un PDF único con portada, índice y todos los documentos disponibles del expediente final. */
export async function descargarExpedienteCompleto(folio: string, t: TramiteDemo): Promise<void> {
  const docs = (await documentosExpedienteFinal(folio, t)).filter((d) => d.disponible);
  const salida = await PDFDocument.create();
  const indice = await PDFDocument.load(await hoja(`Expediente final · ${folio} (demostración)`, [
    `Titular: ${TITULAR_DEMO.nombre}`, `Tipo de trámite: ${ESCENARIO.tipoTramite}`, `Esquema de contraprestación: ${ESCENARIO.esquema}`, '', 'Contenido:',
    ...docs.map((d, i) => `${i + 1}. ${d.titulo}`), '', 'Archivo de demostración que reúne documentos ficticios. No es un expediente oficial.']));
  (await salida.copyPages(indice, [0])).forEach((pg) => salida.addPage(pg));
  for (const d of docs) for (const a of d.archivos) {
    try {
      const bytes = await (await fetch(a.ruta)).arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      (await salida.copyPages(src, src.getPageIndices())).forEach((pg) => salida.addPage(pg));
    } catch { /* se omite un archivo no legible */ }
  }
  const url = URL.createObjectURL(new Blob([(await salida.save()) as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = `expediente-final-${folio}-demostracion.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
