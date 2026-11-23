# Conectar KairóVolt con Zoho (CRM y Projects)

> **Estado honesto:** sin credenciales en `server/.env` la app muestra **"Zoho: no conectado"** y usa datos MOCK (la insignia dice por qué).
> Con credenciales válidas, el backend autentica con OAuth real; para ver **datos reales** en la interfaz además hay que
> **iniciar sesión** con el `ADMIN_TOKEN` (paso 8). Sin sesión, la interfaz sigue en MOCK. La conexión se probó contra una cuenta
> real de Zoho (CRM + Projects, datacenter US); el resto de cuentas puede requerir ajustes (ver "Si algo falla").

## 1. Variables de `server/.env`

Copia `server/.env.example` a `server/.env` (git lo ignora) y completa:

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `ZOHO_CLIENT_ID` | sí | Client ID del Self Client |
| `ZOHO_CLIENT_SECRET` | sí | Client Secret del Self Client |
| `ZOHO_REFRESH_TOKEN` | sí | Refresh token (paso 3) |
| `ZOHO_ACCOUNTS_URL` | no | Dominio de cuentas de tu datacenter. Default `https://accounts.zoho.com` |
| `ZOHO_PROJECTS_URL` | no | API de Projects de tu datacenter. Default `https://projectsapi.zoho.com` |
| `ZOHO_PROJECTS_PORTAL_ID` | para Projects | ID del portal de Zoho Projects (paso 5) |
| `ADMIN_TOKEN` | para login y `/api/admin/*` | Token largo y aleatorio que tú inventas. Es la contraseña del panel y protege lectura y escritura. Sin él, el login queda deshabilitado |
| `PORT` | no | Puerto de `npm start` (producción local). Default `8787`; en `npm run dev` manda el puerto de Vite |

Datacenters: **US** `accounts.zoho.com` / `projectsapi.zoho.com` · **EU** `.eu` · **IN** `.in` · **AU** `.com.au` · **JP** `.jp` ·
**CA** `.ca` · **SA** `.sa` · **CN** `.com.cn`. Usa el mismo datacenter en la consola de API, en `ZOHO_ACCOUNTS_URL` y en
`ZOHO_PROJECTS_URL` (si entras a Zoho por `zoho.com.mx` u otro dominio de país, tu cuenta suele estar en el datacenter US; confírmalo
en *Perfil → Mi cuenta*). El backend rechaza dominios que no sean oficiales de Zoho.

Genera un `ADMIN_TOKEN` en PowerShell:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

## 2. Crear el Self Client

1. Entra a <https://api-console.zoho.com> (usa el dominio de tu datacenter, p. ej. `api-console.zoho.eu`).
2. **Add Client** → **Self Client** → **Create**.
3. En la pestaña **Client Secret** copia el **Client ID** y el **Client Secret** a `server/.env`.

## 3. Obtener el `refresh_token`

1. En el Self Client abre la pestaña **Generate Code**.
2. **Scope** (separados por comas, sin espacios):

   ```
   ZohoCRM.modules.ALL,ZohoCRM.settings.modules.READ,ZohoProjects.portals.READ,ZohoProjects.projects.ALL,ZohoProjects.tasks.ALL
   ```

   Si la consola no acepta algún scope, busca el equivalente en la documentación de Zoho; con menos permisos fallarán solo las
   operaciones que los necesitan.
3. **Time Duration:** 10 minutos. **Scope Description:** `KairoVolt`. Pulsa **Create** y copia el código (`1000.xxxx...`).
   Caduca en el tiempo elegido y solo sirve una vez.
4. Cámbialo por tokens (rápido, antes de que caduque). Reemplaza los valores y, si tu datacenter no es US, el dominio:

   ```powershell
   $r = Invoke-RestMethod -Method Post -Uri "https://accounts.zoho.com/oauth/v2/token" -Body @{
     grant_type    = "authorization_code"
     client_id     = "TU_CLIENT_ID"
     client_secret = "TU_CLIENT_SECRET"
     code          = "EL_CODIGO_1000.xxxx"
   }
   $r.refresh_token
   ```

