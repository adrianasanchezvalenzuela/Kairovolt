import { handle } from 'hono/vercel';
import { crearApp } from '../server/app';
import { leerConfig } from '../server/config';

/**
 * Entrada de Vercel: la misma app Hono que corre en local, como función serverless en /api/*.
 * Las credenciales salen de las Environment Variables del proyecto en Vercel (no de server/.env).
 * SIN PROBAR en Vercel todavía.
 */
const app = crearApp(leerConfig(process.env));

export const GET = handle(app);
export const POST = handle(app);
export const DELETE = handle(app);
