import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DatosSolicitud } from '../data/solicitud-demo';

export const AVISO_SOLICITUD_DEMO = 'DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL.';
export const RUTA_FORMATO_SOLICITUD = '/guias/solicitud-interconexion-formato.pdf';

// Coordenadas medidas sobre el formato adjunto (carta, 612 × 792 pt) renderizado a 1100 px de ancho.
const PX = 1100 / 612;
const alto = 792;

/**
 * Rellena el formato adjunto con los datos recibidos. Deja en blanco: número de solicitud, firmas,
 * nombre/cargo/fecha del firmante y el recuadro de sello del Centro de Atención.
 */
export async function generarSolicitudDemo(datos: DatosSolicitud, plantilla: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(plantilla);
  pdf.setTitle('Solicitud para la interconexión — demostración');
  pdf.setSubject('KAIROVOLT-SOLICITUD-DEMO-SIN-VALIDEZ');
  const pagina = pdf.getPage(0);
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.06, 0.2, 0.34);

  const texto = (valor: string, px: number, py: number, tam = 9, ancho = 0) => {
    const limpio = valor.normalize('NFC').replace(/[^ -ÿ]/g, '?');
    if (!limpio) return;
    let t = tam;
    while (ancho && t > 6 && fuente.widthOfTextAtSize(limpio, t) > ancho) t -= 0.5;
    pagina.drawText(limpio, { x: px / PX, y: alto - py / PX, size: t, font: fuente, color: tinta });
  };
  const marca = (px: number, py: number) =>
    pagina.drawText('X', { x: px / PX - 3.2, y: alto - py / PX - 3.6, size: 11, font: negrita, color: tinta });

  texto(datos.fecha, 345, 125);

  const bloque = (d: DatosSolicitud['solicitante'] | DatosSolicitud['contacto'], filas: [number, number, number, number], esContacto: boolean) => {
    const [f0, f1, f2, f3] = filas;
    if (!esContacto) texto((d as DatosSolicitud['solicitante']).nombre, 98, f0, 9.5, 870);
    else {
      const c = d as DatosSolicitud['contacto'];
      texto(c.nombre, 98, f0, 9.5, 400); texto(c.puesto, 520, f0, 9.5, 450);
    }
    texto(d.calle, 98, f1, 9, 225); texto(d.numExt, 337, f1, 9, 170); texto(d.numInt, 527, f1, 9, 200); texto(d.cp, 747, f1, 9, 200);
    texto(d.colonia, 98, f2, 9, 295); texto(d.municipio, 404, f2, 9, 270); texto(d.estado, 700, f2, 9, 270);
    texto(d.telefono, 98, f3, 9, 290); texto(d.correo, 402, f3, 9, 280); // Fax: no aplica
  };
  bloque(datos.solicitante, [187, 234, 266, 298], false);
  bloque(datos.contacto, [363, 407, 438, 469], true);

  // III. Modalidad
  if (datos.modalidad === 'media') marca(787, 515);
  // IV. Utilización
  marca(datos.utilizacion === 'carga' ? 258 : datos.utilizacion === 'excedentes' ? 563 : 788, datos.utilizacion === 'carga' ? 577 : datos.utilizacion === 'excedentes' ? 575 : 575);
  // V. Servicio actual
  texto(datos.rpu, 98, 650, 9.5, 400); texto(datos.nivelTension, 535, 650, 9.5, 430);
  // VI. Central
  texto(datos.central.fechaOperacion, 98, 722, 9.5, 290);
  texto(datos.central.capacidadBruta ? datos.central.capacidadBruta + ' kW' : '', 410, 722, 9.5, 100);
  if (datos.central.incremento) texto(datos.central.incremento + ' kW', 522, 722, 9.5, 160);
  texto(datos.central.generacionMensual ? datos.central.generacionMensual + ' kWh/mes' : '', 702, 722, 9.5, 270);
  // VII. Manifestación y tecnología solar
  marca(963, 766);
  marca(174, 829);
  texto(datos.unidades, 98, 898, 8.5, 230);
  texto(datos.utmX, 340, 927, 9, 340); texto(datos.utmY, 702, 927, 9, 270);

  leyendas(pagina, negrita, fuente);
  return pdf.save();
}

function leyendas(pagina: PDFPage, negrita: PDFFont, fuente: PDFFont) {
  const ancho = pagina.getWidth();
  const centrado = (t: string, y: number, tam: number, f: PDFFont, color = rgb(0.4, 0.27, 0)) =>
    pagina.drawText(t, { x: (ancho - f.widthOfTextAtSize(t, tam)) / 2, y, size: tam, font: f, color });
  pagina.drawRectangle({ x: 48, y: alto - 52, width: ancho - 96, height: 20, color: rgb(0.99, 0.94, 0.8) });
  centrado(AVISO_SOLICITUD_DEMO, alto - 46, 10, negrita);
  centrado('Generado por KairóVolt a partir de datos ficticios. Revisa y completa con IDC antes de cualquier uso real.', 28, 8, fuente);
  centrado(AVISO_SOLICITUD_DEMO, 16, 8, negrita);
}

export async function descargarSolicitudDemo(datos: DatosSolicitud): Promise<void> {
  const r = await fetch(RUTA_FORMATO_SOLICITUD);
  if (!r.ok) throw new Error('No se pudo abrir el formato de la solicitud.');
  const bytes = await generarSolicitudDemo(datos, new Uint8Array(await r.arrayBuffer()));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'solicitud-interconexion-demostracion.pdf'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
