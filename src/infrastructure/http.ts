export interface RespuestaApi {
  status: number;
  data: Record<string, unknown>;
}

/** Cabecera que el backend exige en las escrituras autenticadas por cookie (defensa CSRF). */
const CABECERAS = { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' };

/** Llamada al backend (mismo origen vía proxy, con la cookie de sesión). Lanza `Error('backend_no_disponible')` si no hay red. */
export async function api(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<RespuestaApi> {
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: CABECERAS,
      ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
    });
  } catch {
    throw new Error('backend_no_disponible');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}
