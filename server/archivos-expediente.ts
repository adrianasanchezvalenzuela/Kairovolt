import type { SupabaseConfig } from './config';

export async function firmarArchivo(cfg: SupabaseConfig, fetchFn: typeof fetch, ruta: string): Promise<string> {
  const path = ruta.split('/').map(encodeURIComponent).join('/');
  const res = await fetchFn(cfg.url + '/storage/v1/object/sign/expedientes/' + path, {
    method: 'POST', headers: { apikey: cfg.secretKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  if (!res.ok) throw new Error('No se pudo abrir el archivo.');
  const { signedURL } = await res.json() as { signedURL?: string };
  if (!signedURL?.startsWith('/object/sign/expedientes/')) throw new Error('El almacenamiento no devolvió un enlace válido.');
  return cfg.url + '/storage/v1' + signedURL;
}
