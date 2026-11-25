# Portal del cliente

El cliente entra a `/portal` con el **folio** y un **código de acceso** que genera IDC. Ve su avance, su etapa y el siguiente paso, los documentos que se le piden
(y los sube), las confirmaciones de recepción, avisos y un historial público. Es una experiencia aparte del panel interno: una columna, botones grandes y
navegación inferior (móvil primero).

## Qué NO ve el cliente (garantizado en el backend)

Nada de lo interno: validaciones y discrepancias, observaciones, responsables, PAER/PPC, costos, nombres de actividades, datos de otros clientes, ni
identificadores o credenciales de Zoho. La respuesta de `GET /api/portal/vista` se arma por **lista blanca** (`src/application/portal-cliente.ts`):
cada campo se copia a propósito y los textos son etiquetas fijas (`src/domain/portal/textos.ts`), no texto libre capturado por IDC. Hay pruebas que
serializan la respuesta y buscan valores internos.

## Seguridad: permisos en el backend

| Mecanismo | Detalle |
| --- | --- |
| Acceso | Folio + código de 16 caracteres (~79 bits). El folio solo no basta (son consecutivos). |
| Código | Se muestra **una sola vez** al crearlo. En la base solo se guarda su SHA-256 (`portal_accesos.token_hash`). |
| Errores | Folio o código malos, acceso vencido o revocado: **la misma respuesta** (no revela qué falló). 5 fallos por folio en 1 minuto → 429. |
| Sesión | Cookie `kv_portal` HttpOnly, SameSite=Strict, 2 h, firmada con una clave **distinta** a la del personal. No lleva permisos. |
| Revocación | En cada petición se vuelve a consultar el acceso: revocar o vencer corta la sesión **al instante**, aunque la cookie siga firmada. |
| Alcance | El folio sale **siempre de la sesión**, nunca de la petición. Un cliente no puede pedir el proyecto de otro. |
| Permisos del acceso | `ver_progreso`, `ver_documentos_autorizados`, `subir_documentos` (en `portal_accesos.permisos`). Cada ruta los exige. |
| Separación | La cookie del portal no sirve en `/api/admin/*` y las credenciales del personal no sirven en `/api/portal/*`. |
| Subidas | Solo documentos que se le pidieron al cliente y que admiten envío; PDF/JPG/PNG/WEBP de hasta 10 MB; el tipo se decide por el **contenido** (bytes), no por el nombre; nombre saneado; cabecera anti-CSRF; límite de 20 envíos por 10 min. |
| Almacenamiento | Bucket **privado** `expedientes` de Supabase Storage con la clave secreta del servidor. Nunca enlaces públicos. |

Ocultar un botón en pantalla no es seguridad: la interfaz solo refleja lo que el servidor ya decidió.

## Porcentaje de avance (reglas explícitas, `src/domain/portal/avance.ts`)

1. 4 etapas (G0–G3) con el mismo peso (**supuesto**, por confirmar con IDC).
2. Etapa liberada = 100 %.
3. Etapa no liberada = documentos obligatorios recibidos ÷ obligatorios (hacia abajo), **máximo 95 %**: el 100 % lo da la liberación.
4. Sin expediente en la fuente (p. ej. Zoho): la etapa no se puede medir, cuenta 0 y el avance se marca **aproximado**.
5. Total = promedio ponderado, redondeado. Solo es 100 con las 4 etapas liberadas.

El portal muestra estas reglas al cliente («¿Cómo se calcula mi avance?»).

## Modos

| Modo | Cuándo | Qué pasa |
| --- | --- | --- |
| **DEMO** | Sin Zoho ni Supabase, o `PORTAL_MODO_DEMO=true` | Proyecto de prueba KV-2026-004, todo en memoria, los archivos **no se conservan**. La pantalla de acceso muestra el folio y un código de ejemplo (`DEMO-KV26-004P-ORTL`), que solo funciona en este modo. |
| **Real** | Con Zoho y/o Supabase | El proyecto sale de Zoho (sin expediente: avance aproximado, sin lista de documentos medibles). Accesos y recepciones en Supabase; archivos en el bucket `expedientes`. |

Sin Supabase, los accesos y recepciones viven en memoria y se pierden al reiniciar (el panel interno lo avisa).

## Cómo dar acceso a un cliente

1. Aplica la migración `20261122000007_portal_recepciones.sql` en Supabase.
2. En el panel interno: proyecto → **Resumen → Portal del cliente → Generar acceso** (permiso `gestionar_portal`: administración y coordinación).
3. Copia el **código** o el **enlace directo** (`/portal#folio=…&codigo=…`). El código va en el fragmento `#`: el navegador no lo envía a ningún servidor ni queda en bitácoras, y la pantalla lo borra de la barra al entrar.
4. Para cortar el acceso: **Revocar** en la misma tabla.

Los accesos se crean con el folio del proyecto; si el proyecto no tiene fila en Supabase (`proyectos`), se crea el registro mínimo del folio.

## Qué falta (honesto)

- **Revisión de archivos por el personal:** la tabla `portal_recepciones` ya tiene estados (`recibido` / `aceptado` / `rechazado` con motivo para el cliente), pero **no hay aún pantalla interna** para revisarlos y rechazarlos; hoy se haría directo en Supabase. El portal ya refleja esos estados.
- **Que lo subido cuente en el expediente:** un archivo subido queda «en revisión»; no se agrega solo a los documentos del expediente ni mueve el avance hasta que IDC lo incorpore.
- **Notificaciones por correo/WhatsApp:** los avisos son solo dentro del portal, derivados del estado (no se guarda «leído»).
- **Probado:** el backend y la interfaz en modo demo (navegador y pruebas). **Sin probar en vivo:** los adaptadores de Supabase (accesos y almacenamiento) contra tu proyecto real; están probados con respuestas simuladas y la migración con una base de pruebas.
