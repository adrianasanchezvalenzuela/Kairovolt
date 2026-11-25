import type { EstadoIntegracionAdmin, IntegracionAdminRepositorio, RegistroSincronizacion, ResultadoSimulacion } from '@/application/integracion-admin';
import { api } from './http';

const texto = (d: Record<string, unknown>, status: number) =>
  status === 401 ? 'La sesión expiró. Vuelve a iniciar sesión.' : status === 403 ? 'Tu rol no puede consultar la integración.' : (typeof d.detalle === 'string' ? d.detalle : typeof d.error === 'string' ? d.error : `El backend respondió ${status}.`);

export const integracionAdminHttp: IntegracionAdminRepositorio = {
  async estado() {
    const { status, data } = await api('GET', '/api/admin/integracion/estado');
    if (status !== 200) throw new Error(texto(data, status));
    return data as unknown as EstadoIntegracionAdmin;
  },
  async registro(folio) {
    const { status, data } = await api('GET', `/api/admin/integracion/registro${folio ? `?folio=${encodeURIComponent(folio)}` : ''}`);
    if (status !== 200) throw new Error(texto(data, status));
    return (data.registros ?? []) as RegistroSincronizacion[];
  },
  async simular(p) {
    // Siempre simula: la interfaz no escribe en Zoho desde esta pantalla.
    const { status, data } = await api('POST', '/api/admin/integracion/sincronizar-proyecto', { ...p, simular: true });
    if (status !== 200) throw new Error(texto(data, status));
    return data as unknown as ResultadoSimulacion;
  },
};
