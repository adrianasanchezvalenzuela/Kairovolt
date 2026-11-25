# Parte 02 — Supabase: esquema, RLS, Storage, auditoría, autenticación y portal

> **Alcance de la verificación.** **[NO-VERIFICABLE] contra tu proyecto real.** Todo lo de esta parte sale de las 7 migraciones en `supabase/migrations/` (leídas completas) y de ejecutarlas en un **Postgres de pruebas en memoria (PGlite)** con roles simulados **[V-EJEC]**. Los scripts de esa verificación están **fuera del repositorio** (carpeta temporal de la sesión): ver hallazgo A-11.
> Tampoco pude confirmar qué migraciones están aplicadas en tu base. Por lo que me dijiste: la 006 sí; la **007 no existía hasta la Fase 7 → probablemente no aplicada**.

## 4.1 Tablas (14 + 1 vista)

Mapa de uso real en la aplicación (búsqueda en `src/` y `server/`) **[V-CÓDIGO]**:

| Tabla | Migración | ¿Qué código la usa? |
| --- | --- | --- |
| `proyectos` | 001 | `server/portal/supabase.ts` (crea la fila mínima del folio al generar un acceso). Nada más. |
| `sistemas_fotovoltaicos` | 001 | **Nadie.** |
| `documentos` | 001 | **Nadie** (el código usa su propio modelo `DocumentoExpediente` en memoria). |
| `documento_datos_declarados` | 001 | **Nadie.** |
| `requisitos_documentales` | 002 | **Nadie** (el catálogo que usa la app está en `src/data/catalogo-requisitos.mock.ts`). |
| `resoluciones_documentales` | 002 | **Nadie.** |
| `aprobaciones_checklist_g2` | 002 | **Nadie.** |
| `acuerdos_paer` / vista `v_paer_semanal` | 002 | **Nadie.** |
| `perfiles` | 002 | `server/supabase/{perfiles,usuarios,login}.ts`, `server/app.ts` (login, roles, gestión de usuarios). |
| `portal_accesos` | 003 | `server/portal/supabase.ts`. |
| `auditoria_eventos` | 003 | `server/supabase/auditoria.ts` (`registrarEvento`, vía REST con clave secreta). |
| `sincronizaciones` | 006 | `server/integracion/supabase.ts`. |
| `referencias_externas` | 006 | `server/integracion/supabase.ts`. |
| `portal_recepciones` | 007 | `server/portal/supabase.ts`. |

**Conclusión:** de las 14 tablas, **7 están creadas pero sin ningún consumidor** (más la vista `v_paer_semanal`): las del expediente documental, datos técnicos, catálogo, decisiones, G2 y PAER. El requisito «Supabase conserva el expediente» está **modelado en SQL, no integrado en la aplicación**.

### Detalle por tabla (columnas reales)

#### `proyectos` (001)
`id uuid PK default gen_random_uuid()` · `folio text NOT NULL UNIQUE` · `es_demo boolean NOT NULL default false` · `uvie_antes_de_ingreso boolean NOT NULL default false` · `created_at`, `updated_at timestamptz NOT NULL default now()` (trigger `set_updated_at`).
Constraints: `proyectos_folio_formato_chk` (`folio = upper(folio)`), `proyectos_folio_no_vacio_chk`, `proyectos_folio_patron_chk` (`folio ~ '^KV-([0-9]{4}|MOCK)-[0-9]{3,}$'`). Índice: `proyectos_es_demo_idx`.
✔ Es el «proyecto mínimo enlazado por folio» pedido; **no duplica** compuertas, observaciones ni tratos de Zoho. `es_demo` y `uvie_antes_de_ingreso` existen. **[V-EJEC]** rechaza folios en minúscula/ inválidos y acepta `KV-2026-010`.

#### `sistemas_fotovoltaicos` (001)
`id uuid PK` · `proyecto_id uuid NOT NULL UNIQUE → proyectos(id) ON DELETE CASCADE` · `numero_paneles integer` · `potencia_panel_w numeric(10,2)` · `potencia_ac_kw numeric(10,2)` · `numero_inversores integer` · `marca_inversor text` · `potencia_inversor_kw numeric(10,2)` · `transformador_kva numeric(10,2)` · `created_at`, `updated_at`.
CHECK `>= 0 OR NULL` en cada numérico. ✔ Los 7 campos técnicos esperados existen, **todos nullables**, **sin columna de potencia DC** (correcto: no se guarda el valor calculado).
⚠ **Faltan columnas que el motor de reglas necesita** (`ConfiguracionTecnica` en `src/domain/entidades/configuracion-tecnica.ts`): nivel de tensión, modelo de panel, modelo de inversor, RPU, coordenadas, configuración de strings, potencia DC **declarada**, generación estimada, datos de ficha (Voc, coeficiente, Vdc máx). Hoy esa configuración existe solo en memoria (demo). Ver C-3.

