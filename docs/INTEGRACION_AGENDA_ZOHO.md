# Integración de Agenda y Citas con Zoho (Evaluación y Pasos Pendientes)

## Estado actual inspeccionado

En el repositorio actual (`server/zoho/*`), la integración existente cubre únicamente:

- **Zoho CRM v6**: lectura de tratos, cuentas, contactos y notas; escritura de notas de observaciones.
- **Zoho Projects v3**: lectura de proyectos y tareas G0–G3; escritura de estado de compuertas.
- **Zoho WorkDrive v1**: adaptador preparado (probado solo con simulaciones).

**No existe** actualmente ninguna conexión, credenciales, scopes OAuth ni adaptador activo hacia **Zoho Bookings** ni **Zoho Calendar**.

## Arquitectura implementada

Para evitar asumir licencias o crear eventos no autorizados en Zoho, se implementó el contrato desacoplado `ProveedorAgenda` en `server/citas/proveedor.ts`:

1. **Modo DEMO (`server/citas/memoria.ts`)**:
   - Provee una agenda demostrativa con zona horaria `America/Hermosillo`, días hábiles configurables, horarios ocupados simulados, prevención de traslapes e idempotencia.
   - Identifica explícitamente todos los datos como `simulada: true`.
2. **Modo REAL (`server/citas/supabase.ts`, migración 017)**:
   - Persiste solicitudes reales en `public.portal_citas` y su historial en `public.portal_citas_historial`, con exclusión real de traslapes en PostgreSQL (`EXCLUDE USING gist`) e idempotencia (`idempotency_key`).
   - Por defecto `portal_agenda_config.disponibilidad_publicada = false`: **no publica horarios reales** hasta que un administrador de IDC configure y publique la agenda desde el panel interno (`Bandeja IDC → Solicitudes de cita`).
   - Conserva las columnas `proveedor_externo` y `referencia_externa_id` en `portal_citas` para enlazar con un proveedor externo futuro sin duplicar fuentes de verdad.

## Pasos pendientes para conectar Zoho Bookings o Zoho Calendar

Cuando IDC confirme qué herramienta de calendario utiliza en producción:

1. **Definir fuente de verdad única**: elegir entre Zoho Bookings (recomendado si IDC gestiona servicios y disponibilidad de sala/asesor) o Zoho Calendar (si IDC gestiona un calendario de recepción único). Una vez conectado, el proveedor externo debe ser la fuente de disponibilidad y Supabase conservará únicamente el registro complementario de solicitud y su `referencia_externa_id`.
2. **Aprobar scopes OAuth en el Self Client / app de Zoho**:
   - Zoho Bookings: p. ej. `zohobookings.data.CREATE`, `zohobookings.data.READ`, `zohobookings.data.UPDATE` (verificar scopes exactos según el datacenter de IDC).
   - Zoho Calendar: p. ej. `ZohoCalendar.event.ALL`, `ZohoCalendar.calendar.READ`.
3. **Configurar variables de entorno dedicadas** (sin reutilizar scopes no aprobados):
   - `ZOHO_BOOKINGS_WORKSPACE_ID` / `ZOHO_BOOKINGS_SERVICE_ID` o `ZOHO_CALENDAR_UID`.
4. **Implementar adaptador `server/citas/zoho-bookings.ts`** cumpliendo exactamente la interfaz `ProveedorAgenda`, con modo `simular` antes de habilitar escritura real.
5. **Recordatorios programados (`cita_recordatorio`)**: configurar una tarea programada (cron en servidor / Vercel Cron / Supabase pg_cron) que ejecute el envío de recordatorios 24 h antes de cada cita `confirmada` o `reprogramada`, utilizando `npm run correo:portal` junto con `APP_URL`, `PORTAL_RESEND_API_KEY` y `PORTAL_CORREO_DESDE`.
