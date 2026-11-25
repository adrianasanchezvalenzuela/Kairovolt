import { aProyectoKv } from '../zoho/adaptar';
import type { ClienteZoho } from '../zoho/cliente';
import { leerProyectos } from '../zoho/lectura';
import type { FuenteProyectoPortal } from './tipos';

/**
 * Proyecto REAL desde Zoho, solo por folio. Zoho no guarda el expediente: el proyecto llega con `documentosDisponibles: false` y el portal
 * lo refleja (avance aproximado, sin lista de documentos medibles). No se inventa nada. Las observaciones internas NO se leen.
 */
export function crearFuenteZoho(cli: ClienteZoho): FuenteProyectoPortal {
  return {
    modo: 'real',
    async obtener(folio) {
      const { proyectos } = await leerProyectos(cli, { folio });
      const p = proyectos.find((x) => x.folio.toUpperCase() === folio.toUpperCase());
      return p ? aProyectoKv(p, []) : null;
    },
  };
}

export const fuenteVacia: FuenteProyectoPortal = { modo: 'real', async obtener() { return null; } };