5. Copia el valor a `ZOHO_REFRESH_TOKEN`. **El `refresh_token` aparece solo esta vez** y no caduca por tiempo: trátalo como una contraseña
   (no lo pegues en chats, commits ni capturas). Si lo pierdes, repite el paso 3; para invalidarlo, revócalo en
   <https://accounts.zoho.com/u/h#sessions/userauthtokens>.

## 4. Probar la autenticación

Arranca todo con **un solo comando y un solo puerto** (interfaz y API juntas):

```powershell
npm run dev
```

Vite muestra la URL (por ejemplo `http://localhost:5173`). En otra terminal define la base con ese puerto y consulta:

```powershell
$base = "http://localhost:5173"   # el puerto que muestre npm run dev
```

```powershell
Invoke-RestMethod $base/api/integracion/estado
```

- `zoho: no_configurado` → falta alguna de las tres credenciales o no se leyó `server/.env`.
- `zoho: error` → Zoho rechazó la renovación (el mensaje indica por qué: `invalid_client`, `invalid_code`, datacenter equivocado…).
- `zoho: conectado` → OAuth real verificado. (También aparece en el encabezado de la app.)

Para los siguientes pasos usa el token administrativo:

```powershell
$h = @{ Authorization = "Bearer TU_ADMIN_TOKEN" }
```

## 5. Descubrir módulos y portal

```powershell
Invoke-RestMethod $base/api/admin/zoho/modulos  -Headers $h   # módulos CRM (Deals, Accounts, Contacts…)
Invoke-RestMethod $base/api/admin/zoho/portales -Headers $h   # portales de Projects
```

Copia el `id` de tu portal a `ZOHO_PROJECTS_PORTAL_ID` y reinicia `npm run dev`.

## 6. Leer los proyectos

```powershell
Invoke-RestMethod $base/api/admin/zoho/proyectos -Headers $h
Invoke-RestMethod "$base/api/admin/zoho/proyectos?folio=KV-2026-004" -Headers $h
```

Une por **folio KV** (se toma del inicio del nombre: `KV-2026-004 - Interconexión FV 40 kW`) el trato de CRM (con su cuenta y
contacto) y el proyecto de Projects. Las tareas cuyo nombre empieza con `G0`…`G3` se interpretan como compuertas. Lo que no se
entiende (estados sin equivalencia, trato sin proyecto, etc.) aparece en `advertencias`; nada se oculta. Se leen hasta 200 tratos y 100 proyectos/tareas.

## 7. Sincronizar cambios hacia Zoho

Primero **simula** (no escribe nada y muestra la petición exacta):

```powershell
$cuerpo = @{ folio="KV-2026-004"; compuerta="G1"; estado="liberada"; simular=$true } | ConvertTo-Json
Invoke-RestMethod -Method Post $base/api/admin/sync/compuerta -Headers $h -ContentType "application/json" -Body $cuerpo
```

Si la petición se ve correcta, repite con `simular=$false` (o sin el campo). Qué hace cada una:

- **Compuerta** (`POST /api/admin/sync/compuerta`, estados `pendiente | en_revision | liberada | bloqueada`): cambia el estado de la tarea
  de esa compuerta en Zoho Projects. Necesita el **ID del estado destino**: lo toma de `estadosCompuerta.<estado>.id` en el mapeo o lo
  aprende de otra tarea que ya tenga ese estado; si no puede, responde `422 estado_sin_id` y te dice qué completar (no adivina).
- **Observación** (`POST /api/admin/sync/observacion`): crea una **nota en el trato** de CRM. Cada envío lleva una marca
  `[KV-OBS:<id>:<estado>]`; reenviar lo mismo no duplica, y un cambio de estado de la observación agrega una nota nueva.

  ```powershell
  $obs = @{ folio="KV-2026-004"; observacionId="o1"; compuerta="G2"; origen="interna"; estado="abierta";
            descripcion="Confirmar MT/BT entre solicitud y unifilar"; responsable="Proyectista"; fechaCompromiso="2026-11-25";
            simular=$true } | ConvertTo-Json
  Invoke-RestMethod -Method Post $base/api/admin/sync/observacion -Headers $h -ContentType "application/json" -Body $obs
  ```

