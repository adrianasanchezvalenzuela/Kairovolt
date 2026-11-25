import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LoadingState } from '@/components/ui/Estados';
import {
  elegirFuente, type EstadoIntegracion, type EstadoSesion, type FuenteDatos, type MotivoMock, type ResultadoInicioSesion, type UsuarioSesion,
} from '@/application/integracion';
import { puede } from '@/domain/usuarios/permisos';
import type { ProyectoRepositorio } from '@/application/proyecto-repositorio';
import type { SincronizacionRepositorio } from '@/application/sincronizacion';
import {
  integracionRepositorio, proyectoRepositorioMock, proyectoRepositorioZoho, sesionRepositorio, sincronizacionRepositorio,
} from '@/infrastructure';

interface Valor {
  integracion: EstadoIntegracion;
  sesion: EstadoSesion;
  fuente: FuenteDatos;
  motivoMock: MotivoMock | null;
  repositorio: ProyectoRepositorio;
  /** Solo existe con datos reales: sincronizar contra Zoho estando en MOCK sería escribir datos que no son los de la pantalla. */
  sincronizacion: SincronizacionRepositorio | null;
  /** Quién está dentro (null si nadie). */
  usuario: UsuarioSesion | null;
  iniciarSesionConCorreo(correo: string, contrasena: string): Promise<ResultadoInicioSesion>;
  iniciarSesionConToken(token: string): Promise<ResultadoInicioSesion>;
  cerrarSesion(): Promise<void>;
}

const Contexto = createContext<Valor | null>(null);

interface Estado { integracion: EstadoIntegracion; sesion: EstadoSesion }

export function FuenteDatosProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);

  const refrescar = useCallback(async () => {
    const [integracion, sesion] = await Promise.all([integracionRepositorio.consultarEstado(), sesionRepositorio.consultar()]);
    setEstado({ integracion, sesion });
  }, []);
  useEffect(() => { void refrescar(); }, [refrescar]);

  const valor = useMemo<Valor | null>(() => {
    if (!estado) return null;
    const { fuente, motivoMock } = elegirFuente(estado.integracion.zoho, estado.sesion);
    return {
      ...estado,
      fuente,
      motivoMock,
      repositorio: fuente === 'zoho' ? proyectoRepositorioZoho : proyectoRepositorioMock,
      usuario: estado.sesion.usuario,
      // Solo se ofrece sincronizar si el rol puede (el backend lo vuelve a exigir en cada petición).
      sincronizacion: fuente === 'zoho' && puede(estado.sesion.usuario?.rol, 'sincronizar_zoho') ? sincronizacionRepositorio : null,
      async iniciarSesionConCorreo(correo, contrasena) {
        const r = await sesionRepositorio.iniciarConCorreo(correo, contrasena);
        if (r === 'ok') await refrescar();
        return r;
      },
      async iniciarSesionConToken(token) {
        const r = await sesionRepositorio.iniciarConToken(token);
        if (r === 'ok') await refrescar();
        return r;
      },
      async cerrarSesion() {
        await sesionRepositorio.cerrar();
        await refrescar();
      },
    };
  }, [estado, refrescar]);

  if (!valor) return <LoadingState variante="pagina" etiqueta="Iniciando KairóVolt…" />;
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFuenteDatos(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error('useFuenteDatos debe usarse dentro de FuenteDatosProvider');
  return v;
}
