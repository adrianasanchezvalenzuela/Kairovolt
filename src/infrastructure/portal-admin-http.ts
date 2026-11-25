import type { PermisosPortal } from '@/application/portal-cliente';
import { api } from './http';

export interface AccesoPortalAdmin { id: string; folio: string; permisos: PermisosPortal; expiraEn: string; creadoEn: string; ultimoUso?: string | null }
export interface AccesoCreado { acceso: AccesoPortalAdmin; codigo: string; enlace: string }
export interface ListaAccesos { accesos: AccesoPortalAdmin[]; persistencia: 'supabase' | 'memoria'; demo: boolean }

const texto = (d: Record<string, unknown>, status: number) =>
  status === 401 ? 'La sesión expiró. Vuelve a iniciar sesión.' : status === 403 ? 'Tu rol no puede gestionar accesos del portal.' : (typeof d.detalle === 'string' ? d.detalle : typeof d.error === 'string' ? d.error : `El backend respondió ${status}.`);

/** Administración de los accesos del portal (personal de IDC). El código en claro solo llega al crear. */
export const portalAdminHttp = {
  async listar(folio: string): Promise<ListaAccesos> {
    const { status, data } = await api('GET', `/api/admin/portal/accesos?folio=${encodeURIComponent(folio)}`);
    if (status !== 200) throw new Error(texto(data, status));
    return data as unknown as ListaAccesos;
  },
  async crear(folio: string, dias: number, permisos?: Partial<PermisosPortal>): Promise<AccesoCreado> {
    const { status, data } = await api('POST', '/api/admin/portal/accesos', { folio, dias, ...(permisos && { permisos }) });
    if (status !== 201) throw new Error(texto(data, status));
    return data as unknown as AccesoCreado;
  },
  async revocar(id: string): Promise<void> {
    const { status, data } = await api('DELETE', `/api/admin/portal/accesos/${encodeURIComponent(id)}`);
    if (status !== 200) throw new Error(texto(data, status));
  },
};
