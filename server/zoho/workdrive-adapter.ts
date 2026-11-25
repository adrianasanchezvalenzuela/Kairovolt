import type { ArchivoExterno, CarpetaProyecto, PuertoArchivos } from '../../src/application/integracion/puertos';
import { ZohoError } from './auth';
import { seg, type ClienteZoho } from './cliente';
import { lista, registro, texto } from './lectura';
import { ZohoMapper } from './mapper';

const LIMITE = 50;

/**
 * ZohoWorkDriveAdapter: implementa `PuertoArchivos`. Organiza los archivos en una carpeta por FOLIO dentro de la carpeta raíz configurada
 * (ZOHO_WORKDRIVE_ROOT_FOLDER_ID), con una subcarpeta por compuerta. Si la carpeta ya existe se reutiliza (idempotente).
 * Basado en la documentación de WorkDrive API v1; NO verificado contra la cuenta real (el token actual no tiene permisos de WorkDrive).
 */
export function crearWorkDriveAdapter(cli: ClienteZoho, rootId: string | null): PuertoArchivos {
  const raiz = (): string => {
    if (!rootId) throw new ZohoError('Falta ZOHO_WORKDRIVE_ROOT_FOLDER_ID: WorkDrive está deshabilitado.', undefined, 'validacion');
    return rootId;
  };

  async function hijos(carpetaId: string): Promise<{ id: string; nombre: string; esCarpeta: boolean; archivo: ArchivoExterno }[]> {
    const salida: { id: string; nombre: string; esCarpeta: boolean; archivo: ArchivoExterno }[] = [];
    for (let offset = 0; ; offset += LIMITE) {
      const res = registro(await cli.workdrive('GET', `/files/${seg(carpetaId)}/files?page%5Blimit%5D=${LIMITE}&page%5Boffset%5D=${offset}`));
      const pagina = lista(res.data);
      for (const r of pagina) {
        const archivo = ZohoMapper.archivo(r, carpetaId);
        salida.push({ id: archivo.id, nombre: archivo.nombre, esCarpeta: ZohoMapper.esCarpeta(r), archivo });
      }
      if (pagina.length < LIMITE) return salida;
    }
  }

  /** Busca una carpeta por nombre dentro de otra; si no existe la crea (o, en simulación, dice que la crearía). */
  async function carpeta(padreId: string, nombre: string, simular: boolean): Promise<{ id: string; creada: boolean }> {
    const hallada = (padreId.startsWith('(')) ? undefined : (await hijos(padreId)).find((h) => h.esCarpeta && h.nombre === nombre);
    if (hallada) return { id: hallada.id, creada: false };
    if (simular) return { id: `(carpeta ${nombre})`, creada: true };
    const res = registro(await cli.workdrive('POST', '/files', ZohoMapper.cuerpoCarpeta(nombre, padreId)));
    const id = texto(registro(res.data).id);
    if (!id) throw new ZohoError('WorkDrive no devolvió el id de la carpeta creada.', undefined, 'desconocido');
    return { id, creada: true };
  }

  return {
    async asegurarCarpetaProyecto(folio, subcarpetas, o): Promise<CarpetaProyecto> {
      const principal = await carpeta(raiz(), folio, o.simular);
      const subs: Record<string, string> = {};
      let creo = principal.creada;
      for (const nombre of subcarpetas) {
        const s = await carpeta(principal.id, nombre, o.simular);
        subs[nombre] = s.id;
        creo = creo || s.creada;
      }
      return { carpetaId: principal.id, subcarpetas: subs, accion: !creo ? 'sin_cambios' : o.simular ? 'simulado' : 'creado' };
    },

    async subirArchivo(carpetaId, nombre, contenido, mime, o) {
      const existente = carpetaId.startsWith('(') ? undefined : (await hijos(carpetaId)).find((h) => !h.esCarpeta && h.nombre === nombre);
      if (o.simular) return { archivo: null, accion: 'simulado' };
      const form = new FormData();
      form.append('content', new Blob([contenido as BlobPart], { type: mime }), nombre);
      // `override-name-exist=true`: si ya hay un archivo con ese nombre, WorkDrive lo conserva como versión anterior y guarda esta como la nueva.
      const res = registro(await cli.workdrive('POST', `/upload?parent_id=${seg(carpetaId)}&filename=${seg(nombre)}&override-name-exist=true`, form));
      const primero = lista(res.data)[0];
      if (!primero) throw new ZohoError('WorkDrive no confirmó la subida del archivo.', undefined, 'desconocido');
      return { archivo: ZohoMapper.archivo(primero, carpetaId), accion: existente ? 'nueva_version' : 'creado' };
    },

    async listarArchivos(carpetaId) {
      return (await hijos(carpetaId)).filter((h) => !h.esCarpeta).map((h) => h.archivo);
    },
  };
}