Estos mismos endpoints son los que usan los botones de la interfaz (paso 8).

## 8. Usar la interfaz con datos reales

1. Con `npm run dev` corriendo, abre la app. El encabezado muestra una de estas insignias:
   - **Datos reales · Zoho CRM + Projects**: Zoho conectado y sesión iniciada.
   - **Datos MOCK · inicia sesión para ver Zoho**: Zoho conectado, falta iniciar sesión.
   - **Datos MOCK · Zoho no conectado / error de conexión / backend no disponible / define ADMIN_TOKEN…**: no hay datos reales y la insignia dice por qué.
2. Pulsa **Iniciar sesión** (arriba a la derecha) e ingresa tu `ADMIN_TOKEN`. El backend lo cambia por una cookie de sesión
   `HttpOnly` y `SameSite=Strict` que dura **8 horas**; el token no se guarda en el navegador. Tras 5 intentos fallidos el
   login se bloquea 1 minuto. La cookie va firmada (no hay sesiones en memoria), así que sobrevive a reinicios del backend y funciona en
   serverless; **cambiar el `ADMIN_TOKEN` cierra todas las sesiones**. Cerrar sesión borra la cookie del navegador, pero una cookie
   copiada seguiría valiendo hasta expirar o hasta cambiar el token.
3. La lista y el detalle cargan los proyectos de Zoho (trato de CRM + proyecto de Projects unidos por folio `KV-AAAA-NNN`):
   cliente y ubicación (de la **cuenta** del trato: `Billing_City` / `Billing_State`, si están capturados), estado de cada compuerta
   (de las tareas G0–G3), cronograma (tareas con fecha de inicio y fin) y observaciones.
4. **Sincronizar una compuerta:** en el detalle, elige la compuerta, el estado nuevo y pulsa **Sincronizar** (pide confirmación).
   Con **Solo simular** no se escribe nada y se muestra la petición. Al liberar una compuerta se muestran avisos (compuertas previas sin
   liberar, hallazgos, expediente no verificable); informan, no bloquean.
5. **Observaciones:** el formulario **Nueva observación** crea una nota en el trato de CRM y el botón **Cerrar** agrega una nota con
   estado `cerrada`. Las observaciones que ves se reconstruyen leyendo esas notas (la más reciente de cada observación define su estado),
   así que no hay base de datos aparte: **Zoho es la fuente de verdad**. No edites a mano el texto de las notas de KairóVolt.

Limitaciones de los datos reales (hoy):

- **El expediente no viene de Zoho.** Documentos, vigencias, checklist por compuerta, hallazgos y carpeta física muestran "no disponible"
  para proyectos de Zoho (queda pendiente WorkDrive). Tampoco hay datos técnicos del sistema FV ni acuerdos semanales (PAER).
- El **portal del cliente** sigue usando datos MOCK.
- Si la cuenta de CRM del trato no tiene ciudad y estado capturados, la ubicación aparece como "—".
- La interfaz **solo sincroniza en modo datos reales**; en MOCK los botones no aparecen, para no escribir en Zoho datos que no son los de la pantalla.

## 9. Adaptar a los campos de IDC: `server/zoho/mapeo.ts`

Es el único archivo que hay que editar. Contiene:

- `folio`: `campoCrm` (api_name de un campo personalizado con el folio; `null` = se extrae del nombre) y `patronEnNombre`.
- `crm.deals / accounts / contacts`: módulo y campos estándar (`Deal_Name`, `Stage`, `Account_Name`, `Billing_City`, `Full_Name`, `Email`…).
  Para un campo personalizado, cambia el valor por su `api_name` (visible en *Configuración → Módulos y campos*).