#### `documentos` (001 + FK en 002)
`id uuid PK` · `proyecto_id uuid NOT NULL → proyectos ON DELETE CASCADE` · `requisito_codigo text NOT NULL → requisitos_documentales(codigo) ON UPDATE CASCADE ON DELETE RESTRICT` · `nombre_archivo text NOT NULL` · `storage_bucket text NOT NULL default 'expedientes'` · `storage_path text NOT NULL` · `mime_type text` · `tamano_bytes bigint` · `fecha_emision date` · `fecha_vigencia date` · `version integer NOT NULL default 1` · `documento_sustituye_id uuid → documentos(id) ON DELETE SET NULL` · `uploaded_by uuid → auth.users(id) ON DELETE SET NULL` · `created_at`, `updated_at`.
Constraints: nombre/requisito/path no vacíos, `tamano_bytes >= 0`, `version >= 1`, `UNIQUE (storage_bucket, storage_path)`. Índices: proyecto, requisito, fecha_vigencia, created_at desc.
✔ **Documentos múltiples por requisito** (no hay unicidad por proyecto+requisito; hay `version` y `documento_sustituye_id`). ✔ **Fechas de emisión y vigencia aceptan NULL.**
⚠ No hay constraint que obligue a que `storage_path` empiece con el folio del proyecto (la política de Storage sí lo exige; ver §4.9). ⚠ Los archivos que suben los clientes por el portal **no crean filas aquí** (van a `portal_recepciones`): quedan en el bucket sin fila en `documentos`.

#### `documento_datos_declarados` (001)
`id uuid PK` · `documento_id uuid NOT NULL → documentos ON DELETE CASCADE` · `campo text NOT NULL` · `declarado boolean NOT NULL` · `valor_texto text` · `created_at`, `updated_at`.
Constraints: `UNIQUE (documento_id, campo)`; `documento_dato_estado_chk`: `(declarado = false AND valor_texto IS NULL) OR (declarado = true AND valor_texto IS NOT NULL)`; **`documento_dato_campo_chk`: `campo IN ('nivel_tension','modelo_modulo','consumo_kwh_mes','coordenadas_croquis','referencia_croquis')`** (solo 5).
**Semántica solicitada vs implementada** **[V-EJEC]**:

| Caso | Implementación | ¿Correcto? |
| --- | --- | --- |
| No declarado | `declarado=false`, `valor_texto=NULL` | ✔ permitido |
| Declarado vacío | `declarado=true`, `valor_texto=''` | ✔ permitido |
| Declarado con valor | `declarado=true`, `valor_texto='valor'` | ✔ permitido |
| No declarado con valor / declarado con NULL | rechazados | ✔ |
| Mismo campo dos veces en un documento | rechazado | ✔ |

⚠ El motor del código maneja **13 campos** (`CAMPOS` en `src/domain/validacion/campos.ts`): `modelo_inversor`, `numero_paneles`, `potencia_dc_kwp`, `potencia_ac_kw`, `configuracion_strings`, `rpu`, `ubicacion`, `generacion_kwh_mes` **no caben** en el CHECK de 5. ⚠ `consumo_kwh_mes` se guarda como **texto** (`valor_texto`) pero el código lo compara como número (tolerancias, orden de magnitud): requiere conversión explícita.
En el código la semántica equivale a: entrada ausente = no declarado; `valor: null | ''` = declarado vacío.

#### `requisitos_documentales` (002)
`id uuid PK` · `codigo text NOT NULL UNIQUE` (CHECK `= upper`) · `nombre text NOT NULL` · `descripcion text` · `categoria text NOT NULL` (CHECK ∈ `solicitud, cliente, tecnico, instalacion, legal, dictamen`) · `obligatorio boolean NOT NULL default true` · `condicion text` · `activo boolean NOT NULL default true` · `orden integer NOT NULL default 0` · `created_at`, `updated_at`. CHECK `obligatorio = true OR condicion IS NOT NULL`. Índice `(activo, orden)`.
Catálogo **editable** ✔ (INSERT/UPDATE por admin y coordinación). **No tiene** columnas de compuerta (G0–G3), canal (digital/físico), vigencia requerida ni «lo aporta el cliente» — que el código sí usa. Ver §4.3 y C-3.

#### `resoluciones_documentales` (002)
`id uuid PK` · `documento_dato_id uuid NOT NULL → documento_datos_declarados ON DELETE RESTRICT` · `decision text NOT NULL` (CHECK ∈ `aceptado, correccion_requerida, no_aplica`) · `valor_resuelto text` · `motivo text NOT NULL` (no vacío) · `evidencia_documento_id uuid → documentos ON DELETE SET NULL` · `resuelto_por uuid NOT NULL → auth.users ON DELETE RESTRICT` · `resuelto_at timestamptz NOT NULL default now()` · `created_at`. Índices: dato, resuelto_at desc.
✔ Responsable, fecha, evidencia y motivo existen; **append-only por falta de políticas/grants de UPDATE/DELETE** (no por trigger: el `service_role` sí podría modificarla). ⚠ Cuelga de un **dato declarado concreto**, mientras el motor identifica los hallazgos por `huella` (`CRU-001:nivel_tension:*`); y el motor tiene 3 tipos de resolución distintos (`corregido`, `aceptado_con_justificacion`, `no_aplica`). Ver C-3. **No duplica** las observaciones de Zoho (no guarda descripción de la observación).

