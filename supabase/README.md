# Supabase: esquema de KairóVolt

Zoho conserva la operación (tratos, proyectos, compuertas G0–G3, observaciones). Supabase guarda lo que Zoho no tiene: expediente
documental, datos declarados, sistema FV, decisiones humanas, acuerdos PAER, perfiles y auditoría. Se enlazan por **folio** (`KV-2026-004`).

## Archivos

| Archivo | Contenido |
| --- | --- |
| `migrations/…0001_expediente_base.sql` | `proyectos`, `sistemas_fotovoltaicos`, `documentos`, `documento_datos_declarados` |
| `migrations/…0002_catalogos_resoluciones_paer_perfiles.sql` | catálogo de requisitos, resoluciones, aprobaciones G2, PAER, `perfiles` |
| `migrations/…0003_seguridad_portal_auditoria_rls.sql` | funciones de rol, portal (token hasheado), auditoría append-only, RLS y políticas |
| `migrations/…0004_storage_expedientes.sql` | bucket privado `expedientes` y sus políticas |
| `migrations/…0005_grants_api.sql` | `GRANT` a `service_role` / `authenticated` (los proyectos nuevos de Supabase ya no los dan solos; sin esto la API responde `42501 permission denied`) |
| `seed.sql` | proyectos `KV-MOCK-0001` (demo) y `KV-2026-004` |

## Cómo aplicarlo

1. Crea el proyecto en Supabase.
2. **Authentication → Sign In / Providers → desactiva "Allow new users to sign up"** (el personal se crea desde el panel, por invitación).
3. En **SQL Editor** ejecuta, en orden y completos, los 5 archivos de `migrations/` y luego `seed.sql`.
4. **Authentication → Users → Add user** (marca *Auto Confirm*) para el primer administrador. Su perfil nace **inactivo**; actívalo:
   ```sql
   update public.perfiles set rol = 'admin', activo = true where correo = 'tu-correo@ejemplo.com';
   ```
5. **Connect** (arriba en Supabase) → *Transaction pooler* (puerto 6543): copia la cadena a `server/.env`:
   ```
   DATABASE_URL=
   ```
   Para empezar basta con esta variable. `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` y `SUPABASE_JWKS_URL` (los nombres que da Supabase en *Connect*) solo
   harán falta al usar Storage (subir archivos, URLs firmadas) o Supabase Auth; la `sb_secret_…` se salta RLS: solo en el servidor.
   (En proyectos con claves legacy equivalen a `anon` y `service_role`.)

   Con `DATABASE_URL` el backend entra como dueño de la base y **se salta las políticas RLS**: el control de acceso lo hace el
   backend (hoy, el `ADMIN_TOKEN`). Las políticas por rol empiezan a contar cuando los usuarios entren con Supabase Auth.

`SUPABASE_URL` va **sin ruta**: `https://xxxx.supabase.co` (sin `/rest/v1/` ni `/` final).

## Auditoría append-only y límites de confianza

La migración 008 deja la tabla `auditoria_eventos` en solo lectura para el personal autenticado y permite `SELECT, INSERT` al backend con `service_role`. Revoca la RPC pública `registrar_evento_auditoria`; el backend actual registra eventos mediante su adaptador de servidor, sin exponer esa RPC al navegador. Los grants no permiten al rol de servicio actualizar, borrar o truncar filas; además, triggers rechazan `UPDATE`, `DELETE` y `TRUNCATE`.

Esto reduce cambios accidentales y limita el impacto de una credencial de servicio usada por un cliente de API, pero **no convierte PostgreSQL en un almacén WORM**. El propietario de la base, un superusuario o un administrador con capacidad de cambiar esquema/roles puede deshabilitar triggers, cambiar grants o alterar/borrar datos. Una clave `service_role` comprometida también podría insertar eventos falsos, aunque no modificar los ya existentes. Para auditoría regulatoria o evidencia resistente a administradores, se necesita exportación/retención independiente con controles fuera de esta base.

No incluir contraseñas, tokens, secretos, documentos de identidad ni datos personales innecesarios en `detalles`. La clave de servicio solo debe estar disponible en backend y debe rotarse si se expone.

## Catálogo documental canónico (migración 009)

