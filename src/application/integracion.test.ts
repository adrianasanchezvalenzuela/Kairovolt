import { describe, expect, it } from 'vitest';
import { elegirFuente } from './integracion';

const sesion = (autenticado: boolean, adminHabilitado = true) => ({ autenticado, adminHabilitado });

describe('elegirFuente', () => {
  it('datos reales solo con Zoho conectado Y sesión iniciada', () => {
    expect(elegirFuente('conectado', sesion(true))).toEqual({ fuente: 'zoho', motivoMock: null });
  });
  it('Zoho conectado sin sesión: MOCK pidiendo login', () => {
    expect(elegirFuente('conectado', sesion(false))).toEqual({ fuente: 'mock', motivoMock: 'requiere_login' });
  });
  it('Zoho conectado pero sin ADMIN_TOKEN: MOCK explicando que el login está deshabilitado', () => {
    expect(elegirFuente('conectado', sesion(false, false))).toEqual({ fuente: 'mock', motivoMock: 'login_deshabilitado' });
  });
  it('sin credenciales, con error o sin backend: siempre MOCK, con su motivo', () => {
    expect(elegirFuente('no_configurado', sesion(false))).toMatchObject({ fuente: 'mock', motivoMock: 'sin_credenciales' });
    expect(elegirFuente('error', sesion(true))).toMatchObject({ fuente: 'mock', motivoMock: 'error_zoho' });
    expect(elegirFuente('backend_no_disponible', sesion(false, false))).toMatchObject({ fuente: 'mock', motivoMock: 'backend_no_disponible' });
  });
  it('una sesión iniciada no basta si Zoho no está conectado', () => {
    expect(elegirFuente('no_configurado', sesion(true)).fuente).toBe('mock');
  });
});
