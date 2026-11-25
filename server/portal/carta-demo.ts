import { randomUUID, createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { VersionParticipantes } from '../../src/application/participantes';

export const VERSION_CARTA_DEMO = 'demo-1';
export const MARCA_CARTA_DEMO = 'KAIROVOLT-CARTA-DEMO-SIN-VALIDEZ';

export function datosCartaDisponibles(version: VersionParticipantes | null): version is VersionParticipantes {
  if (!version?.confirmado || !version.datos.titular) return false;
  const { tramita, apoderado, representante } = version.datos;
  return (tramita === 'apoderado' && !!apoderado) || (tramita === 'representante' && !!representante);
}

export async function generarCartaDemo(proyecto: { folio: string; nombre: string; municipio: string }, version: VersionParticipantes, ahora: number) {
  const id = randomUUID();
  const fecha = new Date(ahora).toISOString();
  const pdf = await PDFDocument.create();
  pdf.setSubject(MARCA_CARTA_DEMO);
  pdf.setTitle('Carta Poder de demostración');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(.063, .169, .251);
  const teal = rgb(.09, .42, .44);
  const page = pdf.addPage([612, 792]);
  page.drawRectangle({ x: 0, y: 670, width: 612, height: 122, color: navy });
  page.drawText('KairóVolt', { x: 42, y: 745, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Carta Poder', { x: 42, y: 691, size: 34, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 42, y: 615, width: 528, height: 31, color: rgb(.98, .91, .73) });
  page.drawText('DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL', { x: 53, y: 626, size: 12, font: bold, color: navy });
  const { titular, apoderado, representante, testigos, tramita } = version.datos;
  const designado = tramita === 'apoderado' ? apoderado : representante;
  const datos = [
    ['Proyecto', proyecto.folio + ' · ' + proyecto.nombre],
    ['Lugar y fecha', proyecto.municipio + ' · ' + new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Hermosillo' }).format(ahora)],
    ['Titular', titular],
    [tramita === 'apoderado' ? 'Apoderado' : 'Representante legal', designado],
    ['Testigos registrados', testigos.join(' · ') || 'Sin captura'],
  ] as const;
  let y = 590;
  for (const [etiqueta, valor] of datos) {
    const imprimible = [...valor.normalize('NFC')].map((s) => {
      try { regular.encodeText(s); return s; } catch { return '?'; }
    }).join('').slice(0, 1500);
    page.drawText(etiqueta, { x: 42, y, size: 10, font: bold, color: teal });
    const lineas = imprimible.match(/.{1,82}/gu) ?? [''];
    const visibles = lineas.slice(0, etiqueta === 'Testigos registrados' ? 9 : 3);
    page.drawText(visibles.join('\n'), { x: 42, y: y - 17, size: 11, font: regular, color: navy, lineHeight: 14, maxWidth: 523 });
    y -= 33 + (visibles.length - 1) * 15;
  }
  // Hasta ocho testigos y nombres de 160 caracteres se capturan completos en el snapshot.
  // Si la lista supera la portada, se continúa en una página de datos, también marcada como demo.
  if (testigos.join(' · ').length > 738) {
    const detalle = pdf.addPage([612, 792]);
    detalle.drawText('DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL', { x: 42, y: 742, size: 12, font: bold, color: navy });
    let linea = 706;
    for (const [i, testigo] of testigos.entries()) {
      const contenido = [...testigo].map((s) => { try { regular.encodeText(s); return s; } catch { return '?'; } }).join('');
      detalle.drawText(`Testigo ${i + 1} · ${contenido}`, { x: 42, y: linea, size: 10, font: regular, color: navy, maxWidth: 528, lineHeight: 14 });
      linea -= 53;
    }
  }
  for (const [x, etiqueta] of [[42, 'Titular'], [322, 'Representante o apoderado']] as const) {
    page.drawLine({ start: { x, y: 132 }, end: { x: x + 248, y: 132 }, color: teal });
    page.drawText('Espacio demostrativo · ' + etiqueta, { x, y: 115, size: 10, font: regular, color: navy });
  }
  page.drawText('Plantilla ' + VERSION_CARTA_DEMO + ' · ' + id, { x: 42, y: 43, size: 9, font: regular, color: teal });
  const bytes = Buffer.concat([await pdf.save({ useObjectStreams: false }), Buffer.from('\n%' + MARCA_CARTA_DEMO + '\n')]);
  return { id, fecha, plantilla: VERSION_CARTA_DEMO, snapshot: { proyecto, version }, sha256: createHash('sha256').update(bytes).digest('hex'), bytes };
}
