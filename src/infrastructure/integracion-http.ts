import type { EstadoIntegracion, IntegracionRepositorio } from '@/application/integracion';

const NO_DISPONIBLE: EstadoIntegracion = { zoho: 'backend_no_disponible', detalle: 'No se pudo contactar al backend.' };
const VALIDOS = new Set(['no_configurado', 'conectado', 'error']);

/** Consulta el estado al backend (mismo origen vía proxy). El navegador no conoce credenciales de Zoho. */
export const integracionHttp: IntegracionRepositorio = {
  async consultarEstado() {
    try {
      const res = await fetch('/api/integracion/estado');
      if (!res.ok) return NO_DISPONIBLE;
      const data = (await res.json()) as Partial<EstadoIntegracion>;
      if (typeof data.zoho !== 'string' || !VALIDOS.has(data.zoho)) return NO_DISPONIBLE;
      return { zoho: data.zoho, detalle: String(data.detalle ?? '') };
    } catch {
      return NO_DISPONIBLE;
    }
  },
};