#### `aprobaciones_checklist_g2` (002)
`id uuid PK` · `proyecto_id → proyectos ON DELETE RESTRICT` · `version_checklist integer NOT NULL default 1 (>=1)` · `resultado text NOT NULL` (∈ `aprobado, rechazado`) · `checklist_snapshot jsonb NOT NULL` (CHECK objeto) · `comentarios text` · `aprobado_por uuid NOT NULL → auth.users ON DELETE RESTRICT` · `aprobado_at timestamptz NOT NULL default now()` · `created_at`. Índice `(proyecto_id, aprobado_at desc)`.
✔ Snapshot, responsable y fecha. Append-only como la anterior. **No duplica** compuertas de Zoho (es un registro de aprobación del checklist). Hoy el código maneja «aprobaciones» de **cualquier** compuerta (G0–G3) en el navegador, no solo G2.

#### `acuerdos_paer` (002) y vista `v_paer_semanal`
`id uuid PK` · `proyecto_id → proyectos ON DELETE RESTRICT` · `semana_inicio date NOT NULL` · `acuerdo text NOT NULL` (no vacío) · `responsable_id uuid → auth.users ON DELETE SET NULL` · `fecha_compromiso date` · `estado text NOT NULL default 'pendiente'` (∈ `pendiente, en_progreso, cumplido, no_cumplido, cancelado`) · `resultado text` · `registrado_por uuid NOT NULL → auth.users ON DELETE RESTRICT` · `registrado_at` · `updated_at`. `UNIQUE (proyecto_id, semana_inicio, acuerdo)`. Índices: semana, (responsable_id, estado).
✔ Tiene proyecto, semana, acuerdo, responsable, fecha compromiso, estado, resultado y quién registró.
**Vista** `v_paer_semanal` `WITH (security_invoker = true)` ✔: une `acuerdos_paer` con `proyectos` y devuelve `folio, es_demo, acuerdo_id, semana_inicio, acuerdo, responsable_id, fecha_compromiso, estado, resultado, registrado_at, updated_at`. **No calcula el porcentaje**; sirve para listar acuerdos por semana. `GRANT SELECT` a `authenticated`. **Ninguna pantalla la usa.**
⚠ Desajuste con el código (`AccionAcordada`): semana (`semana` ISO), responsable como **texto**, estados `completada|pendiente|no_realizada`. El cálculo de PAER (`calcularPaer`) cuenta `completada` ≠ `cumplido`. Ver M-12.

#### `perfiles` (002)
`id uuid PK → auth.users ON DELETE CASCADE` · `nombre_completo text` · `correo text` · `rol text NOT NULL default 'consulta'` (CHECK ∈ los 5 roles) · `activo boolean NOT NULL default true` · `created_at`, `updated_at`. Índices: rol, activo.
Trigger `on_auth_user_created` (AFTER INSERT en `auth.users`) → `handle_new_auth_user()` **SECURITY DEFINER, `search_path=''`**: crea el perfil con **`rol='consulta'`, `activo=false`** ✔ **[V-EJEC]** (todo usuario nuevo nace inactivo).
⚠ `activo` tiene `default true` en la tabla pero el trigger siempre inserta `false` (si alguien inserta un perfil a mano sin `activo`, nace activo).

#### `portal_accesos` (003)
`id uuid PK` · `proyecto_id → proyectos ON DELETE CASCADE` · `token_hash text NOT NULL UNIQUE` (CHECK `~ '^[a-f0-9]{64}$'`) · `permisos jsonb NOT NULL default '{"ver_progreso":true,"ver_documentos_autorizados":true,"subir_documentos":false}'` (CHECK objeto) · `activo boolean NOT NULL default true` · `expira_at timestamptz NOT NULL` (CHECK `> created_at`) · `revocado_at` · `revocado_por → auth.users ON DELETE SET NULL` · `ultimo_uso_at` · `created_by → auth.users ON DELETE SET NULL` · `created_at`. Índices: `(proyecto_id)`, `(activo, expira_at)`, unique `token_hash`.
RLS activada **sin ninguna política**; sin GRANT a `authenticated` (reforzado en 007) → solo `service_role` **[V-EJEC]** ni siquiera un admin la lee desde el cliente.

#### `auditoria_eventos` (003)
`id uuid PK` · `actor_user_id uuid` (**sin FK**, a propósito) · `origen text NOT NULL` (∈ `app, zoho, system, storage, portal`) · `entidad text NOT NULL` · `entidad_id uuid` · `folio text` · `accion text NOT NULL` · `detalles jsonb NOT NULL default '{}'` (CHECK objeto) · `external_event_id text` · `created_at`.
Índices: **único parcial** `(origen, external_event_id) WHERE external_event_id IS NOT NULL` (idempotencia de eventos de Zoho ✔ **[V-EJEC]**), `(folio, created_at desc)`, `(entidad, entidad_id, created_at desc)`, `(actor_user_id, created_at desc)`.
Triggers `auditoria_no_update` / `auditoria_no_delete` (función `prevent_audit_mutation`) ✔. Detalle en §4.6.

