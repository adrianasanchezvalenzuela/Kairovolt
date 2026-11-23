import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorUsuarios } from '@/application/usuarios';
import { usuariosHttp } from './usuarios-http';

const respuesta = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const stub = (f: (url: string, init: RequestInit) => Response) => vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => f(url, init)));
afterEach(() => vi.unstubAllGlobals());

const nuevo = { correo: 'ana@idc.mx', nombre: 'Ana', rol: 'proyectista', contrasena: 'Una-clave-larga-2026' } as const;

describe('usuariosHttp', () => {
  it('lista usuarios', async () => {
    stub(() => respuesta({ usuarios: [{ id: 'u1', correo: 'a@x.mx' }], roles: [] }));
    expect(await usuariosHttp.listar()).toEqual([{ id: 'u1', correo: 'a@x.mx' }]);
  });

  it('crear usa POST con cabecera anti-CSRF y cookie, y espera 201', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    stub((url, init) => { visto = { url, init }; return respuesta({ usuario: { id: 'u1' }, auditado: true }, 201); });
    const r = await usuariosHttp.crear(nuevo);
    expect(r.auditado).toBe(true);
    expect(visto?.url).toBe('/api/admin/usuarios');
    expect(visto?.init.method).toBe('POST');
    expect(visto?.init.credentials).toBe('same-origin');
    expect((visto?.init.headers as Record<string, string>)['X-Requested-With']).toBe('kairovolt');
  });

  it('actualizar usa PATCH sobre el id codificado', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    stub((url, init) => { visto = { url, init }; return respuesta({ usuario: { id: 'u 1' }, auditado: true }); });
    await usuariosHttp.actualizar('u 1', { activo: false });
    expect(visto?.url).toBe('/api/admin/usuarios/u%201');
    expect(visto?.init.method).toBe('PATCH');
    expect(JSON.parse(String(visto?.init.body))).toEqual({ activo: false });
  });

  it('traduce los errores del backend a mensajes legibles', async () => {
    stub(() => respuesta({ error: 'correo_duplicado', detalle: 'Ya existe un usuario con ese correo.' }, 409));
    await expect(usuariosHttp.crear(nuevo)).rejects.toThrow('Ya existe un usuario con ese correo.');
    stub(() => respuesta({ error: 'no_autorizado' }, 401));
    await expect(usuariosHttp.listar()).rejects.toThrow(/sesión expiró/);
    stub(() => respuesta({ error: 'supabase_no_configurado' }, 503));
    await expect(usuariosHttp.listar()).rejects.toThrow(/Supabase no está configurado/);
  });

  it('sin backend: ErrorUsuarios, no una excepción cruda', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red'); }));
    await expect(usuariosHttp.listar()).rejects.toBeInstanceOf(ErrorUsuarios);
  });

  it('un 200 donde se esperaba 201 no se toma por éxito', async () => {
    stub(() => respuesta({ usuario: {} }, 200));
    await expect(usuariosHttp.crear(nuevo)).rejects.toBeInstanceOf(ErrorUsuarios);
  });
});
