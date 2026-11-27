import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { solicitudInicial } from '../data/solicitud-demo';
import { generarSolicitudDemo } from './solicitud-demo';

const plantilla = () => new Uint8Array(readFileSync('public/guias/solicitud-interconexion-formato.pdf'));

describe('solicitud de interconexión de demostración', () => {
  it('genera un PDF válido de una página con la marca de demostración', async () => {
    const bytes = await generarSolicitudDemo(solicitudInicial({}, new Date('2026-11-26T12:00:00Z')), plantilla());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getSubject()).toBe('KAIROVOLT-SOLICITUD-DEMO-SIN-VALIDEZ');
  });
  it('usa datos fijos: dos generaciones el mismo día producen los mismos datos', () => {
    const a = solicitudInicial({}, new Date('2026-11-26T12:00:00Z'));
    expect(solicitudInicial({}, new Date('2026-11-26T18:00:00Z'))).toEqual(a);
    expect(a.central.capacidadBruta).toBe('40');
  });
  it('toma titular y contacto de Mis datos y no inventa número de solicitud', () => {
    const d = solicitudInicial({ titular: 'Titular Prueba', contacto: 'Persona Contacto' });
    expect(d.solicitante.nombre).toBe('Titular Prueba');
    expect(d.contacto.nombre).toBe('Persona Contacto');
    expect(JSON.stringify(d)).not.toMatch(/numeroSolicitud|folioCfe|firma|sello/i);
  });
});