#### `sincronizaciones` (006) — añadida en la Fase 3
`id uuid PK` · `clave text NOT NULL` · `folio text NOT NULL` (CHECK upper) · `destino` ∈ `crm, projects, workdrive` · `operacion text` · `estado` ∈ `ok, error, omitido` · `accion` ∈ `creado, actualizado, sin_cambios, simulado, nueva_version` (nullable) · `id_externo` · `error` (≤300) · `categoria_error` · `intentos int ≥ 1` · `creado_en`. Índices: `(clave) WHERE estado='ok'`, `(folio, creado_en desc)`, `(creado_en desc)`. Triggers append-only (reusan `prevent_audit_mutation`).
Es **bitácora técnica** de la integración (no duplica datos operativos de Zoho: guarda ids externos y resultado).

#### `referencias_externas` (006)
PK `(folio, sistema, tipo)` · `id_externo` · `url` · `actualizado_en` (trigger). `sistema` ∈ `zoho_crm, zoho_projects, zoho_workdrive`. Enlaza folio → id de trato/proyecto/carpeta. Legítima: **referencia, no copia**.

#### `portal_recepciones` (007) — añadida en la Fase 7
`id uuid PK` · `recibo text NOT NULL UNIQUE` (CHECK `~ '^REC-[0-9A-F]{6}$'`) · `folio` · `acceso_id → portal_accesos ON DELETE SET NULL` · `documento_id text` (tipo de requisito) · `documento_nombre` · `archivo_nombre (≤120)` · `mime` ∈ 4 tipos · `tamano_bytes (1…20 MB)` · `sha256 (hex 64)` · `ruta_almacen` · `estado` ∈ `recibido, aceptado, rechazado` (default `recibido`) · `motivo_rechazo (≤500; obligatorio si rechazado)` · `revisado_por → auth.users` · `revisado_en` · `creado_en`. **[V-EJEC]** constraints verificados.

### ¿Duplicación o información que debería vivir en Zoho?

- **No encontré** tablas que dupliquen tratos, proyectos operativos, G0–G3 ni observaciones de Zoho **[V-CÓDIGO]**. Las tablas de decisiones guardan *decisiones humanas*, no copias.
- Posible solapamiento a vigilar: `aprobaciones_checklist_g2` (aprobación documental) vs la **liberación de compuerta** que vive en Zoho Projects; el código actual registra «aprobado por X» en el navegador y escribe el **estado** en Zoho. Definir qué dato es la fuente de verdad de «quién liberó G2» (ver A-6).
- `proyectos` guarda solo `folio`: ✔.

## 4.3 Catálogo documental: los 21 requisitos de Supabase **[V-EJEC]** (21 filas en el seed; 6 obligatorios)

| # | Código | Nombre | Categoría | Obligatorio | Condición (resumen) |
| --- | --- | --- | --- | --- | --- |
| 1 | `SOLICITUD_INTERCONEXION` | Solicitud de interconexión | solicitud | **Sí** | — |
| 2 | `RECIBO_CFE` | Recibo de energía eléctrica | cliente | **Sí** | — |
| 3 | `IDENTIFICACION_TITULAR` | Identificación oficial del titular | cliente | **Sí** | — |
| 4 | `CONSTANCIA_FISCAL` | Constancia de situación fiscal | cliente | No | Cuando el trámite o modalidad solicite información fiscal |
| 5 | `ACREDITACION_REPRESENTACION` | Acreditación de representación legal | legal | No | Cuando tramita una persona distinta del titular/representante acreditado |
| 6 | `IDENTIFICACION_REPRESENTANTE` | Identificación del representante | cliente | No | Cuando existe representante o apoderado |
| 7 | `IDENTIFICACIONES_TESTIGOS` | Identificaciones de testigos | cliente | No | Solo si el instrumento de representación las solicita |
| 8 | `CROQUIS_UBICACION` | Croquis de ubicación | tecnico | **Sí** | — |
| 9 | `DIAGRAMA_UNIFILAR` | Diagrama unifilar | tecnico | **Sí** | — |
| 10 | `MEMORIA_CALCULO` | Memoria de cálculo | tecnico | **Sí** | — |
| 11 | `FICHA_MODULOS` | Ficha técnica de módulos FV | tecnico | No | Proyectos con módulos FV |
| 12 | `CERTIFICADO_MODULOS` | Certificado de módulos FV | tecnico | No | Cuando la regulación/procedimiento lo solicite |
| 13 | `FICHA_INVERSOR` | Ficha técnica de inversor | tecnico | No | Proyectos con inversores |
| 14 | `CERTIFICADO_INVERSOR` | Certificado de inversor | tecnico | No | Cuando la regulación/procedimiento lo solicite |
| 15 | `FOTOGRAFIAS_SISTEMA` | Fotografías generales del sistema | instalacion | No | Cuando el procedimiento/revisión lo solicite |
| 16 | `FOTOGRAFIAS_TABLERO` | Fotografías de tablero eléctrico | instalacion | No | Ídem |
| 17 | `FOTOGRAFIAS_MODULOS` | Fotografías de módulos instalados | instalacion | No | Ídem |
| 18 | `DICTAMEN_UVIE` | Dictamen de UVIE | dictamen | No | Depende de modalidad, alcance y requisitos normativos |
| 19 | `PLANOS_INSTALACION` | Planos de instalación | tecnico | No | Según alcance y documentación solicitada |
| 20 | `ACREDITACION_PROPIEDAD` | Acreditación de propiedad o posesión | legal | No | Cuando el procedimiento pida acreditar propiedad/posesión |
| 21 | `AUTORIZACION_PROPIETARIO` | Autorización del propietario | legal | No | Cuando el solicitante no es propietario |

