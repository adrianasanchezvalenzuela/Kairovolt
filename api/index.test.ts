import { describe, expect, it } from 'vitest';
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from './index';

describe('handlers HTTP de Vercel', () => {
  it('exporta métodos compatibles con las rutas del backend', () => {
    for (const handler of [GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS]) expect(handler).toBeTypeOf('function');
  });

  it('despacha PATCH a la app Hono en vez de dejar el método sin handler', async () => {
    const r = await PATCH(new Request('http://localhost/api/admin/usuarios/prueba', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' },
      body: JSON.stringify({ activo: false }),
    }));
    expect(r.status).not.toBe(405);
    expect(r.headers.get('content-type')).toContain('application/json');
  });
});
