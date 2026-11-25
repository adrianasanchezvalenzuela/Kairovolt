import type { Proyecto } from '../../src/domain/proyecto/proyecto';
import type { PermisosPortal, Recepcion } from '../../src/application/portal-cliente';

/** Un acceso del cliente a SU proyecto. El código en claro solo existe al crearlo: aquí solo hay su huella. */
export interface AccesoPortal {
  id: string;
  folio: string;
  permisos: PermisosPortal;
  /** ISO. */
  expiraEn: string;
  creadoEn: string;
  /** Solo en listados administrativos. */
  ultimoUso?: string | null;
}

export interface NuevoAcceso {
  permisos: PermisosPortal;
  dias: number;
  /** uid de quien lo genera (null = token de emergencia). */
  creadoPor: string | null;
}

export interface AccesosPortal {
  crear(folio: string, o: NuevoAcceso): Promise<{ acceso: AccesoPortal; codigo: string }>;
  /** El acceso solo si el código corresponde a ESE folio y está vigente (activo, sin revocar y sin vencer). */
  verificar(folio: string, codigo: string): Promise<AccesoPortal | null>;
  /** Revalida un acceso ya emitido (para que revocarlo surta efecto de inmediato). */
  obtener(id: string): Promise<AccesoPortal | null>;
  listar(folio: string): Promise<AccesoPortal[]>;
  revocar(id: string, por: string | null): Promise<boolean>;
}

export interface NuevaRecepcion {
  folio: string;
  accesoId: string;
  documentoId: string;
  documento: string;
  archivo: string;
  mime: string;
  tamano: number;
  sha256: string;
  rutaAlmacen: string;
}

export interface RecepcionesPortal {
  listar(folio: string): Promise<Recepcion[]>;
  registrar(r: NuevaRecepcion): Promise<Recepcion>;
}

/** Almacén PRIVADO de archivos. Nunca devuelve enlaces públicos. */
export interface AlmacenPortal {
  guardar(ruta: string, contenido: Uint8Array, mime: string): Promise<void>;
  retirar?(ruta: string): Promise<void>;
}

export interface FuenteProyectoPortal {
  modo: 'real' | 'demo';
  /** El proyecto de ese folio, o null. Se pide SIEMPRE con el folio de la sesión del cliente, nunca con uno enviado por él. */
  obtener(folio: string): Promise<Proyecto | null>;
}
