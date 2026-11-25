import { describe, expect, it } from 'vitest';
import { crearZohoAuth, ZohoError } from './auth';
import { crearClienteZoho, clasificar } from './cliente';
import { zoho } from './falso';

const json = (cuerpo: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** Zoho simulado con guion: cada llamada a la API consume la siguiente respuesta; el endpoint OAuth entrega tokens AT-1, AT-2… */
function montar(guion: (() => Response)[]) {
  const llamadas: { url: string; init: RequestInit; token: string | null }[] = [];
  let tokens = 0;
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/oauth/')) return json({ access_token: `AT-${++tokens}`, api_domain: 'https://www.zohoapis.com', expires_in: 3600 });
    llamadas.push({ url, init: init ?? {}, token: new Headers(init?.headers).get('authorization') });
    const siguiente = guion.shift();
    if (!siguiente) throw new Error('el guion se acabó: se hizo una llamada de más');
    return siguiente();
  }) as unknown as typeof fetch;
  const esperas: number[] = [];
  const auth = crearZohoAuth(zoho, fetchFn);
  const cli = crearClienteZoho(zoho, auth, fetchFn, { esperar: async (ms) => { esperas.push(ms); }, aleatorio: () => 1 });
  return { cli, llamadas, esperas, tokensEmitidos: () => tokens };
}

describe('reintentos', () => {
  it('un GET que falla con 5xx se repite con espera exponencial y al final devuelve los datos', async () => {
    const m = montar([() => json({}, 503), () => json({}, 502), () => json({ data: [1] })]);
    expect(await m.cli.crm('GET', '/crm/v6/Deals')).toEqual({ data: [1] });
    expect(m.llamadas).toHaveLength(3);
    expect(m.esperas).toEqual([400, 800]); // 400·2⁰, 400·2¹ (sin jitter porque aleatorio() = 1)
  });

  it('se rinde tras el máximo de intentos y reporta cuántos hizo, la categoría y que fue reintentable', async () => {
    const m = montar([() => json({}, 500), () => json({}, 500), () => json({}, 500), () => json({}, 500)]);
    const err = (await m.cli.crm('GET', '/x').catch((e: unknown) => e)) as ZohoError;
    expect(err).toBeInstanceOf(ZohoError);
    expect(err).toMatchObject({ status: 500, categoria: 'servidor', reintentable: true, intentos: 4 });
    expect(m.llamadas).toHaveLength(4);
  });

  it('un POST NO se reintenta tras un 5xx (podría haberse ejecutado y duplicar), salvo que se declare idempotente', async () => {
    const solo = montar([() => json({}, 503)]);
    await expect(solo.cli.crm('POST', '/crm/v6/Deals', { data: [] })).rejects.toMatchObject({ intentos: 1, categoria: 'servidor' });
    expect(solo.llamadas).toHaveLength(1);

    const upsert = montar([() => json({}, 503), () => json({ data: [{ status: 'success' }] })]);
    await expect(upsert.cli.crm('POST', '/crm/v6/Deals/upsert', {}, { idempotente: true })).resolves.toEqual({ data: [{ status: 'success' }] });
    expect(upsert.llamadas).toHaveLength(2);
  });

  it('un 429 se reintenta incluso en POST (Zoho no procesó la petición) y respeta Retry-After', async () => {
    const m = montar([() => json({}, 429, { 'Retry-After': '2' }), () => json({ ok: true })]);
    await expect(m.cli.projects('POST', '/api/v3/portal/1/projects', {})).resolves.toEqual({ ok: true });
    expect(m.esperas).toEqual([2000]);
  });

  it('limita la espera de Retry-After a un tope razonable', async () => {
    const m = montar([() => json({}, 429, { 'Retry-After': '3600' }), () => json({})]);
    await m.cli.crm('GET', '/x');
    expect(m.esperas).toEqual([30_000]);
  });

  it('un corte de red se reintenta en GET pero no en POST', async () => {
    let intentos = 0;
    const m = montar([() => { intentos++; throw new Error('ECONNRESET con SECRETO'); }, () => json({ ok: 1 })]);
    await expect(m.cli.crm('GET', '/x')).resolves.toEqual({ ok: 1 });
    expect(intentos).toBe(1);

    const p = montar([() => { throw new Error('red'); }]);
    const err = (await p.cli.crm('POST', '/x', {}).catch((e: unknown) => e)) as ZohoError;
    expect(err).toMatchObject({ categoria: 'red', intentos: 1 });
    expect(err.message).toBe('No se pudo contactar a Zoho CRM'); // sin detalles internos
  });

  it('no reintenta errores de validación (400), de permiso (403) ni «no existe» (404)', async () => {
    for (const [status, categoria] of [[400, 'validacion'], [403, 'permiso'], [404, 'no_encontrado'], [422, 'validacion']] as const) {
      const m = montar([() => json({ code: 'X', message: 'no' }, status)]);
      await expect(m.cli.crm('GET', '/x')).rejects.toMatchObject({ status, categoria, intentos: 1, reintentable: false });
      expect(m.llamadas).toHaveLength(1);
    }
  });
});