- Todos `activo = true`, `orden` 1–21. No hay duplicados de código (UNIQUE) ni requisitos huérfanos de la FK. **«No todos son obligatorios para todos los trámites» ✔ respetado** (15 de 21 son condicionales y exigen `condicion`).
- **Quién lo usa:** nadie en código (ver §4.1).

### ⚠ Segundo catálogo (el que SÍ usa la aplicación) — **no coincide**
`src/data/catalogo-requisitos.mock.ts` define **otros 21 requisitos**, con tipos distintos (`consulta_capacidad_mt`, `recibo_cfe`, `datos_preliminares`, `identificacion_oficial`, `constancia_situacion_fiscal`, `carta_poder`, `acta_constitutiva`, `croquis`, `diagrama_unifilar`, `memoria_calculo`, `ficha_tecnica`, `certificado`, `solicitud`, `evidencia_fotografica`, `checklist_consistencia`, `dictamen_uvie`, `certificado_uiie`, `oficio_resolutivo`, `contrato_interconexion`, `contrato_contraprestacion`, `medidor_bidireccional`), **asignados a G0–G3**, con canal digital/físico, vigencia requerida, «lo aporta el cliente» y regla por zona UVIE.
Coinciden por nombre aproximado ~8 (solicitud, recibo, identificación, croquis, unifilar, memoria, ficha, dictamen UVIE); los demás no tienen equivalente (p. ej. el código tiene `consulta_capacidad_mt`, contratos CFE, oficio resolutivo; la BD tiene fotografías separadas, planos, autorizaciones).
`supabase/README.md` ya lo advertía. **Hay que decidir cuál es el canónico** y migrar el otro (C-3).

## 4.4 Resoluciones y checklist G2

Ver `resoluciones_documentales` y `aprobaciones_checklist_g2` arriba. Estado real: **tablas listas, sin uso**. Lo que la interfaz hace hoy en su lugar (Fase 6): `registrarObservacion/asignarResponsable/registrarResolucion/registrarCambioCompuerta` en `src/application/decisiones.ts` producen eventos y estados que se guardan en **`localStorage`** (`src/infrastructure/decisiones-local.ts`, clave `kairovolt:decisiones:<FOLIO>`): responsable, fecha, justificación, evidencia (`evidenciaDocumentoId`), historial local de eventos y aprobación de compuertas (quién y cuándo). **No hay snapshot del checklist** ni persistencia compartida.

## 4.5 PAER

Tabla y vista descritas arriba. Estado real: la pantalla Indicadores y el KPI de PAER usan `AccionAcordada[]` **del caso demostrativo** (`kv-2026-004.demo.ts`). Con datos de Zoho `acciones` es siempre `[]` (`server/zoho/adaptar.ts`) → **PAER = «sin acciones»**. No hay formulario para registrar acuerdos semanales.

## 4.6 Auditoría

| Pregunta | Respuesta **[V-EJEC]** salvo nota |
| --- | --- |
| Origen, usuario, entidad, folio, acción, detalles JSON, id externo | ✔ columnas presentes. |
| Índices | ✔ (ver arriba). |
| Bloqueo de UPDATE y DELETE | ✔ triggers por fila: UPDATE y DELETE fallan incluso para `service_role`. |
| Registro desde la aplicación | ✔ RPC `registrar_evento_auditoria(...)` (SECURITY DEFINER) fija `actor_user_id = auth.uid()` y `origen='app'`; exige perfil activo. **El backend no usa la RPC**: escribe directo con la clave secreta (`server/supabase/auditoria.ts`), con `origen='app'` y el actor en `detalles.actor`/`actor_user_id`. |
| Registro desde Zoho | ⚠ El índice de idempotencia existe y se verificó con SQL, pero **no hay webhook ni código que escriba eventos con `origen='zoho'`**. |
| Prevención de duplicados | ✔ solo para eventos con `external_event_id`. |
| ¿Puede alterarse por una ruta alternativa? | **Sí, dos hallazgos:** (1) `TRUNCATE public.auditoria_eventos` **funciona con `service_role`** (los triggers por fila no se disparan en TRUNCATE y `005` otorga `ALL` a `service_role`); un admin autenticado **no** puede. (2) La RPC deja que **cualquier usuario activo, incluso `consulta`**, escriba eventos con `entidad`, `accion` y `detalles` arbitrarios (suplantación/contaminación del registro). Además el dueño de la tabla/SQL Editor puede `ALTER TABLE … DISABLE TRIGGER`. (A-3) |
| ¿Qué se audita hoy? | Altas/cambios de usuarios, cambio de contraseña, **escrituras reales** a Zoho (compuerta/observación), generación/revocación de accesos del portal. **No se auditan**: decisiones locales, subidas del portal (quedan en `portal_recepciones`), simulaciones, inicios de sesión. |

