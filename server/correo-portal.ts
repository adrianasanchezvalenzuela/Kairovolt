import { asuntosPortal } from '../src/application/correo-portal';

export interface CorreoEnCola {
  id: string;
  intento: number;
  correo: string;
  token: string | null;
  tipo: string | null;
}

const escapar = (texto: string): string => texto.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function contenidoCorreo(entrada: CorreoEnCola, appUrl: string) {
  const titulo = entrada.token ? 'Verifica tu correo para recibir avisos' : asuntosPortal[entrada.tipo ?? ''] ?? 'Tienes una actualización en KairóVolt';
  const destino = new URL(entrada.token ? '/portal/verificar-correo' : '/portal', appUrl);
  if (entrada.token) destino.hash = new URLSearchParams({ verificacion: entrada.token }).toString();
  const mensaje = entrada.token ? 'IDC registró esta dirección para los avisos de tu expediente. Confírmala para activar los avisos.'
    : 'Entra al portal con tu acceso habitual para consultar los detalles de tu expediente.';
  const accion = entrada.token ? 'Verificar correo' : 'Consultar mi expediente';
  return {
    subject: titulo,
    html: `<!doctype html><html lang="es"><body style="background:#f6f3eb;font-family:Arial,sans-serif;color:#102b40">
      <main style="max-width:520px;margin:30px auto;background:#fcfbf8;padding:24px">
        <p style="background:#102b40;color:#fff;padding:14px;font-weight:bold">KairóVolt · IDC</p>
        <h1 style="font-size:24px">${escapar(titulo)}</h1><p>${escapar(mensaje)}</p>
        <a href="${escapar(destino.toString())}" style="display:inline-block;background:#176b70;color:#fff;padding:12px 16px;text-decoration:none">${accion}</a>
      </main></body></html>`,
  };
}

export async function enviarCorreoPortal(entrada: CorreoEnCola, cfg: { apiKey: string; desde: string; appUrl: string }, fetchFn = fetch) {
  try {
    const respuesta = await fetchFn('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': 'portal/' + entrada.id },
      body: JSON.stringify({ from: cfg.desde, to: [entrada.correo], ...contenidoCorreo(entrada, cfg.appUrl) }),
    });
    if (respuesta.ok) return 'aceptado' as const;
    return respuesta.status === 429 || respuesta.status === 409 || respuesta.status >= 500 ? 'temporal' as const : 'rechazado' as const;
  } catch { return 'temporal' as const; }
}
