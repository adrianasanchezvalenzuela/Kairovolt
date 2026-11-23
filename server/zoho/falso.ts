/** Zoho simulado para pruebas: responde por "METODO ruta" y registra las llamadas. */
import type { ZohoConfig } from '../config';
import { crearZohoAuth } from './auth';
import { crearClienteZoho } from './cliente';

export const zoho: ZohoConfig = { clientId: 'ID', clientSecret: 'SEC', refreshToken: 'REF', accountsUrl: 'https://accounts.zoho.com', projectsUrl: 'https://projectsapi.zoho.com', portalId: '777' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export interface Llamada { metodo: string; url: string; cuerpo: unknown }

/** Zoho falso: responde según "METODO ruta" (sin query) y registra las llamadas. */
export function zohoFalso(extra: Record<string, unknown> = {}) {
  const llamadas: Llamada[] = [];
  const rutas: Record<string, unknown> = {
    'GET /crm/v6/Deals': { data: [
      { id: 'D1', Deal_Name: 'KV-2026-004 - Interconexión FV 40 kW', Stage: 'Qualification', Account_Name: { id: 'A1', name: 'Acme' }, Contact_Name: { id: 'C1', name: 'Ana' }, Closing_Date: '2026-12-31' },
      { id: 'D2', Deal_Name: 'Otro trato sin folio KV', Stage: 'x' },
    ] },
    'GET /crm/v6/Accounts': { data: [{ id: 'A1', Account_Name: 'Acme', Phone: '662', Billing_City: 'Hermosillo', Billing_State: 'Sonora' }] },
    'GET /crm/v6/Contacts': { data: [{ id: 'C1', Full_Name: 'Ana Pérez', Email: 'ana@x.mx', Phone: null }] },
    'GET /api/v3/portal/777/projects': { projects: [{ id: 'P1', name: 'KV-2026-004 - Interconexión FV 40 kW', status: { name: 'Active' } }] },
    'GET /api/v3/portal/777/projects/P1/tasks': { tasks: [
      { id: 'T0', name: 'G0 - Prefactibilidad', status: { id: 's-closed', name: 'Closed' }, start_date: '2026-11-02', end_date: '2026-11-06', completed_on: '2026-11-05T10:00:00-07:00' },
      { id: 'T1', name: 'G1 - Acopio', status: { id: 's-prog', name: 'In Progress' }, start_date: '11-09-2026', end_date: '11-18-2026' },
      { id: 'T2', name: 'G2 - Validación', status: { id: 's-open', name: 'Open' }, start_date: '2026-11-19', end_date: '2026-11-23' },
      { id: 'T3', name: 'G3 - UVIE', status: { id: 's-raro', name: 'Estado Raro' } },
      { id: 'T9', name: 'Tarea que no es compuerta', status: { id: 's-open', name: 'Open' } },
    ] },
    'GET /crm/v6/Deals/D1/Notes': { data: [] },
    'POST /crm/v6/Deals/D1/Notes': { data: [{ status: 'success', code: 'SUCCESS' }] },
    'PATCH /api/v3/portal/777/projects/P1/tasks/T2': {},
    ...extra,
  };
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/oauth/')) return json({ access_token: 'AT', api_domain: 'https://www.zohoapis.com', expires_in: 3600 });
    const { pathname } = new URL(url);
    const metodo = init?.method ?? 'GET';
    llamadas.push({ metodo, url, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = rutas[`${metodo} ${pathname}`];
    return r === undefined ? json({ code: 'NOT_FOUND', message: `sin ruta ${metodo} ${pathname}` }, 404) : json(r);
  }) as unknown as typeof fetch;
  const cli = crearClienteZoho(zoho, crearZohoAuth(zoho, fetchFn), fetchFn);
  return { fetchFn, cli, llamadas };
}

