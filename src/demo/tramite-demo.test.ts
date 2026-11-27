import { describe, expect, it } from 'vitest';
import {
  accionesTramite, bloqueo, contratosFormalizados, FOLIO_APROBADA, FOLIO_CONCLUIDA, FOLIO_MEDIDOR, hitosTramite, leerTramite, progresoTramite,
} from './tramite-demo';

describe('trámite posterior (demos 4–6)', () => {
  it('demo 4: resolución favorable y contratos disponibles, sin instalación habilitada', () => {
    const t = leerTramite(FOLIO_APROBADA);
    expect(t.resolucion).toBeTruthy();
    expect(t.contratos.interconexion.estado).toBe('disponible');
    expect(contratosFormalizados(t)).toBe(false);
    expect(t.instalacion.estado).toBe('no_habilitada');
    expect(bloqueo.programar(t)).toMatch(/contratos/i);
  });
  it('demo 5: instalación programada el 10 de diciembre; el cliente no puede concluir el trámite', () => {
    accionesTramite.reiniciar(FOLIO_MEDIDOR);
    const t = leerTramite(FOLIO_MEDIDOR);
    expect(t.instalacion.estado).toBe('programada');
    expect(t.instalacion.programada).toEqual({ fecha: '2026-12-10', franja: '09:00 – 13:00' });
    expect(bloqueo.cerrar(t)).not.toBeNull();
  });
  it('instalar el medidor no cierra el trámite; el cierre exige las confirmaciones finales', () => {
    accionesTramite.reiniciar(FOLIO_MEDIDOR);
    accionesTramite.registrarInstalacion(FOLIO_MEDIDOR, '2026-12-10', 'MED-X');
    let t = leerTramite(FOLIO_MEDIDOR);
    expect(t.instalacion.estado).toBe('instalada');
    expect(t.cierre).toBeUndefined();
    accionesTramite.cerrar(FOLIO_MEDIDOR);
    expect(leerTramite(FOLIO_MEDIDOR).cierre).toBeUndefined();
    accionesTramite.confirmarFisica(FOLIO_MEDIDOR); accionesTramite.confirmarComercial(FOLIO_MEDIDOR); accionesTramite.cerrar(FOLIO_MEDIDOR);
    t = leerTramite(FOLIO_MEDIDOR);
    expect(t.cierre).toBeTruthy();
    accionesTramite.reiniciar(FOLIO_MEDIDOR);
  });
  it('la reprogramación sin nueva fecha no inventa una fecha confirmada', () => {
    accionesTramite.reiniciar(FOLIO_MEDIDOR);
    accionesTramite.reprogramarInstalacion(FOLIO_MEDIDOR, null, 'Motivo ficticio');
    const i = leerTramite(FOLIO_MEDIDOR).instalacion;
    expect(i.estado).toBe('pendiente_nueva_fecha');
    expect(i.programada).toBeUndefined();
    expect(i.anterior?.fecha).toBe('2026-12-10');
    accionesTramite.reiniciar(FOLIO_MEDIDOR);
  });
  it('el progreso sale de hitos completados: demo 6 al 100 %, demo 4 menor', () => {
    const p6 = progresoTramite(hitosTramite(leerTramite(FOLIO_CONCLUIDA), FOLIO_CONCLUIDA));
    const p4 = progresoTramite(hitosTramite(leerTramite(FOLIO_APROBADA), FOLIO_APROBADA));
    expect(p6.pct).toBe(100);
    expect(p4.pct).toBeLessThan(60);
  });
});
