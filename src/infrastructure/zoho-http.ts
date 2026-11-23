import type { EstadoSesion, ResultadoInicioSesion, SesionRepositorio, UsuarioSesion } from '@/application/integracion';
import type { ProyectoRepositorio } from '@/application/proyecto-repositorio';
import {
  ErrorSincronizacion, type CambioCompuerta, type EnvioObservacion, type ResultadoSincronizacion, type SincronizacionRepositorio,
} from '@/application/sincronizacion';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { api } from './http';

const textoError = (data: Record<string, unknown>, status: number): string => {
  const detalle = typeof data.detalle === 'string' ? data.detalle : undefined;
  const error = typeof data.error === 'string' ? data.error : undefined;
  if (status === 401) return 'La sesión expiró. Vuelve a iniciar sesión.';
  return detalle ?? error ?? `El backend respondió ${status}.`;
};

async function proyectos(folio?: string): Promise<Proyecto[]> {
  const { status, data } = await api('GET', `/api/admin/kv/proyectos${folio ? `?folio=${encodeURIComponent(folio)}` : ''}`);
  if (status !== 200) throw new Error(textoError(data, status));
  return data.proyectos as Proyecto[];
}

/** Proyectos reales de Zoho (vía backend). Requiere sesión iniciada. */
export const proyectoRepositorioZoho: ProyectoRepositorio = {
  origen: 'zoho',
  listar: () => proyectos(),
  obtenerPorId: async (id) => (await proyectos(id))[0] ?? null,
  obtenerPorFolio: async (folio) => (await proyectos(folio))[0] ?? null,
};

const SIN_SESION: EstadoSesion = { loginHabilitado: false, metodos: { token: false, correo: false }, autenticado: false, usuario: null };

async function iniciar(cuerpo: unknown): Promise<ResultadoInicioSesion> {
  try {
    const { status, data } = await api('POST', '/api/sesion', cuerpo);
    if (status === 200) return 'ok';
    if (status === 429) return 'demasiados_intentos';
    if (status === 404) return 'deshabilitado';
    if (status === 503) return 'no_disponible';
    if (status === 403 && data.error === 'cuenta_inactiva') return 'cuenta_inactiva';
    if (status === 401) return data.error === 'token_invalido' ? 'token_invalido' : 'credenciales_invalidas';
    return 'error';
  } catch {
    return 'error';
  }
}

export const sesionHttp: SesionRepositorio = {
  async consultar() {
    try {
      const { data } = await api('GET', '/api/sesion');
      const metodos = (data.metodos ?? {}) as { token?: unknown; correo?: unknown };
      return {
        loginHabilitado: data.loginHabilitado === true,
        metodos: { token: metodos.token === true, correo: metodos.correo === true },
        autenticado: data.autenticado === true,
        usuario: data.autenticado === true && data.usuario ? (data.usuario as UsuarioSesion) : null,
      };
    } catch {
      return SIN_SESION;
    }
  },
  iniciarConCorreo: (correo, contrasena) => iniciar({ correo, contrasena }),
  iniciarConToken: (token) => iniciar({ token }),
  async cerrar() {
    await api('DELETE', '/api/sesion').catch(() => undefined);
  },
};

async function sincronizar(ruta: string, cuerpo: unknown): Promise<ResultadoSincronizacion> {
  let r;
  try {
    r = await api('POST', ruta, cuerpo);
  } catch {
    throw new ErrorSincronizacion('No se pudo contactar al backend.');
  }
  if (r.status !== 200) throw new ErrorSincronizacion(textoError(r.data, r.status));
  const detalle = typeof r.data.detalle === 'string' ? r.data.detalle : '';
  switch (r.data.resultado) {
    case 'simulado': return { tipo: 'simulado', peticion: r.data.peticion };
    case 'sin_cambios': return { tipo: 'sin_cambios', detalle };
    case 'sincronizado': return { tipo: 'sincronizado', detalle };
    default: throw new ErrorSincronizacion('Respuesta inesperada del backend.');
  }
}

export const sincronizacionHttp: SincronizacionRepositorio = {
  compuerta: (c: CambioCompuerta) => sincronizar('/api/admin/sync/compuerta', c),
  observacion: (o: EnvioObservacion) => sincronizar('/api/admin/sync/observacion', o),
};
