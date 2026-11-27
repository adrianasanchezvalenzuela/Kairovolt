import type { IntegracionRepositorio } from '@/application/integracion';
import type { PortalRepositorio } from '@/application/portal-acceso';
import type { CuentaRepositorio } from '@/application/cuenta';
import type { UsuariosRepositorio } from '@/application/usuarios';
import type { DecisionesRepositorio } from '@/application/decisiones';
import { cuentaHttp } from './cuenta-http';
import { decisionesLocal } from './decisiones-local';
import type { IntegracionAdminRepositorio } from '@/application/integracion-admin';
import { integracionAdminHttp } from './integracion-admin-http';
import { integracionHttp } from './integracion-http';
import { usuariosHttp } from './usuarios-http';
import { portalHttp } from './portal-http';
import { repositorioMock } from './proyecto-repositorio.mock';

export { catalogoRepositorio, catalogoRepositorioMock } from './catalogo';
export { proyectoRepositorioZoho, sesionHttp as sesionRepositorio, sincronizacionHttp as sincronizacionRepositorio } from './zoho-http';

/**
 * Punto de composición. La fuente de proyectos se elige en tiempo de ejecución (ver `FuenteDatosProvider`):
 * Zoho cuando el backend está conectado y hay sesión; MOCK en cualquier otro caso.
 */
export const proyectoRepositorioMock = repositorioMock;
export const portalRepositorio: PortalRepositorio = portalHttp;
export { portalAdminHttp } from './portal-admin-http';
export const integracionRepositorio: IntegracionRepositorio = integracionHttp;
export const usuariosRepositorio: UsuariosRepositorio = usuariosHttp;
export const cuentaRepositorio: CuentaRepositorio = cuentaHttp;
export const decisionesRepositorio: DecisionesRepositorio = decisionesLocal;
export const integracionAdminRepositorio: IntegracionAdminRepositorio = integracionAdminHttp;