La migración 009 amplía `requisitos_documentales` sin borrar códigos ni documentos existentes. Conserva como filas históricas los registros que aún no tienen equivalencia segura a `tipo_documento`/compuerta; el panel los presenta aparte para revisión de IDC. Las filas mapeadas quedan `validacion_idc = 'pendiente'` hasta que IDC valide el nombre, condición, canal, aportante y compuerta. El portal no resuelve condiciones desconocidas y la liberación real de compuertas queda bloqueada mientras exista un requisito activo mapeado sin validar. El catálogo demo solo se usa en modo DEMO explícito/aislado.

`ejemplos_autorizados` se deja vacío y `generacion_automatica` en falso; la migración no constituye aprobación jurídica ni de CFE. Revisa los registros y marca `validacion_idc = 'validado'` únicamente tras aprobación documentada de IDC.

## Acceso al panel y usuarios

**Login:** correo y contraseña de Supabase Auth (requiere `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` en `server/.env`).
El navegador manda el correo y la contraseña **solo** a nuestro backend (en el cuerpo del POST). El backend las valida con Supabase usando la clave
publicable, **descarta los tokens de Supabase** (no se guardan ni en el servidor ni en el navegador) y entrega una cookie `HttpOnly` y `SameSite=Strict`
de 8 horas, firmada, que solo lleva el id del usuario. Tras 5 fallos seguidos, ese correo se bloquea 1 minuto (los demás no se afectan).
Una cuenta sin perfil o inactiva no entra aunque la contraseña sea correcta.

**Rol en vivo:** la cookie no lleva el rol; el backend consulta el perfil en cada petición (caché de 15 s). Desactivar a alguien o cambiarle el rol
surte efecto en segundos, sin esperar a que expire su sesión.

**Permisos (los exige el backend en cada ruta; la interfaz solo oculta lo que no puedes hacer):**

| Acción | Admin | Coordinación | Proyectista | Supervisor | Consulta |
| --- | --- | --- | --- | --- | --- |
| Ver proyectos y datos | Sí | Sí | Sí | Sí | Sí |
| Sincronizar compuertas y observaciones con Zoho | Sí | Sí | Sí | No | No |
| Descubrir módulos/portales de Zoho (diagnóstico) | Sí | No | No | No | No |
| Gestionar usuarios | Sí | No | No | No | No |

La matriz está en `src/domain/usuarios/permisos.ts`. Quién puede escribir en Zoho es un **supuesto** por confirmar con IDC.

**Usuarios:** el menú **Usuarios** (solo administradores) crea personal (correo, nombre, rol y contraseña; hay botón **Generar**), cambia roles y
activa o desactiva. Crea el usuario en Supabase Auth (que guarda solo el hash bcrypt) y su fila en `perfiles`; si falla el perfil, deshace el alta.
Un administrador no puede desactivarse ni quitarse el rol a sí mismo. Requiere haber aplicado el parche SQL de las correcciones (abajo).

**Auditoría** (`auditoria_eventos`, sin contraseñas ni tokens): altas y cambios de usuarios, y cada envío **real** a Zoho (compuerta u observación), a
nombre del usuario que lo hizo (`actor_user_id`).

**Token de emergencia:** si `ADMIN_TOKEN` sigue definido, también sirve (pantalla de acceso, opción de emergencia, y `Authorization: Bearer` para scripts)
y equivale a administrador. Quítalo de `server/.env` cuando ya no lo necesites: el login por correo sigue funcionando. Opcionalmente define
`SESSION_SECRET` para firmar las cookies con una clave propia (si no, se deriva de `ADMIN_TOKEN` o de la clave secreta de Supabase; cambiarla cierra todas las sesiones).

## Recuperar y cambiar la contraseña

- **¿Olvidaste tu contraseña?** (pantalla de acceso) → el backend le pide a Supabase que envíe el correo; la respuesta es la misma exista o no la cuenta,
  y hay un límite de 3 envíos por correo cada 10 minutos. El enlace lleva a `/restablecer`, que lee el token temporal del fragmento de la URL, **lo borra de la
  barra de direcciones y del historial**, y lo manda una sola vez al backend junto con la contraseña nueva (mínimo 12 caracteres, letras y números).
  El token es de un solo uso y vence; no se guarda en ningún lado.
