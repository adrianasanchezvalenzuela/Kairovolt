import { describe, expect, it } from 'vitest';
import { CABECERA_CSRF, crearApp, VALOR_CSRF } from './app';
import { leerConfig, type ConfigServidor } from './config';
import { crearClienteSupabase } from './supabase/cliente';
import { supabaseCfg, supabaseFalso } from './supabase/falso';
import { actualizarUsuario, crearUsuario, listarUsuarios } from './supabase/usuarios';

const actor = { via: 'token', uid: null, correo: null } as const;
const valido = { correo: 'Ana.Perez@IDC.mx', nombre: 'Ana Pérez', rol: 'proyectista', contrasena: 'Una-clave-larga-2026' };
const TOKEN = 'token-de-prueba-largo';
const cfg: ConfigServidor = { port: 0, zoho: null, supabase: supabaseCfg, adminToken: TOKEN };

describe('leerConfig (Supabase)', () => {
  const base = { SUPABASE_URL: 'https://abcdefghij.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' };
  it('toma la URL y la clave secreta; acepta el nombre legacy', () => {
    expect(leerConfig(base).supabase).toEqual({ url: 'https://abcdefghij.supabase.co', secretKey: 'sb_secret_x', publishableKey: null });
    expect(leerConfig({ SUPABASE_URL: base.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'legacy' }).supabase?.secretKey).toBe('legacy');
  });
  it('tolera la URL con /rest/v1/ o con "/" final (se queda con el origen)', () => {
    expect(leerConfig({ ...base, SUPABASE_URL: 'https://abcdefghij.supabase.co/rest/v1/' }).supabase?.url).toBe('https://abcdefghij.supabase.co');
  });
  it('sin URL o sin clave no hay Supabase; un host ajeno se rechaza', () => {
    expect(leerConfig({ SUPABASE_URL: base.SUPABASE_URL }).supabase).toBeNull();
    expect(() => leerConfig({ ...base, SUPABASE_URL: 'https://evil.example.com' })).toThrow();
    expect(() => leerConfig({ ...base, SUPABASE_URL: 'no-es-url' })).toThrow();
  });
});