- `crm.notas`: campos de la nota donde se guardan las observaciones.
- `projects.proyectos / tareas`: campos de Projects y `patronCompuerta` (por defecto, tareas que empiezan con `G0`…`G3`).
- `projects.estadosCompuerta`: qué nombres de estado de Zoho equivalen a cada estado de compuerta, y su `id`. Ya vienen los IDs de
  `pendiente`, `en_revision` y `liberada` de la cuenta de prueba; **cámbialos por los de tu portal real** (`bloqueada` está sin ID).
- `zonaHoraria`: Zoho entrega las fechas en UTC; se convierten a esta zona (`America/Hermosillo`).
- `projects.cuerpoCambioEstado`: forma del cuerpo del `PATCH` que cambia el estado de una tarea.

Consulta el mapeo activo con `GET /api/admin/zoho/mapeo`. Reinicia `npm run dev` tras editarlo.

## 10. Un solo puerto y despliegue

- **Desarrollo:** `npm run dev` sirve la interfaz y la API en el mismo puerto (el backend va montado dentro de Vite). No hay proxy, CORS ni segundo
  proceso. Si tenías `npm run server` corriendo aparte, ya no hace falta. Si hay varios Vite abiertos, cada uno sirve también la API.
  Tras cambiar `server/.env` reinicia `npm run dev`.
- **Producción local:** `npm start` compila (`vite build`) y un solo proceso sirve `dist/` y la API en `http://127.0.0.1:8787` (puerto con `PORT`).
  Solo escucha en loopback; para exponerlo ponlo detrás de un proxy con HTTPS.
- **Vercel (preparado, SIN PROBAR):** `api/index.ts` expone la misma app como función serverless y `vercel.json` redirige `/api/*` a ella y el resto a la SPA.
  Al desplegar:
  1. Carga las variables de `server/.env` como **Environment Variables** del proyecto en Vercel (`.env` no se sube). Define `ADMIN_TOKEN`
     largo y aleatorio.
  2. Las sesiones ya no dependen de memoria, pero el **límite de intentos de login** sí: en serverless protege por instancia, no globalmente.
  3. Cada instancia fría pide un access token nuevo a Zoho, que limita las renovaciones (unas 10 cada 10 minutos). Con poco tráfico no
     debería notarse; con mucho, habría que cachear el token en un almacén compartido.
  4. Verifica el modo de ejecución de las funciones de tu proyecto y que `/api/integracion/estado` responda antes de usar el login.

## Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| `estado: error … invalid_client` | Client ID/Secret incorrectos o datacenter distinto al de la consola |
| `estado: error … invalid_code` / refresh token | Código vencido o ya usado, o refresh token revocado: repite el paso 3 |
| `401/403` de Zoho en `/api/admin/*` | Falta algún scope en el paso 3 |
| Login: "Token incorrecto" | El `ADMIN_TOKEN` escrito no coincide con el de `server/.env` (reinicia `npm run dev` tras editarlo) |
| Login: "Demasiados intentos" | 5 fallos seguidos: espera 1 minuto |
| Pide iniciar sesión de nuevo | La sesión dura 8 h, o cambiaste el `ADMIN_TOKEN` |
| `403 csrf` al escribir con la cookie | La petición no trae la cabecera `X-Requested-With: kairovolt` (la interfaz la envía sola) |
| `404` de Zoho Projects | Ruta o versión de la API de Projects distinta en tu cuenta: ajusta las rutas en `server/zoho/lectura.ts` / `escritura.ts` |
| `advertencias: estado … sin equivalencia` | Agrega el nombre de estado a `estadosCompuerta` en el mapeo |
| `422 estado_sin_id` | Pon el `id` del estado en `estadosCompuerta.<estado>.id` (se ve en el campo `estadoZohoId` de `/api/admin/zoho/proyectos`) |
| Proyecto no aparece | El nombre no empieza con `KV-AAAA-NNN`; cambia `patronEnNombre` o usa `campoCrm` |

El backend nunca devuelve ni registra credenciales ni tokens en sus errores.
