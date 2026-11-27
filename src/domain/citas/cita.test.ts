import { describe, expect, it } from 'vitest';
import {
  construirChecklistVisita,
  construirIsoHermosillo,
  evaluarElegibilidadCita,
  generarICS,
  generarTextoChecklistVisita,
  seTraslapan,
  sumarMinutosHora,
  transicionValidaCliente,
  transicionValidaIDC,
  type CitaPortal,
} from './cita';
import type { DocumentoSolicitado, GuiaDocumentoCliente } from '../../application/portal-cliente';

const doc = (id: string, estado: DocumentoSolicitado['estado'], nombre = id): DocumentoSolicitado => ({
  id, nombre, etapa: 'G1', estado, detalle: null, puedeSubir: true, vigencia: null,
});

const guia = (id: string, extra: Partial<GuiaDocumentoCliente> = {}): GuiaDocumentoCliente => ({
  id, nombre: id, descripcion: null, etapa: 'G1', condicion: null, canal: 'digital', requiereVigencia: false,
  quienAporta: 'cliente', instrucciones: null, camposEsperados: [], ejemplosAutorizados: [], validacionIdc: 'validado',
  aplicabilidad: 'aplica', revisionDigital: 'opcional', ...extra,
});

describe('dominio de citas y visita', () => {
  it('bloquea entrega completa cuando hay pendientes, en revisión o correcciones', () => {
    const vista = {
      documentos: [
        doc('recibo_cfe', 'aceptado', 'Recibo CFE'),
        doc('carta_poder', 'rechazado', 'Carta Poder'),
        doc('identificacion_oficial', 'en_revision', 'Identificación oficial'),
        doc('croquis', 'pendiente', 'Croquis'),
      ],
      guiaDocumental: [guia('recibo_cfe'), guia('carta_poder'), guia('identificacion_oficial'), guia('croquis')],
    };
    const r = evaluarElegibilidadCita('entrega_expediente', vista, []);
    expect(r.permitida).toBe(false);
    expect(r.documentosPendientes).toHaveLength(3);
    expect(r.motivoBloqueo).toMatch(/1 corrección pendiente/);
    expect(r.motivoBloqueo).toMatch(/1 en revisión por IDC/);
    expect(r.motivoBloqueo).toMatch(/1 por preparar/);

    const aclaracion = evaluarElegibilidadCita('aclaracion_documental', vista, []);
    expect(aclaracion.permitida).toBe(true);
  });

  it('habilita entrega completa con todos los obligatorios prevalidados sin marcarlos físicamente entregados', () => {
    const vista = {
      documentos: [
        doc('recibo_cfe', 'prevalidado', 'Recibo CFE'),
        doc('carta_poder', 'prevalidado', 'Carta Poder'),
        doc('acta_constitutiva', 'no_aplica', 'Acta constitutiva'),
      ],
      guiaDocumental: [guia('recibo_cfe'), guia('carta_poder'), guia('acta_constitutiva', { aplicabilidad: 'no_aplica' })],
    };
    const r = evaluarElegibilidadCita('entrega_expediente', vista, []);
    expect(r.permitida).toBe(true);
    expect(r.etiquetaEstadoDocumental).toBe('Documentación preparada para entrega física');
    expect(r.totalObligatorios).toBe(2);
    expect(r.preparadosObligatorios).toBe(2);
  });

  it('construye checklist dinámico diferenciando física confirmada, por confirmar, ya entregado y solo digital', () => {
    const vista = {
      documentos: [
        doc('carta_poder', 'prevalidado', 'Carta Poder'),
        doc('recibo_cfe', 'prevalidado', 'Recibo CFE'),
        doc('ficha_tecnica', 'prevalidado', 'Fichas técnicas'),
        doc('solicitud', 'prevalidado', 'Solicitud'),
      ],
      guiaDocumental: [
        guia('carta_poder', { canal: 'fisico', requiereEntregaFisica: 'si', guiaPreparacion: { requiereFirmas: true, entrega: 'Llevar firmada.' } }),
        guia('recibo_cfe', { canal: 'digital', requiereEntregaFisica: 'por_confirmar' }),
        guia('ficha_tecnica', { canal: 'digital', requiereEntregaFisica: 'no' }),
        guia('solicitud', { canal: 'fisico', requiereEntregaFisica: 'si' }),
      ],
    };
    const items = construirChecklistVisita(vista, ['carta_poder'], ['solicitud']);
    expect(items.find((i) => i.documentoId === 'carta_poder')).toMatchObject({
      categoriaEntrega: 'fisica_confirmada', requiereFirmas: true, preparadoParaVisita: true, originalOCopia: null,
    });
    expect(items.find((i) => i.documentoId === 'recibo_cfe')).toMatchObject({
      categoriaEntrega: 'fisica_por_confirmar', preparadoParaVisita: false,
    });
    expect(items.find((i) => i.documentoId === 'ficha_tecnica')?.categoriaEntrega).toBe('solo_digital');
    expect(items.find((i) => i.documentoId === 'solicitud')?.categoriaEntrega).toBe('ya_entregado');

    const texto = generarTextoChecklistVisita('KV-2026-006', items);
    expect(texto).toContain('[x] Carta Poder (Requiere firmas)');
    expect(texto).toContain('TU CARPETA FÍSICA');
    expect(texto).not.toMatch(/RFC|INE|código de acceso/i);
  });

  it('detecta traslapes de intervalos semiabiertos correctamente', () => {
    const a0 = construirIsoHermosillo('2026-12-01', '09:00');
    const a1 = construirIsoHermosillo('2026-12-01', sumarMinutosHora('09:00', 45));
    const b0 = construirIsoHermosillo('2026-12-01', '09:45');
    const b1 = construirIsoHermosillo('2026-12-01', '10:30');
    const c0 = construirIsoHermosillo('2026-12-01', '09:30');
    const c1 = construirIsoHermosillo('2026-12-01', '10:15');
    expect(seTraslapan(a0, a1, b0, b1)).toBe(false);
    expect(seTraslapan(a0, a1, c0, c1)).toBe(true);
    expect(seTraslapan(a0, a1, a0, a1)).toBe(true);
  });

  it('protege las transiciones de estado para cliente e IDC y solo genera ICS para citas confirmadas', () => {
    const baseCita: CitaPortal = {
      id: 'c1', referencia: 'CITA-TEST0001', folio: 'KV-2026-006', tipoVisita: 'entrega_expediente',
      estado: 'solicitada', fecha: '2026-12-05', horaInicio: '10:00', horaFin: '10:45',
      inicioIso: construirIsoHermosillo('2026-12-05', '10:00'), finIso: construirIsoHermosillo('2026-12-05', '10:45'),
      zonaHoraria: 'America/Hermosillo', duracionMinutos: 45, ubicacionAutorizada: null, notasCliente: null,
      motivoCancelacion: null, propuestaFecha: null, propuestaHoraInicio: null, propuestaHoraFin: null,
      propuestaPor: null, propuestaNota: null, proveedorExterno: 'demo', referenciaExternaId: null,
      simulada: true, creadoEn: '2026-11-25T16:00:00.000Z', actualizadoEn: '2026-11-25T16:00:00.000Z', historial: [],
    };
    expect(generarICS(baseCita)).toBeNull();
    expect(transicionValidaIDC('solicitada', 'realizada').ok).toBe(false);
    expect(transicionValidaIDC('solicitada', 'confirmar')).toEqual({ ok: true, nuevoEstado: 'confirmada' });
    expect(transicionValidaIDC('confirmada', 'realizada')).toEqual({ ok: true, nuevoEstado: 'realizada' });

    const confirmada: CitaPortal = { ...baseCita, estado: 'confirmada' };
    const ics = generarICS(confirmada);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:KairóVolt | Entrega física del expediente (KV-2026-006)');
    expect(ics).not.toMatch(/DEMO-KV26/);

    const ahoraAntes = Date.parse(construirIsoHermosillo('2026-12-05', '09:00'));
    expect(transicionValidaCliente(confirmada, 'cancelar', ahoraAntes, 2).ok).toBe(false);
    const ahoraConTiempo = Date.parse(construirIsoHermosillo('2026-12-04', '10:00'));
    expect(transicionValidaCliente(confirmada, 'cancelar', ahoraConTiempo, 2).ok).toBe(true);
  });
});
