import { asuntosPortal } from '../src/application/correo-portal';

export interface CorreoEnCola {
  id: string;
  intento: number;
  correo: string;
  token: string | null;
  tipo: string | null;
  detalles?: {
    fecha?: string;
    horario?: string;
    ubicacion?: string | null;
    tipoVisita?: string;
  } | null;
}

const escapar = (texto: string): string => texto.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function contenidoCorreo(entrada: CorreoEnCola, appUrl: string) {
  const esCita = !!entrada.tipo?.startsWith('cita_');
  const titulo = entrada.token
    ? 'Verifica tu correo para recibir avisos'
    : asuntosPortal[entrada.tipo ?? ''] ?? 'Tienes una actualización en KairóVolt';
  const rutaDestino = entrada.token ? '/portal/verificar-correo' : esCita ? '/portal/visita' : '/portal';
  const destino = new URL(rutaDestino, appUrl);
  if (entrada.token) destino.hash = new URLSearchParams({ verificacion: entrada.token }).toString();

  if (entrada.tipo === 'cita_confirmada') {
    const fecha = entrada.detalles?.fecha ?? 'Fecha confirmada en tu portal';
    const horario = entrada.detalles?.horario ?? 'Horario de Hermosillo confirmado en tu portal';
    const ubicacion = entrada.detalles?.ubicacion || 'Se proporciona dentro de los detalles de tu cita en el portal.';
    return {
      subject: titulo,
      html: `<!doctype html><html lang="es"><body style="background:#f4f1e8;font-family:Arial,sans-serif;color:#102b40">
      <main style="max-width:520px;margin:30px auto;background:#fcfbf8;padding:24px;border-radius:14px">
        <p style="background:#102b40;color:#fff;padding:14px;font-weight:bold;border-radius:8px">KairóVolt · IDC Sistemas Eléctricos</p>
        <h1 style="font-size:24px;margin:18px 0 10px">¡Nos vemos pronto!</h1>
        <p>Tu cita para la entrega física de tu expediente ha sido confirmada.</p>
        <p><strong>Fecha:</strong> ${escapar(fecha)}<br/><strong>Horario:</strong> ${escapar(horario)}<br/><strong>Lugar:</strong> ${escapar(ubicacion)}</p>
        <p>Consulta en tu portal los documentos que debes llevar.</p>
        <a href="${escapar(destino.toString())}" style="display:inline-block;background:#176b70;color:#fff;padding:12px 16px;text-decoration:none;border-radius:8px;font-weight:bold">Ver detalles de mi visita</a>
        <p style="margin-top:18px;font-size:13px;color:#526778">Equipo IDC — KairóVolt.</p>
      </main></body></html>`,
    };
  }

  const mensajesCita: Record<string, string> = {
    cita_solicitada: 'Recibimos tu solicitud de cita. El equipo de IDC revisará la disponibilidad y te confirmará por este medio.',
    cita_propuesta_horario: 'IDC propuso un nuevo horario para tu visita. Entra al portal para revisarlo y responder.',
    cita_reprogramada: 'Tu cita ha sido reprogramada. Consulta la fecha y el horario vigentes en tu portal.',
    cita_cancelada: 'Tu cita fue cancelada. Puedes consultar el motivo y agendar una nueva fecha en tu portal.',
    cita_recordatorio: 'Te recordamos tu próxima visita a IDC. Revisa tu lista de documentos antes de salir de casa.',
  };

  const mensaje = entrada.token
    ? 'IDC registró esta dirección para los avisos de tu expediente. Confírmala para activar los avisos.'
    : esCita
      ? mensajesCita[entrada.tipo!] ?? 'Hay una actualización en tu cita. Consulta los detalles en el portal.'
      : 'Entra al portal con tu acceso habitual para consultar los detalles de tu expediente.';
  const accion = entrada.token ? 'Verificar correo' : esCita ? 'Ver detalles de mi visita' : 'Consultar mi expediente';
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
