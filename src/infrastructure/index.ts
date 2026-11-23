import type { IntegracionRepositorio } from '@/application/integracion';
import type { PortalClienteRepositorio } from '@/application/portal-cliente';
import type { CuentaRepositorio } from '@/application/cuenta';
import type { UsuariosRepositorio } from '@/application/usuarios';
import { cuentaHttp } from './cuenta-http';
import { integracionHttp } from './integracion-http';
import { usuariosHttp } from './usuarios-http';
import { portalClienteMock } from './portal-cliente.mock';
import { repositorioMock } from './proyecto-repositorio.mock';

export { catalogoRequisitos } from './catalogo';
export { proyectoRepositorioZoho, sesionHttp as sesionRepositorio, sincronizacionHttp as sincronizacionRepositorio } from './zoho-http';

/**
 * Punto de composición. La fuente de proyectos se elige en tiempo de ejecución (ver `FuenteDatosProvider`):
 * Zoho cuando el backend está conectado y hay sesión; MOCK en cualquier otro caso.
 */
export const proyectoRepositorioMock = repositorioMock;
export const portalClienteRepositorio: PortalClienteRepositorio = portalClienteMock;
export const integracionRepositorio: IntegracionRepositorio = integracionHttp;
export const usuariosRepositorio: UsuariosRepositorio = usuariosHttp;
export const cuentaRepositorio: CuentaRepositorio = cuentaHttp;
