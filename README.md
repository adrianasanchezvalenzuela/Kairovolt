# KairóVolt

Control y seguimiento del proceso de interconexión CFE (reto Conecta Ágil, IDC Sistemas Eléctricos).

```
npm install
npm run dev     # desarrollo
npm test        # reglas de dominio
npm run build   # typecheck + build
```

Capas: `domain` (reglas puras) → `application` (puertos) → `infrastructure` (adaptadores/mock) → `components` / `pages`.
Los datos de `src/data/*.mock.ts` son de prueba; no hay conexión real con Zoho.

## Backend (proxy Zoho)

Guía completa de configuración: [docs/ZOHO_SETUP.md](docs/ZOHO_SETUP.md).

```
copy server\.env.example server\.env   # completar credenciales; nunca se suben a git
npm run dev                             # interfaz + API en UN solo puerto (el que muestre Vite)
npm start                               # producción local: compila y sirve dist + API en http://127.0.0.1:8787
```

- `GET /api/integracion/estado`: "no conectado" sin credenciales; "conectado" solo si Zoho autentica de verdad.
- `POST /api/sesion`: canjea el `ADMIN_TOKEN` por una cookie de sesión (8 h). La interfaz inicia sesión así.
- `/api/admin/*` (cookie de sesión o `Authorization: Bearer <ADMIN_TOKEN>`): lectura de tratos y proyectos, y sincronización de compuertas y observaciones hacia Zoho.
- Mapeo de módulos y campos editable en `server/zoho/mapeo.ts`.
- La interfaz usa datos reales de Zoho cuando el backend está conectado y hay sesión iniciada; si no, datos MOCK con el motivo a la vista.
