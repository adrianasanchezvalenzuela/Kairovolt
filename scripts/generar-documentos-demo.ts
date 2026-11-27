/**
 * Genera los PDF de demostración de public/demo/documentos/. Todo es ficticio y lleva marca «DEMO — Sin validez oficial».
 * Uso: npm run demo:documentos
 * Las imágenes de referencia (INE, constancia, recibo, firmas) solo sirvieron como inspiración estética: aquí no se copia
 * ningún dato, código QR, logotipo oficial ni firma real.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { generarCartaDemo } from '../server/portal/carta-demo';
import { generarSolicitudDemo } from '../src/application/solicitud-demo';
import { solicitudInicial } from '../src/data/solicitud-demo';
import {
  DOMICILIO_DEMO, MARCA_DEMO, PROYECTO_DEMO, REPRESENTANTE_DEMO, SERVICIO_DEMO, TESTIGOS_DEMO, TITULAR_DEMO, ANCLA_DEMO, diaDemo, fechaCortaDemo, fechaLargaDemo,
} from '../src/data/personas-demo';
import { ESCENARIO } from '../src/demo/tramite-demo';

const RAIZ = join(process.cwd(), 'public', 'demo', 'documentos');
const NAVY = rgb(0.063, 0.169, 0.251), TEAL = rgb(0.09, 0.42, 0.44), AMBAR = rgb(0.95, 0.74, 0.33), SUAVE = rgb(0.32, 0.4, 0.47), GRIS = rgb(0.85, 0.88, 0.9), TINTA = rgb(0.06, 0.1, 0.16);
const AZUL_FIRMA = rgb(0.08, 0.15, 0.55);
const salvar = (ruta: string, bytes: Uint8Array) => { const p = join(RAIZ, ruta); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, bytes); console.log('  ' + ruta, (bytes.length / 1024).toFixed(1) + ' KB'); };

interface Kit { pdf: PDFDocument; reg: PDFFont; neg: PDFFont; ser: PDFFont }
async function nuevo(titulo: string): Promise<Kit> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo); pdf.setSubject(MARCA_DEMO); pdf.setProducer('KairóVolt · documentos de demostración'); pdf.setCreationDate(new Date(ANCLA_DEMO));
  return { pdf, reg: await pdf.embedFont(StandardFonts.Helvetica), neg: await pdf.embedFont(StandardFonts.HelveticaBold), ser: await pdf.embedFont(StandardFonts.TimesRomanBold) };
}
/** Marca de agua diagonal + pie obligatorios en toda página. */
function marca(p: PDFPage, k: Kit, texto = MARCA_DEMO.toUpperCase()) {
  const { width: w, height: h } = p.getSize();
  p.drawText(texto, { x: w * 0.13, y: h * 0.27, size: texto.length > 30 ? 21 : 32, font: k.neg, color: rgb(0.55, 0.6, 0.66), opacity: 0.16, rotate: degrees(33) });
  p.drawText(texto, { x: 36, y: 18, size: 8, font: k.neg, color: SUAVE });
}
const T = (p: PDFPage, k: Kit, s: string, x: number, y: number, size = 10, o: { neg?: boolean; color?: ReturnType<typeof rgb>; max?: number; ser?: boolean } = {}) =>
  p.drawText(s, { x, y, size, font: o.ser ? k.ser : o.neg ? k.neg : k.reg, color: o.color ?? TINTA, maxWidth: o.max });
const caja = (p: PDFPage, x: number, y: number, w: number, h: number, o: { fill?: ReturnType<typeof rgb>; borde?: ReturnType<typeof rgb>; grosor?: number } = {}) =>
  p.drawRectangle({ x, y, width: w, height: h, color: o.fill, borderColor: o.borde ?? (o.fill ? undefined : GRIS), borderWidth: o.fill && !o.borde ? 0 : o.grosor ?? 0.8 });