## 4.7 Autenticación y permisos

| Tema | Estado | Evidencia |
| --- | --- | --- |
| Supabase Auth, inicio de sesión | **COMPLETA** (probada con Supabase simulado) | `server/supabase/login.ts`, `server/auth.test.ts` (21 pruebas). Contra Supabase real: **[NO-VERIFICABLE]** (en fases anteriores la usó el dueño). |
| Registro de usuarios | No hay pantalla de registro. El personal se crea desde **Usuarios** (solo admin) con la clave secreta. Que el *signup público* de Supabase esté apagado **[NO-VERIFICABLE]**; si estuviera abierto, los nuevos usuarios nacen **inactivos** (verificado en SQL). |
| Cierre de sesión | Borra la cookie; **sin revocación server-side** (cookie copiada vale hasta 8 h). |
| Recuperación de contraseña | `POST /api/recuperar` → Supabase envía el correo (respuesta idéntica exista o no la cuenta; 3 por correo/10 min); `/restablecer` consume el token del fragmento `#`. Entrega real del correo: **[NO-VERIFICABLE]** (SMTP/Redirect URLs son del panel). |
| Confirmación de correo | No usada (los usuarios se crean confirmados por el backend). |
| Persistencia de sesión | Cookie HttpOnly, SameSite=Strict, 8 h, solo `uid`; **sin atributo `Secure`** (A-4). |
| Protección de rutas | **En el backend** (401/403 por ruta). El cliente no redirige: sin sesión muestra datos MOCK. |
| Redirección tras login | `Acceso.tsx` → `Navigate to="/"`. |
| Creación automática del perfil | ✔ trigger (activo=false, rol=consulta). |
| Asignación de roles | Solo `admin` (UI Usuarios + backend; trigger `protect_profile_role` + política `perfiles_update_admin`). |
| Desactivación | ✔ `activo=false` → el backend lo ve en ≤15 s (caché) y deniega. Un admin no puede desactivarse/degradarse a sí mismo (backend). |
| Primer administrador | **No hay mecanismo propio**: (a) `UPDATE public.perfiles SET rol='admin', activo=true WHERE correo=…` en el SQL Editor (`supabase/README.md`); o (b) entrar con `ADMIN_TOKEN` y crear el admin en Usuarios. Ambos son seguros si el token se retira después. |

### Qué puede hacer cada rol

**Matriz del backend** (`src/domain/usuarios/permisos.ts`, exigida en cada ruta) — *el cuadro «supuesto, por confirmar con IDC» aplica a casi todas las filas*:

| Acción (código) | admin | coordinación | proyectista | supervisor_campo | consulta |
| --- | :-: | :-: | :-: | :-: | :-: |
| `ver_datos` (leer proyectos) | ✔ | ✔ | ✔ | ✔ | ✔ |
| `sincronizar_zoho` (escribir compuerta/observación en Zoho; simular/ver bitácora) | ✔ | ✔ | ✔ | — | — |
| `descubrir_zoho` (módulos, portales) | ✔ | — | — | — | — |
| `gestionar_usuarios` | ✔ | — | — | — | — |
| `aprobar_excepciones` | ✔ | ✔ | — | — | — |
| `gestionar_validaciones` (observaciones, responsables, resoluciones) | ✔ | ✔ | ✔ | — | — |
| `liberar_compuertas` | ✔ | ✔ | — | — | — |
| `gestionar_portal` (generar/revocar accesos del cliente) | ✔ | ✔ | — | — | — |

Nota: `gestionar_validaciones`, `aprobar_excepciones` y `liberar_compuertas` **solo se comprueban en la interfaz y en el dominio del navegador**, porque esas decisiones son locales (no existe ruta de backend que las reciba). Cuando se escriba al backend/BD deberán exigirse allí (A-1).

**Matriz de RLS** (lo que permite la base si alguien llegara con un JWT de usuario): ver §5.

### «Un usuario no puede cambiarse el rol» **[V-EJEC]**
- Por navegador: la app no ofrece esa acción salvo a admin (`/api/admin/usuarios/:id` exige `gestionar_usuarios`).
- Petición directa a PostgREST con su JWT: `perfiles_update_admin` solo deja a `admin`; un usuario `consulta` que intenta actualizar su fila afecta **0 filas**; y el trigger `perfiles_protect_role` lanza «No tienes permiso para cambiar roles» si lograra el UPDATE. Verificado: «un usuario NO puede subirse el rol a admin».
- Excepción deliberada: con `auth.uid() IS NULL` (SQL Editor / `service_role`) el trigger permite todo.

## 4.8 Portal de clientes

Implementación completa y pruebas en `server/portal/*` y `docs/PORTAL.md`. Resumen verificado:

