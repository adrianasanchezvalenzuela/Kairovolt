import { construirVistaPortal, normalizarFolio, type PortalClienteRepositorio } from '@/application/portal-cliente';
import { catalogoRequisitos } from './catalogo';
import { repositorioMock } from './proyecto-repositorio.mock';

/** MOCK: arma la proyección en el navegador. Un adaptador real la pedirá al backend (nunca el proyecto completo). */
export const portalClienteMock: PortalClienteRepositorio = {
  origen: 'mock',
  async consultar(folio, hoy) {
    const proyecto = await repositorioMock.obtenerPorFolio(normalizarFolio(folio));
    if (!proyecto) return null;
    return construirVistaPortal(proyecto, catalogoRequisitos, hoy);
  },
};