describe('renovación del token', () => {
  it('un 401 por token vencido pide un token nuevo UNA vez y repite (incluso en POST)', async () => {
    const m = montar([() => json({ code: 'INVALID_TOKEN', message: 'invalid oauth token' }, 401), () => json({ id: '7' })]);
    await expect(m.cli.crm('POST', '/crm/v6/Deals', {})).resolves.toEqual({ id: '7' });
    expect(m.tokensEmitidos()).toBe(2);
    expect(m.llamadas.map((l) => l.token)).toEqual(['Zoho-oauthtoken AT-1', 'Zoho-oauthtoken AT-2']);
  });

  it('si el 401 persiste, falla como autenticación (sin bucle infinito)', async () => {
    const m = montar([() => json({ code: 'INVALID_TOKEN' }, 401), () => json({ code: 'INVALID_TOKEN' }, 401)]);
    await expect(m.cli.crm('GET', '/x')).rejects.toMatchObject({ categoria: 'autenticacion', status: 401 });
    expect(m.llamadas).toHaveLength(2);
  });
});

describe('clasificación de errores', () => {
  it('un fallo por scope de OAuth es «permiso» y NO se reintenta, ni con 401 ni con 500', async () => {
    const projects = montar([() => json({ error: { status_code: '401', title: 'INVALID_OAUTHSCOPE', details: [{ message: 'Invalid OAuth scope.' }] } }, 401)]);
    const e1 = (await projects.cli.projects('GET', '/api/v3/portal/1/projects/2/tasklists').catch((e: unknown) => e)) as ZohoError;
    expect(e1).toMatchObject({ categoria: 'permiso', intentos: 1 });
    expect(e1.message).toBe('Zoho Projects respondió 401 (INVALID_OAUTHSCOPE): Invalid OAuth scope.');
    expect(projects.tokensEmitidos()).toBe(1); // no gastó una renovación de token en vano

    const wd = montar([() => json({ errors: [{ id: 'F7007', title: 'Invalid OAuth scope.' }] }, 500)]);
    const e2 = (await wd.cli.workdrive('GET', '/users/me').catch((e: unknown) => e)) as ZohoError;
    expect(e2).toMatchObject({ categoria: 'permiso', status: 500, intentos: 1, reintentable: false });
    expect(e2.message).toContain('Zoho WorkDrive respondió 500 (F7007)');

    const crm = montar([() => json({ code: 'OAUTH_SCOPE_MISMATCH', message: 'invalid oauth scope to access this URL', status: 'error' }, 401)]);
    await expect(crm.cli.crm('GET', '/crm/v6/org')).rejects.toMatchObject({ categoria: 'permiso' });
  });

  it('clasificar() por código de estado', () => {
    const sin = { codigo: null, mensaje: null, titulo: null };
    expect([401, 403, 404, 429, 400, 409, 500, 503, 418].map((s) => clasificar(s, sin))).toEqual([
      'autenticacion', 'permiso', 'no_encontrado', 'limite', 'validacion', 'validacion', 'servidor', 'servidor', 'desconocido',
    ]);
  });

  it('ningún mensaje de error incluye el token de acceso', async () => {
    const m = montar([() => json({ code: 'BAD', message: 'falló' }, 400)]);
    const err = (await m.cli.crm('GET', '/x').catch((e: unknown) => e)) as ZohoError;
    expect(err.message).not.toMatch(/AT-\d|oauthtoken/);
  });
});

describe('WorkDrive', () => {
  it('usa la base /workdrive/api/v1, el formato JSON:API y envía FormData sin tipo de contenido propio', async () => {
    const m = montar([() => json({ data: {} }), () => json({ data: [] })]);
    await m.cli.workdrive('POST', '/files', { data: { type: 'files' } });
    const form = new FormData();
    form.append('content', new Blob(['hola'], { type: 'text/plain' }), 'a.txt');
    await m.cli.workdrive('POST', '/upload?parent_id=1', form);

    const [json1, subida] = m.llamadas;
    expect(json1?.url).toBe('https://www.zohoapis.com/workdrive/api/v1/files');
    const h1 = new Headers(json1?.init.headers);
    expect(h1.get('content-type')).toBe('application/vnd.api+json');
    expect(h1.get('accept')).toBe('application/vnd.api+json');
    expect(subida?.init.body).toBeInstanceOf(FormData);
    expect(new Headers(subida?.init.headers).get('content-type')).toBeNull(); // fetch pone el boundary
  });
});