| Control | Estado |
| --- | --- |
| Tabla `portal_accesos` | ✔ (arriba). Solo `service_role`. |
| Generación segura del token | ✔ `server/portal/codigo.ts`: `crypto.randomBytes(16)` → alfabeto de 32 símbolos sin ambiguos (256 es múltiplo de 32 → sin sesgo) = **80 bits** (`docs/PORTAL.md` dice «~79»: error menor de documentación). |
| Hash del token | ✔ SHA-256 hex del código normalizado; el código en claro **no se guarda ni se audita** (prueba lo comprueba). |
| Validación | ✔ por huella + folio + `activo` + `revocado_at IS NULL` + `expira_at > now`. Respuesta idéntica ante cualquier fallo; 5 fallos/min por folio y 30/10 min por IP. |
| Expiración / revocación | ✔ revocar corta la sesión **en la siguiente petición** (se revalida el acceso en cada llamada). |
| Último uso | ✔ PATCH `ultimo_uso_at` (mejor esfuerzo). |
| Relación con el folio | ✔ vía `proyecto_id`; el backend crea la fila mínima en `proyectos` si falta. |
| Permisos | ✔ `ver_progreso`, `ver_documentos_autorizados`, `subir_documentos` exigidos por ruta. ⚠ el DEFAULT SQL de `subir_documentos` es `false`, el del backend es `true` (el backend siempre manda el valor explícito). |
| Separación interno/cliente | ✔ cookies y claves de firma distintas; el folio sale de la sesión; proyección por lista blanca (prueba de «no filtra» serializa la respuesta). |
| Acceso a documentos | El cliente **no puede descargar ni listar** nada: **no existen URLs firmadas** (`createSignedUrl` no está implementado). Solo puede *subir*. |
| Tablas internas / listar el bucket | ✔ El cliente no tiene JWT de Supabase; solo habla con `/api/portal/*`. Sin políticas para `anon`. |
| Contra Supabase real | **[NO-VERIFICABLE]**; adaptadores probados con `fetch` simulado. |

## 4.9 Storage **[V-CÓDIGO] + [V-EJEC] (PGlite simulado)**

