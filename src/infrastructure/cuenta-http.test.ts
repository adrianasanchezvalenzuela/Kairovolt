import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCuenta } from '@/application/cuenta';
import { cuentaHttp } from './cuenta-http';

const respuesta = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const stub = (f: (url: string, init: RequestInit) => Response) => vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => f(url, init)));
afterEach(() => vi.unstubAllGlobals());

describe('cuentaHttp', () => {
  it('recuperación: POST con el correo en el cuerpo, espera 202', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    stub((url, init) => { visto = { url, init }; return respuesta({ ok: true }, 202); });
    await expect(cuentaHttp.solicitarRecuperacion('ana@idc.mx')).resolves.toBeUndefined();
    expect(visto?.url).toBe('/api/recuperar');
    expect(visto?.url).not.toContain('ana@');
    expect(JSON.parse(String(visto?.init.body))).toEqual({ correo: 'ana@idc.mx' });
  });

  it('restablecer: el token y la contraseña viajan en el cuerpo, nunca en la URL', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    stub((url, init) => { visto = { url, init }; return respuesta({ ok: true }); });
    await cuentaHttp.restablecer('aaa.bbb.ccc', 'Clave-nueva-2027-xyz');
    expect(visto?.url).toBe('/api/restablecer');
    expect(JSON.parse(String(visto?.init.body))).toEqual({ token: 'aaa.bbb.ccc', contrasena: 'Clave-nueva-2027-xyz' });
  });

  it('cambiar contraseña: usa cookie y cabecera anti-CSRF', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    stub((url, init) => { visto = { url, init }; return respuesta({ ok: true }); });
    await cuentaHttp.cambiarContrasena('actual-123456', 'Clave-nueva-2027-xyz');
    expect(visto?.url).toBe('/api/cuenta/contrasena');
    expect(visto?.init.credentials).toBe('same-origin');
    expect((visto?.init.headers as Record<string, string>)['X-Requested-With']).toBe('kairovolt');
  });

  it('muestra el motivo que da el backend (y mensajes propios para 401, 429 y 503)', async () => {
    stub(() => respuesta({ error: 'contrasena_actual_incorrecta', detalle: 'La contraseña actual no es correcta.' }, 422));
    await expect(cuentaHttp.cambiarContrasena('x', 'y')).rejects.toThrow('La contraseña actual no es correcta.');
    stub(() => respuesta({ error: 'no_autorizado' }, 401));
    await expect(cuentaHttp.cambiarContrasena('x', 'y')).rejects.toThrow(/sesión expiró/);
    stub(() => respuesta({ error: 'demasiados_intentos' }, 429));
    await expect(cuentaHttp.solicitarRecuperacion('a@x.mx')).rejects.toThrow(/Demasiados intentos/);
    stub(() => respuesta({ error: 'no_disponible' }, 503));
    await expect(cuentaHttp.solicitarRecuperacion('a@x.mx')).rejects.toThrow(/servicio de cuentas/);
  });

  it('sin backend: ErrorCuenta; un 200 donde se esperaba 202 no se toma por éxito', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red'); }));
    await expect(cuentaHttp.solicitarRecuperacion('a@x.mx')).rejects.toBeInstanceOf(ErrorCuenta);
    stub(() => respuesta({}, 200));
    await expect(cuentaHttp.solicitarRecuperacion('a@x.mx')).rejects.toBeInstanceOf(ErrorCuenta);
  });
});
