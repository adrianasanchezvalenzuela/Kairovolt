import { enviarCorreoPortal, type CorreoEnCola } from './correo-portal';
import { leerConfig } from './config';
import { crearClienteSupabase } from './supabase/cliente';

const config = leerConfig(process.env);
const apiKey = process.env.PORTAL_RESEND_API_KEY;
const desde = process.env.PORTAL_CORREO_DESDE;
if (!config.supabase || !apiKey || !desde || !config.appUrl) {
  console.log('Correo del portal inactivo. Configura Supabase, PORTAL_RESEND_API_KEY, PORTAL_CORREO_DESDE y APP_URL.');
} else if (config.portalDemo || new URL(config.appUrl).protocol !== 'https:') {
  throw new Error('Para procesar correos del portal usa un entorno real con APP_URL en HTTPS.');
} else {
  const sb = crearClienteSupabase(config.supabase);
  const resumen = { aceptado: 0, temporal: 0, rechazado: 0 };
  for (let i = 0; i < 20; i++) {
    const entrada = await sb.rest<CorreoEnCola | null>('POST', '/rpc/tomar_correo_portal', {});
    if (!entrada) break;
    const resultado = await enviarCorreoPortal(entrada, { apiKey, desde, appUrl: config.appUrl });
    await sb.rest('POST', '/rpc/resolver_correo_portal', { p_id: entrada.id, p_intento: entrada.intento, p_resultado: resultado });
    resumen[resultado]++;
  }
  console.log(resumen);
}
