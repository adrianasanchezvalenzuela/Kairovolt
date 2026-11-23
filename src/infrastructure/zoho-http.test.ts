import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorSincronizacion } from '@/application/sincronizacion';
import { proyectoRepositorioZoho, sesionHttp, sincronizacionHttp } from './zoho-http';

const respuesta = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const stub = (f: (url: string, init: RequestInit) => Response | Promise<Response>) =>
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => f(url, init)));

afterEach(() => vi.unstubAllGlobals());

describe('sesionHttp', () => {
  it('login con token: traduce las respuestas', async () => {
    for (const [status, cuerpo, esperado] of [
      [200, {}, 'ok'], [401, { error: 'token_invalido' }, 'token_invalido'], [429, {}, 'demasiados_intentos'], [404, {}, 'deshabilitado'], [500, {}, 'error'],
    ] as const) {
      stub(() => respuesta(cuerpo, status));
      expect(await sesionHttp.iniciarConToken('x')).toBe(esperado);
    }
  });

  it('login con correo: traduce credenciales inválidas, cuenta inactiva y Supabase caído', async () => {
    for (const [status, cuerpo, esperado] of [
      [200, {}, 'ok'], [401, { error: 'credenciales_invalidas' }, 'credenciales_invalidas'], [403, { error: 'cuenta_inactiva' }, 'cuenta_inactiva'],
      [429, {}, 'demasiados_intentos'], [503, { error: 'auth_no_disponible' }, 'no_disponible'],
    ] as const) {
      stub(() => respuesta(cuerpo, status));
      expect(await sesionHttp.iniciarConCorreo('a@x.mx', 'clave')).toBe(esperado);
    }
  });

  it('el correo y la contraseña viajan solo en el cuerpo del POST, nunca en la URL', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    stub((url, init) => { visto = { url, init }; return respuesta({ autenticado: true }); });
    await sesionHttp.iniciarConCorreo('ana@idc.mx', 'mi-clave-secreta-1');
    expect(visto?.url).toBe('/api/sesion');
    expect(visto?.url).not.toMatch(/ana@|secreta/);
    expect(JSON.parse(String(visto?.init.body))).toEqual({ correo: 'ana@idc.mx', contrasena: 'mi-clave-secreta-1' });
    expect(visto?.init.credentials).toBe('same-origin');
    expect((visto?.init.headers as Record<string, string>)['X-Requested-With']).toBe('kairovolt');
  });

  it('sin backend: login "error" y sesión vacía (no lanza)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red'); }));
    expect(await sesionHttp.iniciarConCorreo('a@x.mx', 'x')).toBe('error');
    expect(await sesionHttp.consultar()).toMatchObject({ loginHabilitado: false, autenticado: false, usuario: null });
  });

  it('consultar: expone métodos y el usuario con su rol solo si está autenticado', async () => {
    stub(() => respuesta({ loginHabilitado: true, metodos: { token: true, correo: true }, autenticado: true, usuario: { correo: 'a@x.mx', nombre: 'Ana', rol: 'proyectista', via: 'supabase' } }));
    expect(await sesionHttp.consultar()).toEqual({
      loginHabilitado: true, metodos: { token: true, correo: true }, autenticado: true,
      usuario: { correo: 'a@x.mx', nombre: 'Ana', rol: 'proyectista', via: 'supabase' },
    });
    stub(() => respuesta({ loginHabilitado: true, metodos: { token: false, correo: true }, autenticado: false, usuario: { rol: 'admin' } }));
    expect((await sesionHttp.consultar()).usuario).toBeNull();
  });
});

describe('proyectoRepositorioZoho', () => {
  it('lista y busca por id usando el folio', async () => {
    const urls: string[] = [];
    stub((url) => { urls.push(url); return respuesta({ proyectos: [{ id: 'KV-2026-004', folio: 'KV-2026-004' }] }); });
    expect(await proyectoRepositorioZoho.listar()).toHaveLength(1);
    expect((await proyectoRepositorioZoho.obtenerPorId('KV-2026-004'))?.folio).toBe('KV-2026-004');
    expect(urls[1]).toBe('/api/admin/kv/proyectos?folio=KV-2026-004');
  });
  it('un 401 se explica como sesión expirada; un 502 muestra el motivo del backend', async () => {
    stub(() => respuesta({ error: 'no_autorizado' }, 401));
    await expect(proyectoRepositorioZoho.listar()).rejects.toThrow(/sesión expiró/);
    stub(() => respuesta({ error: 'Zoho Projects respondió 404' }, 502));
    await expect(proyectoRepositorioZoho.listar()).rejects.toThrow('Zoho Projects respondió 404');
  });
  it('devuelve null si el folio no existe', async () => {
    stub(() => respuesta({ proyectos: [] }));
    expect(await proyectoRepositorioZoho.obtenerPorId('KV-2026-999')).toBeNull();
  });
});

describe('sincronizacionHttp', () => {
  const cambio = { folio: 'KV-2026-004', compuerta: 'G1', estado: 'liberada' } as const;

  it('interpreta los tres resultados', async () => {
    stub(() => respuesta({ resultado: 'sincronizado', detalle: 'ok' }));
    expect(await sincronizacionHttp.compuerta(cambio)).toEqual({ tipo: 'sincronizado', detalle: 'ok' });
    stub(() => respuesta({ resultado: 'sin_cambios', detalle: 'igual' }));
    expect(await sincronizacionHttp.compuerta(cambio)).toEqual({ tipo: 'sin_cambios', detalle: 'igual' });
    stub(() => respuesta({ resultado: 'simulado', peticion: { metodo: 'PATCH' } }));
    expect(await sincronizacionHttp.compuerta({ ...cambio, simular: true })).toEqual({ tipo: 'simulado', peticion: { metodo: 'PATCH' } });
  });

  it('los errores del backend llegan como ErrorSincronizacion con su detalle', async () => {
    stub(() => respuesta({ error: 'estado_sin_id', detalle: 'Complétalo en mapeo.ts' }, 422));
    await expect(sincronizacionHttp.compuerta(cambio)).rejects.toThrow(new ErrorSincronizacion('Complétalo en mapeo.ts'));
  });

  it('sin backend: error claro, no excepción cruda', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red'); }));
    await expect(sincronizacionHttp.observacion({ folio: 'KV-2026-004', observacionId: 'o1', compuerta: 'G2', origen: 'interna', estado: 'abierta', descripcion: 'x' }))
      .rejects.toBeInstanceOf(ErrorSincronizacion);
  });

  it('una respuesta 200 desconocida no se toma por éxito', async () => {
    stub(() => respuesta({ algo: 'raro' }));
    await expect(sincronizacionHttp.compuerta(cambio)).rejects.toThrow(/inesperada/);
  });
});