describe('crearUsuario', () => {
  it('crea el usuario en Auth con la contraseña SOLO en el cuerpo, y su perfil activo con el rol', async () => {
    const sb = supabaseFalso();
    const { usuario, auditado } = await crearUsuario(crearClienteSupabase(supabaseCfg, sb.fetchFn), valido, actor);
    expect(usuario).toMatchObject({ correo: 'ana.perez@idc.mx', nombre: 'Ana Pérez', rol: 'proyectista', activo: true, tienePerfil: true });
    expect(auditado).toBe(true);
    expect(sb.usuarios).toHaveLength(1);
    expect(sb.perfiles[0]).toMatchObject({ rol: 'proyectista', activo: true });
    const llamada = sb.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/auth/v1/admin/users')!;
    expect(llamada.cuerpo).toMatchObject({ email: 'ana.perez@idc.mx', email_confirm: true, user_metadata: { full_name: 'Ana Pérez' } });
    expect(llamada.ruta).not.toContain(valido.contrasena);
    // la contraseña no se persiste en ninguna otra tabla ni en la auditoría
    expect(JSON.stringify([sb.perfiles, sb.auditoria])).not.toContain(valido.contrasena);
    expect(sb.auditoria[0]).toMatchObject({ origen: 'app', entidad: 'usuario', accion: 'usuario_creado' });
  });

  it('la clave secreta viaja solo en "apikey" (no es un JWT)', async () => {
    const sb = supabaseFalso();
    await crearUsuario(crearClienteSupabase(supabaseCfg, sb.fetchFn), valido, actor);
    expect(sb.llamadas.every((l) => l.apikey === supabaseCfg.secretKey && l.authorization === null)).toBe(true);
  });

  it('valida correo, nombre, rol y contraseña antes de llamar a Supabase', async () => {
    const sb = supabaseFalso();
    const cli = crearClienteSupabase(supabaseCfg, sb.fetchFn);
    await expect(crearUsuario(cli, { ...valido, correo: 'no-es-correo' }, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(crearUsuario(cli, { ...valido, nombre: 'A' }, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(crearUsuario(cli, { ...valido, rol: 'superusuario' }, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(crearUsuario(cli, { ...valido, contrasena: 'corta1' }, actor)).rejects.toMatchObject({ codigo: 'contrasena_debil' });
    expect(sb.llamadas).toHaveLength(0);
  });

  it('correo duplicado → error claro y no toca perfiles', async () => {
    const sb = supabaseFalso();
    const cli = crearClienteSupabase(supabaseCfg, sb.fetchFn);
    await crearUsuario(cli, valido, actor);
    await expect(crearUsuario(cli, { ...valido, correo: 'ANA.PEREZ@idc.mx' }, actor)).rejects.toMatchObject({ codigo: 'correo_duplicado' });
    expect(sb.perfiles).toHaveLength(1);
  });

  it('si falla el perfil (SQL sin parchar) deshace el usuario de Auth y lo explica', async () => {
    const sb = supabaseFalso({ perfilesFallan: true });
    const err = await crearUsuario(crearClienteSupabase(supabaseCfg, sb.fetchFn), valido, actor).catch((e: unknown) => e);
    expect(err).toMatchObject({ codigo: 'perfil_fallo' });
    expect((err as Error).message).toMatch(/parche SQL/);
    expect(sb.usuarios).toHaveLength(0); // sin usuarios huérfanos
  });

  it('un fallo de auditoría no deshace el alta, pero se reporta', async () => {
    const sb = supabaseFalso({ auditoriaFalla: true });
    const r = await crearUsuario(crearClienteSupabase(supabaseCfg, sb.fetchFn), valido, actor);
    expect(r.auditado).toBe(false);
    expect(sb.usuarios).toHaveLength(1);
  });
});

describe('listar y actualizar', () => {
  it('une Auth con perfiles y marca a quien no tiene perfil', async () => {
    const sb = supabaseFalso();
    const cli = crearClienteSupabase(supabaseCfg, sb.fetchFn);
    await crearUsuario(cli, valido, actor);
    sb.usuarios.push({ id: '00000000-0000-4000-8000-0000000000ff', email: 'huerfano@idc.mx', created_at: '2026-11-01T00:00:00Z', last_sign_in_at: null, user_metadata: {} });
    const lista = await listarUsuarios(cli);
    expect(lista.map((u) => [u.correo, u.tienePerfil, u.activo])).toEqual([['ana.perez@idc.mx', true, true], ['huerfano@idc.mx', false, false]]);
  });

  it('cambia rol y estado; valida rol, id y que haya algo que cambiar', async () => {
    const sb = supabaseFalso();
    const cli = crearClienteSupabase(supabaseCfg, sb.fetchFn);
    const { usuario } = await crearUsuario(cli, valido, actor);
    const r = await actualizarUsuario(cli, usuario.id, { rol: 'consulta', activo: false }, actor);
    expect(r.usuario).toMatchObject({ rol: 'consulta', activo: false });
    expect(sb.auditoria.at(-1)).toMatchObject({ accion: 'usuario_modificado' });
    await expect(actualizarUsuario(cli, usuario.id, { rol: 'root' }, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(actualizarUsuario(cli, usuario.id, { activo: 'si' }, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(actualizarUsuario(cli, usuario.id, {}, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(actualizarUsuario(cli, 'no-uuid; drop table', { rol: 'admin' }, actor)).rejects.toMatchObject({ codigo: 'datos_invalidos' });
    await expect(actualizarUsuario(cli, '00000000-0000-4000-8000-00000000abcd', { rol: 'admin' }, actor)).rejects.toMatchObject({ codigo: 'no_encontrado' });
  });
});

describe('rutas /api/admin/usuarios', () => {
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const json = { 'Content-Type': 'application/json' };

  it('exigen sesión de administrador; sin ADMIN_TOKEN están deshabilitadas', async () => {
    const app = crearApp(cfg, supabaseFalso().fetchFn);
    expect((await app.request('/api/admin/usuarios')).status).toBe(401);
    expect((await app.request('/api/admin/usuarios', { method: 'POST', headers: json, body: JSON.stringify(valido) })).status).toBe(401);
    // Sin ADMIN_TOKEN ni clave publicable no hay ningún método de login: deshabilitado
    const sin = crearApp({ ...cfg, adminToken: null, supabase: { ...supabaseCfg, publishableKey: null } }, supabaseFalso().fetchFn);
    expect((await sin.request('/api/admin/usuarios', { headers: auth })).status).toBe(404);
    // Con login por correo habilitado, sin ADMIN_TOKEN: exige sesión (el Bearer ya no vale)
    const soloCorreo = crearApp({ ...cfg, adminToken: null }, supabaseFalso().fetchFn);
    expect((await soloCorreo.request('/api/admin/usuarios', { headers: auth })).status).toBe(401);
  });

  it('503 si Supabase no está configurado, aunque Zoho tampoco lo esté (no dependen entre sí)', async () => {
    const app = crearApp({ ...cfg, supabase: null }, supabaseFalso().fetchFn);
    const r = await app.request('/api/admin/usuarios', { headers: auth });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'supabase_no_configurado' });
  });

  it('crear, listar y modificar de punta a punta, con cookie + cabecera anti-CSRF', async () => {
    const sb = supabaseFalso();
    const app = crearApp(cfg, sb.fetchFn);
    const login = await app.request('/api/sesion', { method: 'POST', headers: json, body: JSON.stringify({ token: TOKEN }) });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const h = { ...json, Cookie: cookie, [CABECERA_CSRF]: VALOR_CSRF };

    const sinCsrf = await app.request('/api/admin/usuarios', { method: 'POST', headers: { ...json, Cookie: cookie }, body: JSON.stringify(valido) });
    expect(sinCsrf.status).toBe(403);

    const creado = await app.request('/api/admin/usuarios', { method: 'POST', headers: h, body: JSON.stringify(valido) });
    expect(creado.status).toBe(201);
    const cuerpo = (await creado.json()) as { usuario: { id: string } };
    expect(JSON.stringify(cuerpo)).not.toContain(valido.contrasena); // la respuesta nunca devuelve la contraseña

    const lista = (await (await app.request('/api/admin/usuarios', { headers: { Cookie: cookie } })).json()) as { usuarios: unknown[]; roles: unknown[] };
    expect(lista.usuarios).toHaveLength(1);
    expect(lista.roles).toHaveLength(5);

    const mod = await app.request(`/api/admin/usuarios/${cuerpo.usuario.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ activo: false }) });
    expect(mod.status).toBe(200);
    expect(sb.perfiles[0]?.activo).toBe(false);
  });

  it('mapea errores a HTTP: 400 datos, 409 duplicado, 422 contraseña, 404 inexistente', async () => {
    const app = crearApp(cfg, supabaseFalso().fetchFn);
    const post = (b: unknown) => app.request('/api/admin/usuarios', { method: 'POST', headers: { ...auth, ...json }, body: JSON.stringify(b) });
    expect((await post({ correo: 'x' })).status).toBe(400);
    expect((await post({ ...valido, correo: 'nada' })).status).toBe(400);
    expect((await post({ ...valido, contrasena: 'corta' })).status).toBe(422);
    expect((await post(valido)).status).toBe(201);
    expect((await post(valido)).status).toBe(409);
    const patch = await app.request('/api/admin/usuarios/00000000-0000-4000-8000-00000000abcd', { method: 'PATCH', headers: { ...auth, ...json }, body: JSON.stringify({ rol: 'admin' }) });
    expect(patch.status).toBe(404);
  });

  it('un error de Supabase no filtra la clave secreta', async () => {
    const roto = (async () => new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 })) as unknown as typeof fetch;
    const app = crearApp(cfg, roto);
    const t = await (await app.request('/api/admin/usuarios', { headers: auth })).text();
    expect(t).not.toContain(supabaseCfg.secretKey);
  });
});