- **Mi cuenta** (clic en tu nombre arriba) → cambiar la contraseña exigiendo la actual (límite de 5 intentos por minuto por cuenta; el cambio queda en la auditoría sin contraseñas).
- Cambiar la contraseña **no cierra** las sesiones ya abiertas (la cookie no depende de ella). Para cerrar todas, cambia `SESSION_SECRET`.

### Configuración necesaria en el panel de Supabase

1. **Authentication → URL Configuration**
   - *Site URL*: la URL de la app (en desarrollo, `http://localhost:5176`; en producción, tu dominio).
   - *Redirect URLs*: agrega `http://localhost:*/restablecer` (desarrollo) y `https://TU-DOMINIO/restablecer` (producción). Si falta, el enlace del correo no llega a la pantalla correcta.
   - Opcional: `APP_URL=https://TU-DOMINIO` en `server/.env` para fijar la URL que se usa en los enlaces (si no, se toma del origen de la petición).
2. **Authentication → Emails → SMTP Settings** (envío de correos con tu propio servidor; sin esto Supabase usa un servidor de pruebas con muy pocos envíos por hora,
   y solo a miembros del equipo del proyecto). Con Gmail: host `smtp.gmail.com`, puerto `465`, usuario = el correo, contraseña = una **contraseña de aplicación**
   (Cuenta de Google → Seguridad → Contraseñas de aplicaciones; requiere verificación en dos pasos) y remitente = ese mismo correo. Gmail permite unos 500 correos al día.
   Esas credenciales se escriben **solo en el panel de Supabase**, no en `server/.env` ni en el chat.
3. **Authentication → Emails → Templates**: puedes traducir el correo "Reset Password" al español; el enlace debe seguir usando `{{ .ConfirmationURL }}`.


## Correcciones al SQL original (marcadas `CORRECCION KV` en los archivos)

Verificadas ejecutando las migraciones en un Postgres real (46 comprobaciones: constraints, RLS por rol, auditoría y Storage):

1. **El perfil nace inactivo.** Con `activo = true`, cualquiera que se registrara con `signUp` (la anon key es pública) quedaba como personal con lectura de todos los expedientes.
2. **`protect_profile_role` bloqueaba al backend y al SQL Editor.** Sin `auth.uid()` el rol salía `NULL` y no se podía asignar ni el primer admin. Ahora la restricción aplica solo a usuarios autenticados de la app.
3. **Auditoría: se quitó la FK a `auth.users`.** `on delete set null` hace un `UPDATE` interno que el trigger append-only rechaza, así que no se podía borrar ningún usuario con eventos.
4. **Folio:** se agregó el patrón `^KV-(AAAA|MOCK)-NNN+$` (el que valida el backend).
5. **Semilla:** `KV-2026-004` queda con `uvie_antes_de_ingreso = false`. El original ponía `true` con una justificación de fechas que no salió de los datos del proyecto; es una regla por Zona de Distribución, por confirmar con IDC.

## Lo que NO coincide todavía con el código (decidir antes de conectar)

- **Catálogo de requisitos:** los 21 de la semilla son otros distintos de los 21 del código (`TipoDocumento`, con `compuerta`, `canal`, `requiere_vigencia`, `aporta_cliente`, `reubicable_por_zona`). `documentos` no tiene `tipo`, solo `requisito_codigo`. Hay que alinear una de las dos partes.
- **Acuerdos PAER:** el SQL usa `semana_inicio`, estados `pendiente|en_progreso|cumplido|no_cumplido|cancelado` y `responsable_id` (usuario); el código usa `semana`, `completada|pendiente|no_realizada` y responsable de texto.
- **`consumo_kwh_mes`** se guarda como texto (`valor_texto`); el código espera número.
- **Resoluciones:** se registran por dato de un documento; el código identifica los hallazgos por clave (`discrepancia:<campo>`).
- Faltan el expediente y los acuerdos de demostración de `KV-MOCK-0001` y los append-only de `resoluciones_documentales` y `aprobaciones_checklist_g2`.
- **El backend aún no usa Supabase**: esto deja la base lista; no hay código que la consulte.
