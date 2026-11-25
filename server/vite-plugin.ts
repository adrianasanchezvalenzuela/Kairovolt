import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import type { Plugin } from 'vite';
import { crearApp } from './app';
import { leerConfig } from './config';

/**
 * Monta el backend (`/api/*`) dentro del servidor de desarrollo de Vite: interfaz y API comparten UN solo puerto
 * (mismo origen, sin proxy ni CORS), igual que en producción.
 */
export function kairovoltApi(): Plugin {
  return {
    name: 'kairovolt-api',
    configureServer(server) {
      const env = join(server.config.root, 'server', '.env');
      if (existsSync(env)) process.loadEnvFile(env); // no pisa variables ya definidas en el entorno
      const config = leerConfig(process.env);
      const listener = getRequestListener(crearApp(config, fetch, Date.now, true).fetch);
      server.middlewares.use((req, res, next) => {
        if (req.url === '/portal/demo' || req.url === '/portal/demo/') {
          res.writeHead(302, { Location: '/demo/portal' });
          res.end();
        } else if (req.url?.startsWith('/api/')) void listener(req, res);
        else next();
      });
      server.config.logger.info(`  KairóVolt API en el mismo puerto · Zoho: ${config.zoho ? 'credenciales presentes' : 'no configurado'}`);
    },
  };
}