| Punto | Estado |
| --- | --- |
| Bucket `expedientes` | ✔ creado por la 004 (`INSERT … ON CONFLICT DO UPDATE`). |
| Privado | ✔ `public = false`. |
| Límite de tamaño | 20 971 520 bytes (20 MB) en el bucket; el portal limita a 10 MB en el backend. |
| MIME permitidos | `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. ⚠ El personal no puede subir otros formatos (p. ej. `.dwg`, `.docx`, `.xlsx`) si algún requisito lo necesita. |
| Lectura | `expedientes_select_staff`: personal activo (cualquier rol) y la carpeta raíz (`storage.foldername(name)[1]`) debe ser un `folio` existente en `proyectos`. |
| Carga | `expedientes_insert_editors`: admin, coordinación, proyectista, supervisor; misma condición de folio. |
| Actualización / eliminación | Solo `admin`. |
| Rutas por folio | ✔ `<FOLIO>/<documento-uuid>/<archivo>` (comentario de la 004); el portal usa `<FOLIO>/portal/<uuid>/<archivo>` con la clave secreta. |
| Correspondencia `storage_path` ↔ `documentos` | ⚠ Solo por convención: **sin constraint ni trigger**, y **no existe código de subida del personal**. Los archivos del portal no tienen fila en `documentos`. |
| Subida desde la aplicación interna | **No existe** (la interfaz interna no sube archivos; `DocumentUploader` y `DocumentPreview` son componentes sin cableado). |

# 5. RLS y seguridad

## Matriz de políticas reales (migraciones 003, 004, 006, 007) **[V-CÓDIGO]; comportamiento por rol [V-EJEC en PGlite]**

«Personal» = `is_active_staff()` = perfil **activo** con cualquier rol.

| Tabla | RLS | SELECT | INSERT | UPDATE | DELETE | Observaciones |
| --- | :-: | --- | --- | --- | --- | --- |
| `proyectos` | ✔ | personal | admin, coord | admin, coord | admin | `consulta` ve todo. |
| `sistemas_fotovoltaicos` | ✔ | personal | admin, coord, proyectista | ídem | admin | |
| `documentos` | ✔ | personal | admin, coord, proyectista, supervisor | admin, coord, proyectista | admin | supervisor inserta pero no modifica (verificado: 0 filas). |
| `documento_datos_declarados` | ✔ | personal | admin, coord, proyectista, supervisor | admin, coord, proyectista | admin | ídem. |
| `requisitos_documentales` | ✔ | personal | admin, coord | admin, coord | admin | |
| `resoluciones_documentales` | ✔ | personal | admin, coord, proyectista **y** `resuelto_por = auth.uid()` | **ninguna** | **ninguna** | Append-only por ausencia de política/grant (no por trigger). Verificado: no se puede registrar a nombre de otro. |
| `aprobaciones_checklist_g2` | ✔ | personal | admin, coord, proyectista **y** `aprobado_por = auth.uid()` | ninguna | ninguna | ídem. |
| `acuerdos_paer` | ✔ | personal | admin, coord **y** `registrado_por = auth.uid()` | admin, coord | admin | proyectista no puede registrar (verificado). |
| `perfiles` | ✔ | **propio** o admin/coord | admin | admin | admin | + trigger `protect_profile_role`. Coord puede leer **todos** los perfiles (correos). |
| `portal_accesos` | ✔ | **sin política** | sin política | sin política | sin política | Solo `service_role`. ✔ |
| `auditoria_eventos` | ✔ | admin, coord | solo por RPC | sin política + trigger | sin política + trigger | TRUNCATE posible con `service_role`; RPC abierta a todo el personal (A-3). |
| `sincronizaciones` | ✔ | **`USING (true)` para cualquier `authenticated`** ⚠ | sin política (service_role) | trigger bloquea | trigger bloquea | **No exige `is_active_staff()`** (A-2). |
| `referencias_externas` | ✔ | **`USING (true)`** ⚠ | sin política | sin política | sin política | Ídem. |
| `portal_recepciones` | ✔ | personal | sin política (service_role) | admin, coord, proyectista (columnas `estado, motivo_rechazo, revisado_por, revisado_en`) | sin política | ✔ |
| `storage.objects` (bucket `expedientes`) | ✔ (de Supabase) | personal + carpeta = folio existente | editores + carpeta válida | admin | admin | Ver §4.9. |
| `v_paer_semanal` (vista) | `security_invoker = true` ✔ | hereda RLS de `acuerdos_paer` y `proyectos` | — | — | — | `GRANT SELECT authenticated`. |

## Hallazgos de RLS y funciones

| Revisión pedida | Resultado |
| --- | --- |
| Tablas sin políticas | `portal_accesos` (intencional) y las de escritura exclusiva del backend. Ninguna tabla queda con RLS desactivado **[V-EJEC: 11/11 con RLS en 001–005; 14/14 con 006–007]**. |
| Políticas demasiado permisivas | `sincronizaciones` y `referencias_externas` (**mías, de la Fase 3**): `USING (true)` deja leer a **cualquier JWT `authenticated`**, incluso de un usuario sin perfil o inactivo. Datos: folio, ids de Zoho, mensajes de error ≤300 caracteres. Corrección: `USING (public.is_active_staff())`. |
| Contradicciones | Ninguna entre políticas. Incoherencia menor: `resoluciones`/`g2` permiten insertar al **proyectista** pero `aprobar_excepciones` del código solo a admin/coord (la excepción de una discrepancia la aprueba admin/coord en la UI; la tabla no lo impone). |
| Recursividad | **No**: las funciones de rol son SECURITY DEFINER y leen `perfiles` sin RLS **[V-EJEC]**. |
| Acceso anónimo accidental | **No**: `anon` sin grants (`revoke all … from anon` en 005 y 007), sin políticas; verificado «anon no ve proyectos». Si Supabase aplicara privilegios por defecto a tablas futuras, hay que repetir el `REVOKE` (005 solo revoca lo existente). |
| `service_role` | Acceso total y salta RLS **por diseño**: **todo** el backend lo usa. Cualquier ruta del backend con un fallo de autorización expone todo; RLS no ayuda en ese caso. Además `ALL` incluye `TRUNCATE` sobre las tablas append-only. |
| Escalamiento de privilegios | No encontré ruta: rol solo cambia admin; perfiles nuevos inactivos; `registrar_evento_auditoria` fija actor y origen. Riesgo residual: `ADMIN_TOKEN` equivale a admin (opcional y recomendable retirarlo). |
| SECURITY DEFINER | `current_user_role`, `has_any_role`, `is_active_staff`, `protect_profile_role`, `registrar_evento_auditoria`, `handle_new_auth_user`: **todas con `SET search_path = ''` y nombres calificados** ✔. `EXECUTE` revocado a `public` en las funciones de rol y en la RPC, concedido a `authenticated`. La RPC valida `auth.uid()` y perfil activo pero **no restringe `entidad`/`accion`/`detalles`**. |
| Datos sensibles al frontend | El navegador no recibe tokens de Supabase ni de Zoho (verificado en pruebas: la cookie solo lleva `uid`; el login descarta los tokens). `GET /api/admin/zoho/mapeo` devuelve el mapeo de campos (no secretos). `GET /api/integracion/estado` es **público** y devuelve el texto del error de Zoho si falla (M-6). |
| Vistas | La única (`v_paer_semanal`) usa `security_invoker = true` ✔. |

### Pruebas de permisos ejecutadas **[V-EJEC]** (PGlite, 46 + 15 + 8 + 5 comprobaciones; todas OK)
Entre otras: usuario inactivo no ve proyectos; `anon` no ve nada; `consulta` lee pero no inserta documentos; `supervisor_campo` inserta pero no modifica; `proyectista` captura sistema FV pero no PAER; coordinación registra PAER; nadie registra a nombre de otro; un usuario no se sube el rol; `portal_accesos` ilegible incluso para admin desde cliente; auditoría: UPDATE/DELETE bloqueados, eventos de Zoho idempotentes, se puede borrar un usuario con eventos; Storage: personal lee solo carpetas de folios existentes, `consulta` no sube, inactivo no lee. Extra de esta auditoría: `service_role` **sí** hace `TRUNCATE` de la auditoría; `consulta` **sí** escribe eventos arbitrarios por la RPC; `consulta` solo ve su propio perfil y coordinación ve todos los perfiles existentes (5 en ese momento).
