import {
  ErrorUsuarios, type CambioUsuario, type NuevoUsuario, type ResultadoUsuario, type UsuariosRepositorio, type UsuarioKv,
} from '@/application/usuarios';
import { api, type RespuestaApi } from './http';

function mensaje({ status, data }: RespuestaApi): string {
  if (status === 401) return 'La sesión expiró. Vuelve a iniciar sesión.';
  if (data.error === 'supabase_no_configurado') return 'Supabase no está configurado en el backend (faltan SUPABASE_URL y SUPABASE_SECRET_KEY).';
  if (typeof data.detalle === 'string') return data.detalle;
  if (typeof data.error === 'string') return data.error;
  return `El backend respondió ${status}.`;
}

async function llamar(metodo: 'GET' | 'POST' | 'PATCH', ruta: string, cuerpo?: unknown, esperado = 200): Promise<RespuestaApi> {
  let r: RespuestaApi;
  try {
    r = await api(metodo, ruta, cuerpo);
  } catch {
    throw new ErrorUsuarios('No se pudo contactar al backend.');
  }
  if (r.status !== esperado) throw new ErrorUsuarios(mensaje(r));
  return r;
}

export const usuariosHttp: UsuariosRepositorio = {
  async listar() {
    return (await llamar('GET', '/api/admin/usuarios')).data.usuarios as UsuarioKv[];
  },
  async crear(nuevo: NuevoUsuario) {
    return (await llamar('POST', '/api/admin/usuarios', nuevo, 201)).data as unknown as ResultadoUsuario;
  },
  async actualizar(id: string, cambio: CambioUsuario) {
    return (await llamar('PATCH', `/api/admin/usuarios/${encodeURIComponent(id)}`, cambio)).data as unknown as ResultadoUsuario;
  },
};
