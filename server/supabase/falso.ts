import type { SupabaseConfig } from '../config';

/** Supabase simulado en memoria (Auth admin + PostgREST de `perfiles` y `auditoria_eventos`) para pruebas. */
export const supabaseCfg: SupabaseConfig = {
  url: 'https://abcdefghij.supabase.co',
  secretKey: 'sb_secret_CLAVE_DE_PRUEBA',
  publishableKey: 'sb_publishable_CLAVE_PUBLICA',
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

interface Opciones {
  /** Simula la versión original del trigger: el upsert de perfiles falla (sin el parche SQL). */
  perfilesFallan?: boolean;
  /** Simula que la auditoría no se puede escribir. */
  auditoriaFalla?: boolean;
}

export function supabaseFalso(opc: Opciones = {}) {
  const usuarios: { id: string; email: string; created_at: string; last_sign_in_at: string | null; user_metadata: { full_name?: string }; password?: string }[] = [];
  const perfiles: { id: string; nombre_completo: string | null; correo: string | null; rol: string; activo: boolean }[] = [];
  const auditoria: Record<string, unknown>[] = [];
  const recuperaciones: { email: string; redirectTo: string | null }[] = [];
  const tokensRecuperacion = new Map<string, string>(); // token -> id de usuario (de un solo uso)
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown; apikey: string | null; authorization: string | null }[] = [];
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = new URL(String(input));
    const metodo = init?.method ?? 'GET';
    const h = new Headers(init?.headers);
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ metodo, ruta: url.pathname + url.search, cuerpo, apikey: h.get('apikey'), authorization: h.get('authorization') });
    const p = url.pathname;

    // Login con contraseña: lo hace el usuario final con la clave PUBLICABLE (la secreta no se usa aquí).
    if (p === '/auth/v1/token' && metodo === 'POST') {
      if (h.get('apikey') !== supabaseCfg.publishableKey) return json({ message: 'Invalid API key' }, 401);
      const u = usuarios.find((x) => x.email === cuerpo.email && x.password === cuerpo.password);
      if (!u) return json({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return json({ access_token: 'JWT-DE-PRUEBA', refresh_token: 'REFRESH-DE-PRUEBA', user: { id: u.id, email: u.email } });
    }
    // Recuperacion: la pide el usuario final (clave PUBLICABLE). Responde igual exista o no el correo.
    if (p === '/auth/v1/recover' && metodo === 'POST') {
      if (h.get('apikey') !== supabaseCfg.publishableKey) return json({ message: 'Invalid API key' }, 401);
      recuperaciones.push({ email: cuerpo.email, redirectTo: url.searchParams.get('redirect_to') });
      return json({});
    }
    // Cambio de contrasena con el token temporal del enlace del correo.
    if (p === '/auth/v1/user' && metodo === 'PUT') {
      if (h.get('apikey') !== supabaseCfg.publishableKey) return json({ message: 'Invalid API key' }, 401);
      const token = (h.get('authorization') ?? '').replace(/^Bearer /, '');
      const uid = tokensRecuperacion.get(token);
      const u = usuarios.find((x) => x.id === uid);
      if (!u) return json({ code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }, 401);
      if (cuerpo.password === u.password) return json({ error_code: 'same_password', msg: 'New password should be different from the old password.' }, 422);
      u.password = cuerpo.password;
      tokensRecuperacion.delete(token);
      return json({ id: u.id, email: u.email });
    }
    if (h.get('apikey') !== supabaseCfg.secretKey) return json({ message: 'Invalid API key' }, 401);

    if (p === '/auth/v1/admin/users' && metodo === 'GET') return json({ users: usuarios.map(({ password: _omitida, ...u }) => u), aud: 'authenticated' });
    if (p === '/auth/v1/admin/users' && metodo === 'POST') {
      if (usuarios.some((u) => u.email === cuerpo.email)) return json({ error_code: 'email_exists', msg: 'A user with this email address has already been registered' }, 422);
      const u = { id: uuid(), email: cuerpo.email, created_at: '2026-11-22T20:00:00Z', last_sign_in_at: null, user_metadata: cuerpo.user_metadata ?? {}, password: cuerpo.password };
      usuarios.push(u);
      return json((({ password: _omitida, ...r }) => r)(u));
    }
    const m = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(p);
    if (m && metodo === 'GET') { const u = usuarios.find((x) => x.id === m[1]); return u ? json((({ password: _omitida, ...r }) => r)(u)) : json({ msg: 'User not found' }, 404); }
    if (m && metodo === 'PUT') { const u = usuarios.find((x) => x.id === m[1]); if (!u) return json({ msg: 'User not found' }, 404); if (cuerpo.password) u.password = cuerpo.password; return json({ id: u.id }); }
    if (m && metodo === 'DELETE') { const i = usuarios.findIndex((x) => x.id === m[1]); if (i >= 0) usuarios.splice(i, 1); return json({}); }

    if (p === '/rest/v1/perfiles' && metodo === 'GET') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      return json(id ? perfiles.filter((x) => x.id === id) : perfiles);
    }
    if (p === '/rest/v1/perfiles' && metodo === 'POST') {
      if (opc.perfilesFallan) return json({ code: 'P0001', message: 'No tienes permiso para cambiar roles' }, 400);
      const i = perfiles.findIndex((x) => x.id === cuerpo.id);
      if (i >= 0) perfiles[i] = { ...perfiles[i]!, ...cuerpo }; else perfiles.push(cuerpo);
      return json([perfiles.find((x) => x.id === cuerpo.id)], 201);
    }
    if (p === '/rest/v1/perfiles' && metodo === 'PATCH') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const perfil = perfiles.find((x) => x.id === id);
      if (!perfil) return json([]);
      Object.assign(perfil, cuerpo);
      return json([perfil]);
    }
    if (p === '/rest/v1/auditoria_eventos' && metodo === 'POST') {
      if (opc.auditoriaFalla) return json({ code: '42501', message: 'permission denied' }, 403);
      auditoria.push(cuerpo);
      return json({}, 201);
    }
    return json({ message: `sin ruta ${metodo} ${p}` }, 404);
  }) as unknown as typeof fetch;

  /** Simula el enlace del correo: devuelve el token temporal (formato JWT) que llegaria en la URL. */
  const emitirTokenRecuperacion = (email: string): string => {
    const u = usuarios.find((x) => x.email === email)!;
    const token = `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.firma${tokensRecuperacion.size + 1}`;
    tokensRecuperacion.set(token, u.id);
    return token;
  };

  return { fetchFn, usuarios, perfiles, auditoria, llamadas, recuperaciones, emitirTokenRecuperacion };
}
