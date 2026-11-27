import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorPortal, type ResultadoSubida, type VistaPortalConEstado } from '@/application/portal-acceso';
import { portalRepositorio } from '@/infrastructure';
import { aplicarExpedienteDemo, esFolioDocumentalDemo, leerExpedienteDemo, useVersionExpedienteDemo } from '@/demo/expediente-demo';

export type FasePortal =
  | { tipo: 'cargando' }
  | { tipo: 'sin_sesion' }
  | { tipo: 'error'; error: ErrorPortal }
  | { tipo: 'listo'; vista: VistaPortalConEstado };

interface ValorPortal {
  fase: FasePortal;
  entrar(folio: string, codigo: string): Promise<void>;
  salir(): Promise<void>;
  recargar(): Promise<void>;
  subir(documentoId: string, archivo: File, onProgreso?: (p: number) => void): Promise<ResultadoSubida>;
}

const Contexto = createContext<ValorPortal | null>(null);

/** Estado del portal del cliente: su sesión (cookie HttpOnly, la gestiona el backend) y la proyección pública de su proyecto. */
export function PortalProveedor({ children }: { children?: ReactNode }) {
  const [faseServidor, setFase] = useState<FasePortal>({ tipo: 'cargando' });
  const versionDemo = useVersionExpedienteDemo();
  // Demos documentales: la vista del servidor se completa con el estado mock compartido con el panel IDC.
  const fase = useMemo<FasePortal>(() => {
    if (faseServidor.tipo !== 'listo' || !faseServidor.vista.demo || !esFolioDocumentalDemo(faseServidor.vista.folio)) return faseServidor;
    return { tipo: 'listo', vista: { ...faseServidor.vista, ...aplicarExpedienteDemo(faseServidor.vista, leerExpedienteDemo(faseServidor.vista.folio)) } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faseServidor, versionDemo]);

  const cargar = useCallback(async () => {
    try {
      setFase({ tipo: 'listo', vista: await portalRepositorio.vista() });
    } catch (e) {
      const error = e instanceof ErrorPortal ? e : new ErrorPortal('desconocido', 'Algo salió mal. Intenta de nuevo.');
      setFase(error.codigo === 'sin_sesion' ? { tipo: 'sin_sesion' } : { tipo: 'error', error });
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const valor = useMemo<ValorPortal>(() => ({
    fase,
    async entrar(folio, codigo) {
      await portalRepositorio.acceder(folio, codigo); // lanza ErrorPortal con el mensaje para el cliente
      await cargar();
    },
    async salir() {
      await portalRepositorio.cerrar();
      setFase({ tipo: 'sin_sesion' });
    },
    recargar: cargar,
    async subir(documentoId, archivo, onProgreso) {
      const r = await portalRepositorio.subir(documentoId, archivo, onProgreso);
      await cargar(); // el estado del documento, los acuses y los avisos salen del servidor, no se inventan aquí
      return r;
    },
  }), [fase, cargar]);

  return <Contexto.Provider value={valor}>{children ?? <Outlet />}</Contexto.Provider>;
}

export function usePortal(): ValorPortal {
  const v = useContext(Contexto);
  if (!v) throw new Error('usePortal debe usarse dentro de PortalProveedor');
  return v;
}

/** La proyección pública del proyecto. Solo se usa dentro del layout del portal, que ya garantiza que hay sesión. */
export function useVistaPortal(): VistaPortalConEstado {
  const { fase } = usePortal();
  if (fase.tipo !== 'listo') throw new Error('useVistaPortal exige una sesión del portal');
  return fase.vista;
}
