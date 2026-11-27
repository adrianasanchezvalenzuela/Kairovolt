import { describe, expect, it } from 'vitest';
import {
  accionesDemo, aplicarExpedienteDemo, COMENTARIO_CARTA_PODER, DOCUMENTOS_DEMO, elegibilidadConDemo, expedienteDemoCompleto,
  FOLIO_DEMO_ENTREGA, FOLIO_DEMO_PREPARACION, leerExpedienteDemo,
} from './expediente-demo';
import type { VistaPortal } from '../application/portal-cliente';

const vistaBase = (folio: string) => ({
  demo: true, folio, nombre: 'x', ubicacion: '', avance: { porcentaje: 0, exacto: false, reglas: [] }, etapas: [], etapaActual: null,
  siguientePaso: { titulo: '', detalle: '', responsable: 'cliente', fechaEstimada: null }, documentos: [], guiaDocumental: [],
  recepciones: [], notificaciones: [{ id: 'c1', tipo: 'cita', titulo: 'Cita', detalle: null, fecha: '2026-11-20T10:00:00Z', citaId: 'x' }], historial: [],
  permisos: { subirDocumentos: true },
}) as unknown as VistaPortal;
const elegibilidad = { permitida: true, etiquetaEstadoDocumental: 'ok', motivoBloqueo: null, documentosPendientes: [], totalObligatorios: 11, preparadosObligatorios: 11 };

describe('expediente demo compartido', () => {
  it('distribuye los 11 requisitos en 4 + 1 + 6', () => {
    const por = (g: string) => DOCUMENTOS_DEMO.filter((d) => d.grupo === g).map((d) => d.id);
    expect(DOCUMENTOS_DEMO).toHaveLength(11);
    expect(por('cliente')).toEqual(['identificacion_oficial', 'carta_poder', 'constancia_situacion_fiscal', 'recibo_cfe']);
    expect(por('conjunto')).toEqual(['solicitud']);
    expect(por('idc')).toEqual(['croquis', 'diagrama_unifilar', 'ficha_tecnica', 'certificado', 'evidencia_fotografica', 'dictamen_uvie']);
  });

  it('demo 2: carta poder por corregir con el comentario de IDC y expediente incompleto', () => {
    const e = leerExpedienteDemo(FOLIO_DEMO_PREPARACION);
    expect(e.docs.carta_poder?.estado).toBe('por_corregir');
    expect(e.docs.carta_poder?.observacion?.texto).toBe(COMENTARIO_CARTA_PODER);
    expect(e.docs.solicitud?.estado).toBe('lista_para_firmar');
    expect(expedienteDemoCompleto(e)).toBe(false);
    expect(elegibilidadConDemo(elegibilidad as never, FOLIO_DEMO_PREPARACION).permitida).toBe(false);
  });

  it('demo 3: los 11 están completos y la cita queda habilitada', () => {
    const e = leerExpedienteDemo(FOLIO_DEMO_ENTREGA);
    expect(expedienteDemoCompleto(e)).toBe(true);
    expect(elegibilidadConDemo(elegibilidad as never, FOLIO_DEMO_ENTREGA).permitida).toBe(true);
    const v = aplicarExpedienteDemo(vistaBase(FOLIO_DEMO_ENTREGA), e);
    expect(v.documentos).toHaveLength(11);
    expect(v.documentos?.every((d) => d.estado === 'prevalidado')).toBe(true);
    expect(v.notificaciones.some((n) => n.citaId)).toBe(true);
  });

  it('flujo de corrección: reenvío -> versión 2 -> IDC prevalida; avisos y correo simulados coherentes', () => {
    accionesDemo.reiniciar(FOLIO_DEMO_PREPARACION);
    accionesDemo.subirCliente(FOLIO_DEMO_PREPARACION, 'carta_poder', 'carta-corregida.pdf');
    let e = leerExpedienteDemo(FOLIO_DEMO_PREPARACION);
    expect(e.docs.carta_poder?.estado).toBe('en_revision');
    expect(e.docs.carta_poder?.versiones.map((v) => v.n)).toEqual([1, 2]);
    expect(e.docs.carta_poder?.observacion).toBeUndefined();
    accionesDemo.prevalidar(FOLIO_DEMO_PREPARACION, 'carta_poder');
    e = leerExpedienteDemo(FOLIO_DEMO_PREPARACION);
    expect(e.docs.carta_poder?.estado).toBe('prevalidado');
    expect(e.avisos[0]?.correo.para).toBe('cliente-demo@example.invalid');
    expect(e.avisos[0]?.correo.parrafos.join(' ')).toMatch(/no sustituye la entrega física/i);
    accionesDemo.reiniciar(FOLIO_DEMO_PREPARACION);
  });

  it('IDC carga un técnico y solo el cliente lo ve al marcarlo disponible; el cliente no puede subir técnicos', () => {
    accionesDemo.reiniciar(FOLIO_DEMO_PREPARACION);
    accionesDemo.cargarTecnico(FOLIO_DEMO_PREPARACION, 'certificado', 'certificados.pdf');
    let e = leerExpedienteDemo(FOLIO_DEMO_PREPARACION);
    expect(e.docs.certificado?.estado).toBe('en_revision_tecnica');
    accionesDemo.marcarDisponible(FOLIO_DEMO_PREPARACION, 'certificado');
    e = leerExpedienteDemo(FOLIO_DEMO_PREPARACION);
    expect(e.docs.certificado?.estado).toBe('disponible');
    const v = aplicarExpedienteDemo(vistaBase(FOLIO_DEMO_PREPARACION), e);
    expect(v.documentos?.find((d) => d.id === 'certificado')?.puedeSubir).toBe(false);
    expect(v.documentos?.find((d) => d.id === 'dictamen_uvie')?.puedeSubir).toBe(false);
    expect(v.documentos?.find((d) => d.id === 'solicitud')?.puedeSubir).toBe(true);
    accionesDemo.reiniciar(FOLIO_DEMO_PREPARACION);
  });
});
