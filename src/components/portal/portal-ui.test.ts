import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DocumentoSolicitado } from '@/application/portal-cliente';
import { errorDeRespuesta } from '@/infrastructure/portal-http';
import { AnilloAvance } from './AnilloAvance';
import { ESTADO_DOCUMENTO, REQUIERE_ACCION } from './estados';
import { SubirDocumento } from './SubirDocumento';

const doc = (extra: Partial<DocumentoSolicitado> = {}): DocumentoSolicitado => ({ id: 'carta_poder', nombre: 'Carta poder', etapa: 'G1', estado: 'pendiente', detalle: null, puedeSubir: true, vigencia: null, ...extra });
const html = (e: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(e);

describe('portal: componentes', () => {
  it('AnilloAvance: describe el porcentaje para lectores y lo limita a 0–100', () => {
    const s = html(h(AnilloAvance, { porcentaje: 54 }));
    expect(s).toContain('role="img"');
    expect(s).toContain('Avance del trámite: 54 por ciento');
    expect(s).toContain('54%');
    expect(html(h(AnilloAvance, { porcentaje: 140 }))).toContain('100 por ciento');
    expect(html(h(AnilloAvance, { porcentaje: -5 }))).toContain('0 por ciento');
    const mitad = html(h(AnilloAvance, { porcentaje: 50 }));
    const largo = 2 * Math.PI * 70;
    expect(mitad).toContain(`stroke-dashoffset="${largo / 2}"`);
  });

  it('SubirDocumento: botón grande etiquetado con el documento, formatos permitidos y ayuda', () => {
    const s = html(h(SubirDocumento, { documento: doc(), onSubir: async () => { throw new Error('no'); }, conservaArchivos: true }));
    expect(s).toContain('Subir archivo');
    expect(s).toContain('para Carta poder');
    expect(s).toMatch(/accept="\.pdf,\.jpg,\.jpeg,\.png,\.webp"/);
    expect(s).toContain('máximo 10 MB');
    expect(s).toContain('type="file"');
  });

  it('SubirDocumento: un documento rechazado o vencido invita a «Enviar de nuevo»', () => {
    for (const estado of ['rechazado', 'vencido'] as const) {
      expect(html(h(SubirDocumento, { documento: doc({ estado }), onSubir: async () => { throw new Error('no'); }, conservaArchivos: true }))).toContain('Enviar de nuevo');
    }
  });

  it('estados: lenguaje para el cliente; solo pendiente, rechazado y vencido requieren su acción', () => {
    expect(ESTADO_DOCUMENTO.pendiente.texto).toBe('Por entregar');
    expect(ESTADO_DOCUMENTO.en_revision.texto).toBe('Recibido · pendiente de revisión');
    expect(JSON.stringify(ESTADO_DOCUMENTO)).not.toMatch(/bloque|observaci|ReadyCheck/i);
    expect(ESTADO_DOCUMENTO.prevalidado.texto).toBe('Prevalidado por IDC');
    expect([...REQUIERE_ACCION].sort()).toEqual(['pendiente', 'rechazado', 'vencido']);
  });

  it('errores del backend: mensajes claros para el cliente, también sin cuerpo', () => {
    expect(errorDeRespuesta(401, { error: 'acceso_invalido', detalle: 'El folio o el código no son correctos.' })).toMatchObject({ codigo: 'acceso_invalido', message: 'El folio o el código no son correctos.' });
    expect(errorDeRespuesta(401, { error: 'sin_sesion' }).message).toContain('Vuelve a entrar');
    expect(errorDeRespuesta(413, {})).toMatchObject({ codigo: 'demasiado_grande' });
    expect(errorDeRespuesta(500, {}).message).toContain('500');
    expect(errorDeRespuesta(429, { error: 'demasiados_intentos', detalle: 'Espera un minuto.' }).codigo).toBe('demasiados_intentos');
  });
});