function semilla(n: number) { let a = n; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function barras(p: PDFPage, x: number, y: number, w: number, h: number, s: number) {
  const r = semilla(s); let cx = x;
  while (cx < x + w) { const g = 0.8 + r() * 2.6; p.drawRectangle({ x: cx, y, width: g, height: h, color: TINTA }); cx += g + 0.8 + r() * 2.2; }
}
/** Bloque tipo "código" deliberadamente NO funcional (módulos aleatorios sin estructura de QR). */
function pseudoCodigo(p: PDFPage, k: Kit, x: number, y: number, lado: number, s: number) {
  const r = semilla(s); const n = 17; const c = lado / n;
  caja(p, x, y, lado, lado, { fill: rgb(1, 1, 1), borde: GRIS });
  for (let i = 1; i < n - 1; i++) for (let j = 1; j < n - 1; j++) if (r() > 0.55) p.drawRectangle({ x: x + i * c, y: y + j * c, width: c, height: c, color: rgb(0.45, 0.5, 0.55) });
  p.drawText('CÓDIGO ILUSTRATIVO', { x: x + 2, y: y + lado / 2 - 3, size: 5.5, font: k.neg, color: rgb(0.7, 0.2, 0.15), rotate: degrees(0) });
}

/** Cuatro trazos manuscritos originales y distintos (coordenadas SVG de una caja de ~160×50, y hacia abajo). */
const FIRMAS = [
  'M5 36 C14 4 30 4 28 30 C26 50 46 10 56 18 C66 27 50 42 70 28 C86 17 96 12 101 26 C105 34 119 20 150 13 M12 45 C52 38 100 47 152 37',
  'M8 40 L22 8 L34 38 L46 10 L58 36 L72 14 C84 32 96 32 110 18 L152 25 M28 30 L132 42',
  'M6 32 C18 3 31 3 27 27 C25 42 41 42 47 22 C51 9 59 9 61 27 C63 40 77 37 85 20 C91 9 101 19 97 31 C95 42 121 44 153 11',
  'M10 24 C30 48 50 6 70 32 C80 44 91 14 105 19 C121 25 109 44 129 35 L152 9 M3 46 L148 46 C120 41 70 47 38 40',
];
function firmar(p: PDFPage, i: number, x: number, y: number, escala = 0.8) {
  p.drawSvgPath(FIRMAS[i % 4]!, { x, y: y + 50 * escala, scale: escala, borderColor: AZUL_FIRMA, borderWidth: 1.3 / escala, borderOpacity: 0.9 });
}

// ─────────────── Identificaciones (frente y reverso) ───────────────
async function identificacion(nombre: string, clave: string, nac: string, rol: string, semillaN: number): Promise<Uint8Array> {
  const k = await nuevo('Identificación de ejemplo — ' + rol);
  for (const lado of ['frente', 'reverso'] as const) {
    const p = k.pdf.addPage([612, 792]);
    const x = 136, y = 470, w = 340, h = 215;
    caja(p, x, y, w, h, { fill: rgb(0.93, 0.95, 0.96), borde: SUAVE, grosor: 1.2 });
    caja(p, x, y + h - 30, w, 30, { fill: lado === 'frente' ? TEAL : NAVY });
    T(p, k, lado === 'frente' ? 'CREDENCIAL DE EJEMPLO · DEMO' : 'REVERSO · CREDENCIAL DE EJEMPLO', x + 10, y + h - 20, 9.5, { neg: true, color: rgb(1, 1, 1) });
    if (lado === 'frente') {
      caja(p, x + 12, y + 70, 82, 98, { fill: rgb(0.82, 0.86, 0.88) });
      p.drawCircle({ x: x + 53, y: y + 138, size: 17, color: rgb(0.6, 0.66, 0.7) });
      p.drawEllipse({ x: x + 53, y: y + 86, xScale: 28, yScale: 20, color: rgb(0.6, 0.66, 0.7) });
      T(p, k, 'FOTO ILUSTRATIVA', x + 17, y + 74, 6.5, { neg: true, color: SUAVE });
      const f: [string, string][] = [['NOMBRE', nombre], ['DOMICILIO', DOMICILIO_DEMO.calle + ' ' + DOMICILIO_DEMO.numExt + ', ' + DOMICILIO_DEMO.colonia], ['', DOMICILIO_DEMO.municipio + ', ' + DOMICILIO_DEMO.estado], ['CLAVE DE ELECTOR', clave], ['FECHA DE NACIMIENTO', nac]];
      f.forEach(([a, b], i) => { if (a) T(p, k, a, x + 108, y + 168 - i * 24, 6.5, { neg: true, color: SUAVE }); T(p, k, b, x + 108, y + 158 - i * 24, 9, { neg: true, max: 220 }); });
      T(p, k, 'VIGENCIA 2030 (ficticia)', x + 108, y + 18, 7.5, { color: SUAVE });
      T(p, k, 'DEMO', x + w - 62, y + 14, 16, { neg: true, color: rgb(0.7, 0.2, 0.15) });
    } else {
      barras(p, x + 14, y + 150, w - 28, 26, semillaN);
      pseudoCodigo(p, k, x + w - 92, y + 20, 74, semillaN + 5);
      p.drawEllipse({ x: x + 70, y: y + 70, xScale: 26, yScale: 32, borderColor: SUAVE, borderWidth: 0.8 });
      p.drawEllipse({ x: x + 70, y: y + 70, xScale: 16, yScale: 22, borderColor: SUAVE, borderWidth: 0.8 });
      T(p, k, 'HUELLA ILUSTRATIVA', x + 34, y + 28, 6.5, { neg: true, color: SUAVE });
      T(p, k, 'NO FUNCIONAL · DEMO', x + 160, y + 112, 8, { neg: true, color: rgb(0.7, 0.2, 0.15) });
    }
    T(p, k, lado === 'frente' ? 'FRENTE' : 'REVERSO', 285, 430, 12, { neg: true, color: rgb(0.8, 0.25, 0.2) });
    T(p, k, `Identificación de ejemplo (${rol}). Datos ficticios; no es un documento oficial.`, 136, 400, 9, { color: SUAVE });
    marca(p, k);
  }
  return k.pdf.save();
}

// ─────────────── Constancia de situación fiscal (inspirada, no copia) ───────────────
async function constancia(): Promise<Uint8Array> {
  const k = await nuevo('Constancia de situación fiscal — ejemplo');
  const p = k.pdf.addPage([612, 792]);
  caja(p, 36, 730, 540, 26, { fill: rgb(0.24, 0.26, 0.28) });
  T(p, k, 'EJEMPLO ILUSTRATIVO · estructura inspirada en la constancia de situación fiscal', 46, 739, 9, { neg: true, color: rgb(1, 1, 1) });
  caja(p, 36, 620, 250, 100, { fill: rgb(0.97, 0.97, 0.98), borde: GRIS });
  T(p, k, 'CÉDULA DE IDENTIFICACIÓN FISCAL', 44, 706, 9, { neg: true });
  pseudoCodigo(p, k, 46, 630, 60, 11);
  T(p, k, TITULAR_DEMO.rfc, 126, 675, 10, { neg: true }); T(p, k, 'RFC (ficticio)', 126, 662, 8, { color: SUAVE });
  T(p, k, 'Nombre completo', 126, 645, 8, { color: SUAVE }); T(p, k, TITULAR_DEMO.nombre, 126, 634, 8.5, { max: 150 });
  caja(p, 316, 670, 260, 50, { fill: rgb(0.97, 0.97, 0.98), borde: GRIS });
  T(p, k, 'CONSTANCIA DE SITUACIÓN FISCAL', 328, 690, 11, { neg: true });
  caja(p, 316, 624, 260, 40, { fill: rgb(0.97, 0.97, 0.98), borde: GRIS });
  T(p, k, 'Lugar y fecha de emisión', 328, 650, 8, { color: SUAVE });
  T(p, k, `HERMOSILLO, SONORA A ${fechaLargaDemo(diaDemo(-14)).toUpperCase()}`, 328, 635, 8.5, { neg: true, max: 240 });
  const tabla = (titulo: string, y: number, filas: [string, string][]) => {
    caja(p, 36, y - 22, 540, 22, { fill: rgb(0.93, 0.94, 0.95) }); T(p, k, titulo, 44, y - 15, 9.5, { neg: true });
    filas.forEach(([a, b], i) => { const yy = y - 22 - (i + 1) * 24; caja(p, 36, yy, 540, 24, { borde: GRIS }); T(p, k, a, 44, yy + 8, 8.5, { neg: true }); T(p, k, b, 210, yy + 8, 8.5, { max: 360 }); });
  };
  tabla('Datos de identificación del contribuyente', 600, [
    ['RFC (ficticio):', TITULAR_DEMO.rfc], ['CURP (ficticia):', 'DEMO850101HSRXXX00'], ['Nombre:', TITULAR_DEMO.nombre],
    ['Fecha de inicio de operaciones:', '01 DE ENERO DE 2012'], ['Estatus en el padrón:', 'ACTIVO'], ['Fecha del último cambio de estado:', '01 DE ENERO DE 2012'],
  ]);
  tabla('Datos del domicilio registrado', 394, [
    ['Código postal:', DOMICILIO_DEMO.cp], ['Nombre de vialidad:', DOMICILIO_DEMO.calle], ['Número exterior:', DOMICILIO_DEMO.numExt],
    ['Colonia:', DOMICILIO_DEMO.colonia], ['Municipio:', DOMICILIO_DEMO.municipio], ['Entidad federativa:', DOMICILIO_DEMO.estado.toUpperCase()],
  ]);
  T(p, k, 'Página 1 de 2', 500, 60, 8, { color: SUAVE }); marca(p, k);
  const q = k.pdf.addPage([612, 792]);
  T(q, k, 'Actividades económicas y obligaciones (ilustrativo)', 44, 730, 12, { neg: true });
  tabla2(q, k, 700, [['Comercio al por menor (ejemplo)', '100 %', '01/01/2012']], ['Actividad económica', 'Porcentaje', 'Fecha de inicio']);
  tabla2(q, k, 600, [['Régimen de actividades empresariales y profesionales (ejemplo)', '', '01/01/2012']], ['Régimen', '', 'Fecha de inicio']);
  T(q, k, 'Página 2 de 2 · Contenido ilustrativo sin valor fiscal.', 44, 60, 8, { color: SUAVE }); marca(q, k);
  return k.pdf.save();
}
function tabla2(p: PDFPage, k: Kit, y: number, filas: string[][], cab: string[]) {
  caja(p, 36, y - 22, 540, 22, { fill: rgb(0.93, 0.94, 0.95) });
  cab.forEach((c, i) => T(p, k, c, 44 + [0, 330, 430][i]!, y - 15, 9, { neg: true }));
  filas.forEach((f, r) => { const yy = y - 22 - (r + 1) * 26; caja(p, 36, yy, 540, 26, { borde: GRIS }); f.forEach((c, i) => T(p, k, c, 44 + [0, 330, 430][i]!, yy + 9, 8.5, { max: i === 0 ? 320 : 100 })); });
}

// ─────────────── Recibo de electricidad (inspirado, sin logotipos) ───────────────
async function recibo(): Promise<Uint8Array> {
  const k = await nuevo('Recibo de energía eléctrica — ejemplo');
  const p = k.pdf.addPage([612, 792]);
  caja(p, 36, 716, 540, 40, { fill: TEAL });
  T(p, k, 'RECIBO DE ENERGÍA ELÉCTRICA · EJEMPLO ILUSTRATIVO', 48, 732, 12, { neg: true, color: rgb(1, 1, 1) });
  T(p, k, 'Sin logotipos ni datos oficiales', 48, 721, 7.5, { color: rgb(0.85, 0.93, 0.93) });
  T(p, k, TITULAR_DEMO.nombre.toUpperCase(), 40, 690, 11, { neg: true });
  T(p, k, DOMICILIO_DEMO.calle + ' ' + DOMICILIO_DEMO.numExt + ', ' + DOMICILIO_DEMO.colonia, 40, 675, 9);
  T(p, k, 'C.P. ' + DOMICILIO_DEMO.cp + ' · ' + DOMICILIO_DEMO.municipio + ', ' + DOMICILIO_DEMO.estado, 40, 663, 9);
  caja(p, 340, 640, 236, 62, { fill: rgb(0.94, 0.96, 0.97) });
  T(p, k, 'TOTAL A PAGAR', 350, 686, 8, { neg: true, color: SUAVE }); T(p, k, SERVICIO_DEMO.total, 350, 662, 20, { neg: true });
  caja(p, 36, 590, 540, 40, { borde: GRIS });
  [['NO. DE SERVICIO (ficticio)', SERVICIO_DEMO.numero], ['TARIFA', SERVICIO_DEMO.tarifa], ['PERIODO FACTURADO', SERVICIO_DEMO.periodo], ['FECHA LÍMITE DE PAGO', SERVICIO_DEMO.limitePago]]
    .forEach(([a, b], i) => { T(p, k, a!, 44 + i * 135, 616, 6.5, { neg: true, color: SUAVE }); T(p, k, b!, 44 + i * 135, 600, 8.5, { neg: true, max: 128 }); });
  T(p, k, `CARGA CONECTADA kW: ${SERVICIO_DEMO.cargaKw}`, 44, 570, 9, { neg: true }); T(p, k, `DEMANDA CONTRATADA kW: ${SERVICIO_DEMO.demandaKw}`, 250, 570, 9, { neg: true });
  caja(p, 36, 440, 540, 110, { fill: rgb(0.96, 0.98, 0.98), borde: GRIS }); T(p, k, 'Consumo del periodo: ' + SERVICIO_DEMO.consumoKwh + ' kWh (ficticio)', 48, 530, 10, { neg: true });
  [['Base', 4290], ['Intermedia', 3530], ['Punta', 1200]].forEach(([n, v], i) => { const w = (Number(v) / 4290) * 300; p.drawRectangle({ x: 120, y: 502 - i * 24, width: w, height: 12, color: i === 0 ? TEAL : AMBAR }); T(p, k, String(n), 48, 504 - i * 24, 9); T(p, k, String(v) + ' kWh', 130 + w, 504 - i * 24, 8.5, { color: SUAVE }); });
  caja(p, 36, 392, 540, 24, { fill: TEAL }); ['Concepto', 'Lectura actual', 'Lectura anterior', 'Total'].forEach((c, i) => T(p, k, c, 44 + i * 135, 400, 8.5, { neg: true, color: rgb(1, 1, 1) }));
  [['kWh base', '24,120', '19,830', '4,290'], ['kWh intermedia', '31,540', '28,010', '3,530'], ['kWh punta', '8,210', '8,530', '(demo)'], ['kW', '34', '0', '34']]
    .forEach((f, r) => { const yy = 392 - (r + 1) * 22; caja(p, 36, yy, 540, 22, { borde: GRIS }); f.forEach((c, i) => T(p, k, c, 44 + i * 135, yy + 7, 8.5)); });
  caja(p, 36, 250, 540, 24, { fill: rgb(0.93, 0.94, 0.95) }); T(p, k, 'Desglose del importe a pagar (ilustrativo)', 44, 258, 9, { neg: true });
  [['Suministro', '$ 208.18'], ['Distribución', '$ 1,716.09'], ['Energía', '$ 14,840.20'], ['IVA 16 %', '$ 1,655.53'], ['Total', SERVICIO_DEMO.total]]
    .forEach(([a, b], i) => { const yy = 250 - (i + 1) * 22; caja(p, 36, yy, 540, 22, { borde: GRIS }); T(p, k, a!, 44, yy + 7, 9, { neg: i === 4 }); T(p, k, b!, 480, yy + 7, 9, { neg: i === 4 }); });
  barras(p, 40, 70, 200, 28, 99); T(p, k, 'Código de barras ilustrativo (no funcional)', 40, 58, 7, { color: SUAVE });
  marca(p, k);
  const q = k.pdf.addPage([612, 792]);
  T(q, k, 'Consumo histórico (kWh) — ilustrativo', 44, 730, 12, { neg: true });
  const meses = ['oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'];
  const vals = [7144, 6450, 3989, 3699, 4417, 4852, 6837, 8845, 9100, 9400, 9300, 7500];
  vals.forEach((v, i) => { const hh = (v / 10000) * 260; q.drawRectangle({ x: 54 + i * 42, y: 420, width: 28, height: hh, color: i === 11 ? TEAL : rgb(0.6, 0.7, 0.75) }); T(q, k, meses[i]!, 60 + i * 42, 406, 8, { color: SUAVE }); T(q, k, String(v), 50 + i * 42, 424 + hh, 6.5, { color: SUAVE }); });
  T(q, k, 'Datos ficticios para la demostración. No corresponden a un servicio real.', 44, 360, 9, { color: SUAVE });
  marca(q, k);
  return k.pdf.save();
}

// ─────────────── Carta poder: la genera el generador REAL del portal y se le añaden firmas ilustrativas ───────────────
const PARTICIPANTES = {
  version: 1, confirmado: true,
  datos: { tipoTitular: 'fisica' as const, titular: TITULAR_DEMO.nombre, tramita: 'apoderado' as const, apoderado: REPRESENTANTE_DEMO.nombre, representante: '', testigos: [TESTIGOS_DEMO[0].nombre, TESTIGOS_DEMO[1].nombre] },
};
async function cartaPoder(folio: string, diasAtras: number, firmasTestigo2: boolean): Promise<Uint8Array> {
  const r = await generarCartaDemo({ folio, nombre: PROYECTO_DEMO.nombre, municipio: PROYECTO_DEMO.municipio }, PARTICIPANTES, Date.parse(diaDemo(-diasAtras, 11)));
  const pdf = await PDFDocument.load(r.bytes);
  const k: Kit = { pdf, reg: await pdf.embedFont(StandardFonts.Helvetica), neg: await pdf.embedFont(StandardFonts.HelveticaBold), ser: await pdf.embedFont(StandardFonts.TimesRomanBold) };
  const p = pdf.getPage(0);
  // Posiciones de las líneas de firma del generador: (65, 315), (327, 315), (65, 189), (327, 189), ancho 220.
  const posiciones: [number, number][] = [[65, 315], [327, 315], [65, 189], [327, 189]];
  posiciones.forEach(([x, y], i) => { if (i === 3 && !firmasTestigo2) return; firmar(p, i, x + 40, y + 3, 0.58); });
  p.drawText('Impresa, firmada y cargada de nuevo al portal (ejemplo ilustrativo)', { x: 65, y: 40, size: 7.5, font: k.reg, color: SUAVE });
  marca(p, k, 'DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL');
  return pdf.save();
}

// ─────────────── Solicitud: plantilla real + datos fijos (+ firma ilustrativa del solicitante en la copia firmada) ───────────────
async function solicitud(firmada: boolean): Promise<Uint8Array> {
  const plantilla = new Uint8Array(readFileSync(join(process.cwd(), 'public', 'guias', 'solicitud-interconexion-formato.pdf')));
  const datos = solicitudInicial({ titular: TITULAR_DEMO.nombre, contacto: REPRESENTANTE_DEMO.nombre, puesto: 'Apoderada' }, new Date(diaDemo(-9)));
  const base = await generarSolicitudDemo(datos, plantilla);
  if (!firmada) return base;
  const pdf = await PDFDocument.load(base);
  const k: Kit = { pdf, reg: await pdf.embedFont(StandardFonts.Helvetica), neg: await pdf.embedFont(StandardFonts.HelveticaBold), ser: await pdf.embedFont(StandardFonts.TimesRomanBold) };
  const p = pdf.getPage(0);
  firmar(p, 1, 92, 112, 0.85);
  T(p, k, TITULAR_DEMO.nombre, 125, 97, 8.5); T(p, k, 'Titular', 125, 86, 8.5); T(p, k, fechaCortaDemo(diaDemo(-7)), 125, 75, 8.5);
  return pdf.save();
}

// ─────────────── Documentos técnicos de IDC (versiones de demostración) ───────────────
async function croquis(): Promise<Uint8Array> {
  const k = await nuevo('Croquis de ubicación — demostración');
  const p = k.pdf.addPage([792, 612]);
  T(p, k, 'CROQUIS DE UBICACIÓN', 40, 570, 20, { neg: true }); T(p, k, `Sistema fotovoltaico de ${PROYECTO_DEMO.capacidadKw} kW · ${PROYECTO_DEMO.municipio}, Sonora · versión de demostración`, 40, 552, 10, { color: SUAVE });
  caja(p, 40, 90, 520, 440, { fill: rgb(0.99, 0.98, 0.95), borde: SUAVE });
  for (const [x, y, w, h] of [[60, 380, 150, 130], [250, 380, 140, 130], [430, 380, 110, 130], [60, 120, 150, 130], [430, 120, 110, 130]] as number[][]) caja(p, x!, y!, w!, h!, { fill: rgb(0.95, 0.94, 0.9), borde: GRIS });
  caja(p, 250, 120, 140, 130, { fill: rgb(0.8, 0.88, 0.85), borde: TEAL, grosor: 1.4 });
  p.drawRectangle({ x: 40, y: 290, width: 520, height: 70, color: rgb(0.9, 0.92, 0.93) }); p.drawRectangle({ x: 218, y: 90, width: 24, height: 440, color: rgb(0.9, 0.92, 0.93) }); p.drawRectangle({ x: 398, y: 90, width: 24, height: 440, color: rgb(0.9, 0.92, 0.93) });
  T(p, k, 'Blvd. Ejemplo', 260, 320, 11, { neg: true }); T(p, k, 'Calle Poniente (ej.)', 195, 200, 9, { color: SUAVE });
  p.drawCircle({ x: 320, y: 190, size: 11, color: TEAL }); T(p, k, 'Instalación FV', 280, 150, 9, { neg: true });
  T(p, k, 'Ref.: Plaza Ejemplo', 440, 440, 8, { color: SUAVE }); T(p, k, 'Ref.: Escuela Ejemplo', 70, 440, 8, { color: SUAVE });
  p.drawSvgPath('M0 0 L12 34 L0 26 L-12 34 Z', { x: 520, y: 520, borderColor: NAVY, borderWidth: 1.4 }); T(p, k, 'N', 515, 524, 11, { neg: true });
  caja(p, 580, 90, 172, 440, { fill: rgb(1, 1, 1), borde: GRIS });
  [['PROYECTO', 'Central FV distribuida'], ['Capacidad', `${PROYECTO_DEMO.capacidadKw} kW`], ['Titular', TITULAR_DEMO.nombre], ['Domicilio', DOMICILIO_DEMO.texto], ['No. de servicio', SERVICIO_DEMO.numero + ' (ficticio)'], ['Orientación', 'Norte hacia arriba'], ['Escala', 'Sin escala'], ['Elaboró', 'IDC (ejemplo)'], ['Fecha', fechaCortaDemo(diaDemo(-15))]]
    .forEach(([a, b], i) => { T(p, k, a!, 590, 505 - i * 46, 7, { neg: true, color: SUAVE }); T(p, k, b!, 590, 493 - i * 46, 8.5, { max: 155 }); });
  marca(p, k);
  return k.pdf.save();
}
async function unifilar(): Promise<Uint8Array> {
  const k = await nuevo('Diagrama unifilar — demostración');
  const p = k.pdf.addPage([792, 612]);
  T(p, k, 'DIAGRAMA UNIFILAR (ILUSTRATIVO)', 40, 570, 18, { neg: true }); T(p, k, `Sistema FV ${PROYECTO_DEMO.capacidadKw} kW · ${PROYECTO_DEMO.paneles} · titular: ${TITULAR_DEMO.nombre}`, 40, 550, 9.5, { color: SUAVE });
  const bloques: [string, string, number][] = [['Campo FV', PROYECTO_DEMO.paneles, 40], ['Inversores', '40 kW AC total', 175], ['Protección I1', 'Interruptor (ej.)', 310], ['Tablero / carga', 'Instalación del cliente', 445], ['Medidor', 'Bidireccional', 580]];
  bloques.forEach(([a, b, x], i) => { caja(p, x, 360, 120, 70, { fill: i === 0 ? rgb(0.96, 0.87, 0.68) : rgb(0.85, 0.92, 0.9), borde: NAVY, grosor: 1.2 }); T(p, k, a, x + 8, 410, 10, { neg: true, max: 105 }); T(p, k, b, x + 8, 392, 8, { color: SUAVE, max: 105 }); if (i < 4) p.drawLine({ start: { x: x + 120, y: 395 }, end: { x: x + 135, y: 395 }, thickness: 1.6, color: NAVY }); });
  p.drawLine({ start: { x: 640, y: 360 }, end: { x: 640, y: 300 }, thickness: 1.6, color: NAVY }); caja(p, 580, 240, 120, 60, { fill: rgb(0.88, 0.91, 0.93), borde: NAVY, grosor: 1.2 }); T(p, k, 'Red de distribución', 590, 266, 10, { neg: true });
  T(p, k, 'Esquema ilustrativo: no es un diseño real ni sustituye al proyecto firmado por el responsable.', 40, 200, 9.5, { color: SUAVE });
  marca(p, k);
  return k.pdf.save();
}
async function fichas(): Promise<Uint8Array> {
  const k = await nuevo('Fichas técnicas — demostración');
  for (const [titulo, filas] of [
    ['MÓDULO FOTOVOLTAICO · FICHA DE EJEMPLO', [['Marca / modelo', 'SolarDemo SD-625 (ficticio)'], ['Potencia máxima (Pmax)', '625 W'], ['Tensión a Pmax (Vmp)', '41.0 V'], ['Tensión de circuito abierto (Voc)', '48.2 V'], ['Corriente de cortocircuito (Isc)', '16.1 A'], ['Eficiencia', '22.8 %'], ['Dimensiones', '2382 × 1134 × 30 mm'], ['Unidades en el proyecto', '64']]],
    ['INVERSOR · FICHA DE EJEMPLO', [['Marca / modelo', 'InverDemo ID-10K (ficticio)'], ['Potencia nominal de salida', '10 kW'], ['Cantidad en el proyecto', '4 (40 kW AC total)'], ['Tensión nominal de salida', '220/240 V'], ['Rango MPPT', '40 – 560 V'], ['Eficiencia máxima', '97.9 %'], ['Grado de protección', 'IP66'], ['Comunicación', 'WLAN / RS485']]],
  ] as [string, string[][]][]) {
    const p = k.pdf.addPage([612, 792]);
    caja(p, 0, 700, 612, 92, { fill: NAVY }); T(p, k, titulo, 40, 745, 16, { neg: true, color: rgb(1, 1, 1) }); T(p, k, 'Datos ficticios: no son especificaciones de un fabricante real.', 40, 725, 9, { color: AMBAR });
    filas.forEach(([a, b], i) => { const y = 650 - i * 36; caja(p, 40, y, 532, 36, { borde: GRIS }); T(p, k, a!, 52, y + 13, 10, { neg: true }); T(p, k, b!, 300, y + 13, 10); });
    marca(p, k);
  }
  return k.pdf.save();
}
async function certificados(): Promise<Uint8Array> {
  const k = await nuevo('Certificados — demostración');
  for (const equipo of ['MÓDULOS FOTOVOLTAICOS', 'INVERSORES']) {
    const p = k.pdf.addPage([612, 792]);
    caja(p, 36, 36, 540, 720, { borde: AMBAR, grosor: 2 });
    T(p, k, 'CERTIFICADO DE CUMPLIMIENTO', 120, 690, 22, { ser: true, color: NAVY }); T(p, k, '(ejemplo ilustrativo de demostración)', 190, 668, 10, { color: SUAVE });
    T(p, k, `Equipo: ${equipo}`, 70, 600, 13, { neg: true }); T(p, k, `Emitido a: fabricante de ejemplo para el proyecto de ${TITULAR_DEMO.nombre}`, 70, 574, 10, { max: 460 });
    T(p, k, 'Este archivo reproduce únicamente la idea de un certificado de seguridad de equipos.', 70, 540, 10, { color: SUAVE });
    T(p, k, 'No está emitido por ninguna entidad certificadora ni acredita el cumplimiento de norma alguna.', 70, 524, 10, { color: SUAVE });
    p.drawCircle({ x: 306, y: 380, size: 50, borderColor: TEAL, borderWidth: 2 }); T(p, k, 'DEMO', 280, 372, 22, { neg: true, color: TEAL });
    marca(p, k);
  }
  return k.pdf.save();
}
async function fotos(): Promise<Uint8Array> {
  const k = await nuevo('Fotografías del sistema — demostración');
  const p = k.pdf.addPage([612, 792]);
  T(p, k, 'FOTOGRAFÍAS DEL SISTEMA FUNCIONANDO (ILUSTRATIVAS)', 40, 750, 14, { neg: true });
  const marcos = ['Módulos instalados', 'Inversor', 'Tablero de protecciones', 'Medidor', 'Vista general del arreglo', 'Placa del inversor'];
  marcos.forEach((m, i) => {
    const x = 40 + (i % 2) * 275, y = 520 - Math.floor(i / 2) * 235;
    caja(p, x, y, 257, 195, { fill: rgb(0.86, 0.93, 0.97), borde: SUAVE }); p.drawCircle({ x: x + 215, y: y + 160, size: 14, color: AMBAR });
    if (i === 0 || i === 4) { for (let j = 0; j < 4; j++) p.drawSvgPath('M0 0 L55 0 L45 -30 L-10 -30 Z', { x: x + 25 + j * 55, y: y + 100, color: TEAL, borderColor: NAVY, borderWidth: 1 }); }
    else if (i === 1) { caja(p, x + 80, y + 50, 96, 90, { fill: rgb(0.97, 0.97, 0.98), borde: NAVY }); p.drawCircle({ x: x + 100, y: y + 120, size: 4, color: TEAL }); }
    else if (i === 2) { for (let j = 0; j < 6; j++) caja(p, x + 55 + j * 24, y + 70, 16, 56, { fill: rgb(0.97, 0.97, 0.98), borde: NAVY }); }
    else if (i === 3) { p.drawCircle({ x: x + 128, y: y + 95, size: 45, color: rgb(0.97, 0.97, 0.98), borderColor: NAVY, borderWidth: 1.4 }); T(p, k, '000417', x + 100, y + 90, 12, { neg: true }); }
    else { caja(p, x + 60, y + 60, 136, 76, { fill: rgb(0.97, 0.97, 0.98), borde: NAVY }); for (let j = 0; j < 4; j++) p.drawLine({ start: { x: x + 72, y: y + 120 - j * 16 }, end: { x: x + 184, y: y + 120 - j * 16 }, thickness: 1.2, color: GRIS }); }
    T(p, k, `${i + 1}. ${m}`, x + 6, y - 14, 9, { neg: true }); T(p, k, 'Ilustración, no es una fotografía real.', x + 6, y + 6, 7, { color: SUAVE });
  });
  marca(p, k);
  return k.pdf.save();
}
async function dictamen(): Promise<Uint8Array> {
  const k = await nuevo('Dictamen de verificación — ejemplo');
  const p = k.pdf.addPage([612, 792]);
  T(p, k, 'DICTAMEN DE VERIFICACIÓN DE INSTALACIONES ELÉCTRICAS', 60, 740, 13, { neg: true }); T(p, k, 'EJEMPLO FICTICIO · emitido por una unidad de verificación de demostración · gestionado por IDC', 60, 722, 8.5, { color: rgb(0.7, 0.2, 0.15) });
  const filas: [string, string][] = [['Folio del dictamen', 'DEMO-UVIE-0001'], ['Fecha', fechaCortaDemo(diaDemo(-4))], ['Solicitante', TITULAR_DEMO.nombre], ['Domicilio de la instalación', DOMICILIO_DEMO.texto], ['No. de servicio', SERVICIO_DEMO.numero + ' (ficticio)'], ['Instalación', `Sistema fotovoltaico de ${PROYECTO_DEMO.capacidadKw} kW · ${PROYECTO_DEMO.paneles}`], ['Tensión de suministro', 'Media tensión'], ['Resultado de la verificación', 'CUMPLE (resultado ficticio)'], ['Unidad de verificación', 'Unidad de ejemplo, S.A. (ficticia)'], ['Verificador', 'Nombre ficticio · registro DEMO-000']];
  filas.forEach(([a, b], i) => { const y = 680 - i * 40; caja(p, 50, y, 512, 40, { borde: GRIS }); T(p, k, a, 60, y + 24, 8, { neg: true, color: SUAVE }); T(p, k, b, 60, y + 10, 10, { neg: true, max: 490 }); });
  T(p, k, 'Este documento no es un dictamen real ni fue emitido por una unidad de verificación.', 60, 230, 9, { color: SUAVE });
  marca(p, k);
  return k.pdf.save();
}

// ─────────────── Documentos del trámite ante CFE (demostración) ───────────────
async function hojaCfe(titulo: string, subtitulo: string, parrafos: string[], opts: { firmas?: boolean; sello?: string } = {}): Promise<Uint8Array> {
  const k = await nuevo(titulo);
  const p = k.pdf.addPage([612, 792]);
  caja(p, 0, 700, 612, 92, { fill: NAVY }); T(p, k, 'KairóVolt', 40, 748, 22, { ser: true, color: rgb(1, 1, 1) }); T(p, k, 'DEMOSTRACIÓN — SIN VALIDEZ LEGAL', 40, 722, 10, { neg: true, color: AMBAR });
  p.drawCircle({ x: 560, y: 746, size: 22, color: AMBAR });
  T(p, k, titulo, 40, 660, 18, { ser: true, color: NAVY, max: 530 }); T(p, k, subtitulo, 40, 636, 10, { neg: true, color: TEAL, max: 530 });
  let y = 600;
  for (const par of parrafos) { const l = par.length / 92 + 1; T(p, k, par, 40, y, 10.5, { max: 530 }); y -= 18 * Math.ceil(l) + 6; }
  if (opts.firmas) {
    caja(p, 40, 150, 240, 80, { borde: GRIS }); caja(p, 330, 150, 240, 80, { borde: GRIS });
    firmar(p, 0, 70, 168, 0.9); firmar(p, 2, 360, 168, 0.9);
    T(p, k, TITULAR_DEMO.nombre, 46, 136, 8.5, { max: 230 }); T(p, k, 'Representante de la contraparte (ficticio)', 336, 136, 8.5, { max: 230 });
    T(p, k, 'Firmas manuscritas ilustrativas: no es una firma electrónica certificada.', 40, 110, 8, { color: SUAVE });
  }
  if (opts.sello) T(p, k, opts.sello, 40, 70, 9, { neg: true, color: TEAL });
  marca(p, k);
  return k.pdf.save();
}
const datosTitular = [`Titular: ${TITULAR_DEMO.nombre} · RFC (ficticio) ${TITULAR_DEMO.rfc}`, `Domicilio del servicio: ${DOMICILIO_DEMO.texto}`, `Número de servicio (ficticio): ${SERVICIO_DEMO.numero} · Central FV de ${PROYECTO_DEMO.capacidadKw} kW`];

async function main() {
  console.log('Generando documentos de demostración en public/demo/documentos …');
  salvar('cliente/identificacion-titular.pdf', await identificacion(TITULAR_DEMO.nombre, TITULAR_DEMO.claveElector, TITULAR_DEMO.nacimiento, 'titular', 3));
  salvar('cliente/identificacion-representante.pdf', await identificacion(REPRESENTANTE_DEMO.nombre, REPRESENTANTE_DEMO.claveElector, REPRESENTANTE_DEMO.nacimiento, 'representante', 7));
  salvar('cliente/identificacion-testigo-1.pdf', await identificacion(TESTIGOS_DEMO[0].nombre, TESTIGOS_DEMO[0].claveElector, TESTIGOS_DEMO[0].nacimiento, 'testigo 1', 13));
  salvar('cliente/identificacion-testigo-2.pdf', await identificacion(TESTIGOS_DEMO[1].nombre, TESTIGOS_DEMO[1].claveElector, TESTIGOS_DEMO[1].nacimiento, 'testigo 2', 17));
  salvar('cliente/constancia-situacion-fiscal.pdf', await constancia());
  salvar('cliente/recibo-cfe.pdf', await recibo());
  for (const [folio, atras, incompleta] of [['KV-2026-005', 4, true], ['KV-2026-006', 13, true], ['KV-2026-007', 13, false], ['KV-2026-008', 13, false], ['KV-2026-009', 13, false]] as [string, number, boolean][]) {
    salvar(`cliente/carta-poder/${folio}-firmada.pdf`, await cartaPoder(folio, atras, true));
    if (incompleta) salvar(`cliente/carta-poder/${folio}-sin-firma-testigo-2.pdf`, await cartaPoder(folio, atras, false));
  }
  salvar('idc/solicitud-prellenada.pdf', await solicitud(false));
  salvar('cliente/solicitud-firmada.pdf', await solicitud(true));
  salvar('idc/documentos-tecnicos/croquis.pdf', await croquis());
  salvar('idc/documentos-tecnicos/diagrama-unifilar.pdf', await unifilar());
  salvar('idc/documentos-tecnicos/fichas-tecnicas.pdf', await fichas());
  salvar('idc/documentos-tecnicos/certificados.pdf', await certificados());
  salvar('idc/documentos-tecnicos/fotografias-sistema.pdf', await fotos());
  salvar('idc/documentos-tecnicos/dictamen-uvie.pdf', await dictamen());

  salvar('cfe/acuse-ingreso.pdf', await hojaCfe('Acuse de ingreso del expediente (demostración)', 'Constancia ilustrativa de que IDC ingresó el expediente', [
    ...datosTitular, `Fecha de ingreso: ${fechaLargaDemo(diaDemo(-25, 12))}`, `Número de solicitud registrado (ficticio): ${ESCENARIO.numeroSolicitud} · ${fechaLargaDemo(diaDemo(-24, 9))}`,
    'Este acuse es un ejemplo creado para la demostración. No fue emitido por CFE.'], { sello: 'Responsable del ingreso: IDC Sistemas Eléctricos' }));
  salvar('cfe/resolucion-favorable.pdf', await hojaCfe('Oficio resolutivo favorable (demostración)', 'Ejemplo ilustrativo — no es una resolución auténtica', [
    ...datosTitular, `Número de solicitud (ficticio): ${ESCENARIO.numeroSolicitud}`, `Fecha de la resolución (ficticia): ${fechaLargaDemo(diaDemo(-17, 11))}`,
    'Sentido de la resolución: FAVORABLE (escenario sin estudio de red ni obra adicional).', 'Este archivo reproduce la idea de un oficio de resolución para fines de demostración. No tiene validez ante CFE ni ante ninguna autoridad.']));
  for (const [clave, nombre, parte, resumen] of [
    ['interconexion', 'Contrato de interconexión', 'CFE Distribución', 'Formaliza las condiciones de interconexión de la central fotovoltaica con la red de distribución.'],
    ['contraprestacion', 'Contrato de contraprestación', 'CFE Suministrador', `Establece el esquema con el que se contabiliza o remunera la energía entregada a la red. Esquema del escenario: ${ESCENARIO.esquema}.`],
  ] as const) {
    for (const firmado of [false, true]) {
      salvar(`cfe/${nombre.toLowerCase().replace(/ /g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '')}${firmado ? '-formalizado' : ''}.pdf`, await hojaCfe(`${nombre} (demostración)`, `${firmado ? 'Versión formalizada' : 'Versión para revisión y firma'} · contraparte: ${parte}`, [
        ...datosTitular, resumen, `Fecha de preparación: ${fechaLargaDemo(diaDemo(-16))}`,
        firmado ? `Formalizado el ${fechaLargaDemo(diaDemo(-9, 11))} (firma manuscrita ilustrativa).` : 'Revisa los datos, imprime el contrato y fírmalo en la formalización coordinada. Esta confirmación no es una firma electrónica.',
        'Cláusulas no incluidas: contenido ilustrativo sin validez legal. KairóVolt e IDC no sustituyen a CFE en la formalización.'], { firmas: firmado }));
    }
  }
  console.log('Listo.');
}
void main();
