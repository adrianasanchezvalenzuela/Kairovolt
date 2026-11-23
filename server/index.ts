import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { crearApp } from './app';
import { leerConfig } from './config';

const config = leerConfig(process.env);
const app = crearApp(config);

// Producción (`npm start`): el mismo proceso sirve la interfaz compilada (dist/) y la API, en UN solo puerto.
const hayInterfaz = existsSync('dist/index.html');
if (hayInterfaz) {
  app.all('/api/*', (c) => c.json({ error: 'no_encontrado' }, 404));
  app.use('*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' })); // rutas de React Router
}

// Solo escucha en loopback; para exponerlo, ponlo detrás de un proxy con HTTPS.
serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
  console.log(`KairóVolt en http://127.0.0.1:${info.port} · interfaz: ${hayInterfaz ? 'dist/' : 'no compilada (solo API)'} · Zoho: ${config.zoho ? 'credenciales presentes' : 'no configurado'}`);
});
