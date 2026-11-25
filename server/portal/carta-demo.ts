import { randomUUID, createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { VersionParticipantes } from '../../src/application/participantes';

export const VERSION_CARTA_DEMO = 'demo-2';
export const MARCA_CARTA_DEMO = 'KAIROVOLT-CARTA-DEMO-SIN-VALIDEZ';

export function datosCartaDisponibles(version: VersionParticipantes | null): version is VersionParticipantes {
  if (!version?.confirmado || !version.datos.titular) return false;
  const { tramita, apoderado, representante } = version.datos;
  return (tramita === 'apoderado' && !!apoderado) || (tramita === 'representante' && !!representante);
}

function lineas(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const salida: string[] = [];
  let actual = '';
  for (const caracter of texto.normalize('NFC')) {
    let letra = caracter;
    try { fuente.encodeText(letra); } catch { letra = '?'; }
    if (fuente.widthOfTextAtSize(actual + letra, tamano) > ancho) {
      const corte = actual.lastIndexOf(' ');
      if (corte > 0) {
        salida.push(actual.slice(0, corte));
        actual = actual.slice(corte + 1);
      } else {
        salida.push(actual);
        actual = '';
      }
    }
    actual += letra;
  }
  if (actual) salida.push(actual.trim());
  return salida;
}

export async function generarCartaDemo(proyecto: { folio: string; nombre: string; municipio: string }, version: VersionParticipantes, ahora: number, muestraObservada = false) {
  const id = randomUUID();
  const fecha = new Date(ahora).toISOString();
  const pdf = await PDFDocument.create();
  pdf.setSubject(MARCA_CARTA_DEMO);
  pdf.setTitle('Carta Poder de demostración');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(.07, .12, .17);
  const tenue = rgb(.28, .31, .34);
  const aviso = 'DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL';
  const page = pdf.addPage([612, 792]);
  const centrado = (texto: string, y: number, tamano: number, fuente: PDFFont) =>
    page.drawText(texto, { x: (612 - fuente.widthOfTextAtSize(texto, tamano)) / 2, y, size: tamano, font: fuente, color: tinta });
  centrado('CARTA PODER', 724, 19, bold);
  page.drawRectangle({ x: 65, y: 673, width: 482, height: 24, color: rgb(.98, .94, .82) });
  centrado(aviso, 681, 10, bold);
  const { titular, apoderado, representante, testigos, tramita } = version.datos;
  const designado = tramita === 'apoderado' ? apoderado : representante;
  const lugar = proyecto.municipio + ', ' + new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Hermosillo' }).format(ahora);
  page.drawText(lineas(lugar, bold, 11, 482).slice(0, 2).join('\n'), { x: 65, y: 641, size: 11, font: bold, color: tinta, lineHeight: 15 });
  page.drawText('A QUIEN CORRESPONDA:', { x: 65, y: 593, size: 11, font: bold, color: tinta });
  const texto = `En este ejemplo de Carta Poder, ${titular} figura como otorgante y ${designado} como ${tramita === 'apoderado' ? 'persona apoderada' : 'representante legal'}. La representación ilustrada se refiere únicamente a la preparación y presentación de la documentación del proyecto de interconexión identificado con el folio ${proyecto.folio}.`;
  const parrafos = [texto, 'Los espacios de firma muestran dónde se identificarían las personas participantes en una plantilla autorizada.'];
  let y = 559;
  for (const parrafo of parrafos) {
    const contenido = lineas(parrafo, regular, 11, 482);
    page.drawText(contenido.join('\n'), { x: 65, y, size: 11, font: regular, color: tinta, lineHeight: 17 });
    y -= contenido.length * 17 + 12;
  }
  const bloques = [
    ['OTORGANTE', titular], [tramita === 'apoderado' ? 'APODERADO/A' : 'REPRESENTANTE LEGAL', designado],
    ['TESTIGO 1', testigos[0] ?? 'Sin captura'], ['TESTIGO 2', testigos[1] ?? 'Sin captura'],
  ];
  bloques.forEach(([etiqueta = '', nombre = ''], i) => {
    const x = i % 2 ? 327 : 65;
    const altura = i < 2 ? 315 : 189;
    const ancho = 220;
    page.drawText(etiqueta, { x: x + (ancho - bold.widthOfTextAtSize(etiqueta, 10)) / 2, y: altura + 34, size: 10, font: bold, color: tinta });
    page.drawLine({ start: { x, y: altura }, end: { x: x + ancho, y: altura }, color: tinta });
    if (muestraObservada) {
      page.drawText(i === 0 ? 'Firma faltante en este ejemplo' : 'Firma ficticia ilustrada', {
        x: x + 16, y: altura + 10, size: 10, font: regular, color: i === 0 ? rgb(.65, .15, .12) : tenue,
      });
    }
    lineas(nombre, regular, 10, ancho).slice(0, 5).forEach((linea, j) => {
      page.drawText(linea, { x: x + (ancho - regular.widthOfTextAtSize(linea, 10)) / 2, y: altura - 16 - j * 13, size: 10, font: regular, color: tinta });
    });
  });
  if (testigos.length > 2) {
    const adicional = pdf.addPage([612, 792]);
    adicional.drawText(aviso, { x: 65, y: 722, size: 11, font: bold, color: tinta });
    testigos.slice(2).forEach((testigo, i) => {
      const altura = 660 - i * 95;
      adicional.drawText('TESTIGO ' + (i + 3), { x: 65, y: altura, size: 10, font: bold, color: tinta });
      adicional.drawLine({ start: { x: 65, y: altura - 31 }, end: { x: 547, y: altura - 31 }, color: tinta });
      adicional.drawText(lineas(testigo, regular, 10, 482).join('\n'), { x: 65, y: altura - 47, size: 10, lineHeight: 13, font: regular, color: tinta });
    });
  }
  page.drawText('KairóVolt · Plantilla ' + VERSION_CARTA_DEMO + ' · ' + id, { x: 65, y: 52, size: 8, font: regular, color: tenue });
  const bytes = Buffer.concat([await pdf.save({ useObjectStreams: false }), Buffer.from('\n%' + MARCA_CARTA_DEMO + '\n')]);
  return { id, fecha, plantilla: VERSION_CARTA_DEMO, snapshot: { proyecto, version }, sha256: createHash('sha256').update(bytes).digest('hex'), bytes };
}
