# Parte 05 — Hallazgos, roadmap y resumen ejecutivo

# 12. Problemas y pendientes

Cada hallazgo indica **Evidencia** (archivo/función/tabla/política), **Consecuencia**, **Solución**, **Dependencias** y **Prioridad** (P0 = antes de cualquier otra cosa; P1 = antes de una demo con terceros/uso real; P2 = siguiente iteración; P3 = mejora).

## Críticos

| ID | Descripción | Evidencia | Consecuencia | Solución recomendada | Dependencias | Prioridad |
| --- | --- | --- | --- | --- | --- | --- |
| **C-1** | **Todo el trabajo reciente está sin commitear.** Solo hay 2 commits; 129 entradas sin guardar (fases 2–7). | `git log --oneline` (2 commits), `git status --short` (129). `.env` está ignorado y no aparece; sí cambia `server/.env.example`. | Una pérdida de disco, un `git clean` o `reset` borra semanas de trabajo; sin historial ni revisión. | Revisar que no haya secretos y **commitear por fases** (3 Zoho, 5 componentes, 6 panel, 7 portal) y subir a un remoto privado. | Decisión del dueño (el asistente no commitea sin permiso). | **P0** |
| **C-2** | **Las decisiones humanas viven solo en `localStorage`.** Observaciones registradas, responsables, resoluciones/excepciones, cambios de compuerta y «quién aprobó» (modo MOCK; con Zoho, el cambio de estado va a Zoho pero la aprobación y el resto siguen locales). | `src/infrastructure/decisiones-local.ts`, `src/application/decisiones.ts`, `src/hooks/useExpediente.ts`. Tablas sin uso: `resoluciones_documentales`, `aprobaciones_checklist_g2`. | Se pierden al limpiar el navegador; no se comparten entre personas; **sin auditoría**; los permisos (`aprobar_excepciones`, `liberar_compuertas`) se comprueban **en el navegador**, así que un usuario con DevTools puede forjar una aprobación local. | Endpoint(s) de backend que **reciban la decisión, validen rol y reglas del dominio en servidor** y la persistan en Supabase + `auditoria_eventos`; nuevas observaciones hacia Zoho (notas). Mantener el dominio como única fuente de reglas. | C-3 | **P0** |
| **C-3** | **El esquema de Supabase no coincide con el modelo que usa el código** (no se puede conectar el expediente sin decidir un canon). (a) **Dos catálogos de 21 requisitos distintos**; el de la BD no tiene `compuerta`, `canal`, `requiere_vigencia`, `aporta_cliente`, `reubicable_por_zona`. (b) `documento_datos_declarados.campo` admite **5** campos; el motor usa **13**. (c) `sistemas_fotovoltaicos` no tiene modelo de panel/inversor, RPU, coordenadas, strings, nivel de tensión ni potencia DC declarada. (d) Resoluciones por **dato declarado** vs por **huella de regla**; tipos de resolución distintos. (e) `consumo_kwh_mes` como texto. | `supabase/migrations/…0001, …0002`; `src/data/catalogo-requisitos.mock.ts`; `src/domain/validacion/campos.ts`; `src/domain/entidades/configuracion-tecnica.ts`; `supabase/README.md` («Lo que NO coincide…»). | Validar con el catálogo equivocado; reescritura tardía; datos que la BD rechaza. | **Decidir con IDC el catálogo canónico** y migrar: columnas de compuerta/canal/vigencia/cliente/zona en `requisitos_documentales`; ampliar o reemplazar el CHECK de `campo`; guardar la configuración técnica completa (columnas o `jsonb` validado); vincular resoluciones a la `huella` (o a `reglaId+campo`); convertir tipos en el repositorio. | Confirmación de IDC | **P0** |

## Altos

| ID | Descripción | Evidencia | Consecuencia | Solución | Dependencias | Prioridad |
| --- | --- | --- | --- | --- | --- | --- |
| **A-1** | **El expediente, los datos técnicos y el PAER no están integrados con Supabase.** 7 tablas (y 1 vista) sin ningún consumidor. Con Zoho real `documentosDisponibles=false`: no hay checklist, validaciones ni PAER. | Búsqueda de nombres de tabla en `src/`+`server/` (solo se usan 7 de 14); `server/zoho/adaptar.ts` (`documentos: [], acciones: []`). | La plataforma «de verdad» solo muestra etapa, observaciones y cronograma; el valor central (control documental) existe solo en la demo. | Repositorio de expediente en el backend (`/api/admin/expediente/:folio`) que lea `documentos` + datos declarados + sistema FV y los componga con el `Proyecto` de Zoho; luego captura/subida. | C-3 | P1 |
| **A-2** | **Lectura abierta en `sincronizaciones` y `referencias_externas`**: `USING (true)` para cualquier `authenticated`. | `…0006_integracion_zoho.sql`, políticas `sincronizaciones_select`, `referencias_externas_select`. Verificado en PGlite: un `authenticated` sin perfil las lee. | Si algún día hay un usuario autenticado que no sea personal activo (p. ej. registro público abierto), ve folios, ids de Zoho y mensajes de error. | Migración 008: `USING (public.is_active_staff())`. | — | P1 (trivial) |
| **A-3** | **La auditoría se puede alterar/contaminar por vías alternativas.** (1) `TRUNCATE` funciona con `service_role` (los triggers por fila no lo bloquean y 005 da `ALL`). (2) La RPC `registrar_evento_auditoria` deja a **cualquier personal activo, incluso `consulta`**, escribir eventos con entidad/acción/detalles arbitrarios. (3) No se audita: decisiones, inicios de sesión, subidas. | `…0003` (`prevent_audit_mutation`, `registrar_evento_auditoria`), `…0005` (`grant all … to service_role`). **[V-EJEC]** PGlite. | Un fallo del backend o una credencial robada podría borrar la bitácora; los eventos pueden falsificarse. | `REVOKE TRUNCATE ON auditoria_eventos FROM service_role` (y por defecto), trigger `BEFORE TRUNCATE` que falle; restringir la RPC (lista blanca de acciones/entidades o quitarla y escribir solo desde el backend); ampliar lo auditado. | — | P1 |
| **A-4** | **Cookies sin `Secure` y sin cabeceras de seguridad HTTP.** | `server/app.ts:137` y `server/portal/rutas.ts:77` (`setCookie` sin `secure`); búsqueda de `secureHeaders`/CSP/HSTS/X-Frame-Options: sin resultados (solo `Cache-Control: no-store` y `nosniff` en `/api/portal`). | Detrás de HTTPS la cookie podría viajar por HTTP si el usuario visita la URL sin TLS; sin CSP/XFO queda más expuesta a *clickjacking* e inyecciones. | `secure: true` fuera de localhost; `hono/secure-headers` (CSP restrictiva, HSTS, X-Frame-Options, Referrer-Policy, nosniff) global. | Dominio con HTTPS | P1 |
| **A-5** | **La función de Vercel no exporta `PATCH`** (ni `PUT`/`OPTIONS`/`HEAD`), pero la API usa `PATCH`. | `api/index.ts` (`GET`, `POST`, `DELETE`); `server/app.ts` (`app.patch('/api/admin/usuarios/:id')`). | En Vercel, cambiar rol/activar usuarios devolvería 405. | Exportar `PATCH`, `PUT`, `OPTIONS`, `HEAD`; probar en un despliegue de vista previa. | Despliegue | P1 si se usa Vercel |
| **A-6** | **Las escrituras de la Fase 3 y la propiedad de «quién liberó la compuerta» no están verificadas/definidas.** Adaptadores probados solo con Zoho simulado; el refresh token tenía scopes insuficientes (regenerado, sin re-verificar); creación de tratos desactivada; dependencias desactivadas. «Aprobado por X» solo en el navegador mientras Zoho recibe solo el estado. | `server/zoho/{crm,projects,workdrive}-adapter.ts`, `mapeo.ts` (`etapaInicial: null`, `dependenciasHabilitadas: false`), `docs/ZOHO_SETUP.md` §11. | Un payload distinto al esperado fallará o creará datos incorrectos en producción. | Pruebas en sandbox/cuenta de prueba (simular → un folio de prueba → escribir); decidir si el aprobador vive en Zoho (campo/nota) o en `aprobaciones_checklist_g2`. | Credenciales/scopes; decisión de IDC | P1 |
| **A-7** | **Cada pantalla recarga y analiza todo Zoho** (N+1: por cada proyecto se leen sus notas) sin caché ni paginación; no hay webhooks ni *polling*. | `server/app.ts` (`/api/admin/kv/proyectos` → `Promise.all(proyectos.map(leerObservaciones))`); `src/hooks/useExpediente.ts` (`useCartera.recargar`). | Lento con muchos proyectos; riesgo de 429/límites de la API; los cambios de Zoho solo se ven al recargar. | Caché corta en servidor (30–60 s) y lectura por lotes; paginación; webhooks de CRM/Projects → `auditoria_eventos(origen='zoho', external_event_id)` (el índice ya existe). | — | P1 |
| **A-8** | **Archivos subidos por clientes: sin revisión interna, sin entrada al expediente, sin descarga.** | `portal_recepciones` (estados) sin pantalla/ruta de revisión; archivos en el bucket **sin fila en `documentos`**; no hay `createSignedUrl`. | El cliente recibe «en revisión» indefinidamente; el personal no puede abrir lo que subió (salvo desde el panel de Supabase). | Cola de recepciones en el panel (aceptar/rechazar con motivo para el cliente), creación de `documentos`/datos declarados al aceptar, URL firmada de corta vida para personal. | A-1 | P1 |
| **A-9** | **Configuración de Supabase Auth no verificable y manual**: registro público apagado, SMTP, URLs de redirección, primer administrador por SQL. | `supabase/README.md` (pasos manuales); no hay comprobación en la app. | Un ajuste olvidado rompe la recuperación de contraseña o deja el registro abierto (con A-2 se amplía el impacto). | Script/endpoint que consulte `GET /auth/v1/settings` y muestre en Integraciones: signup, SMTP, redirect; lista de verificación previa a la demo. | Acceso a Supabase | P1 |
| **A-10** | **Responsables y PAER no vienen de Zoho/BD.** Responsables de tareas no se leen; `acciones=[]` con Zoho; no hay captura de acuerdos. | `server/zoho/adaptar.ts` (`responsable: null`); `acuerdos_paer` sin uso. | Seguimiento y PAER vacíos con datos reales. | Leer propietarios de tareas (scope de usuarios) y construir captura + lectura de `acuerdos_paer` (+ `v_paer_semanal`); alinear estados/semana (M-12). | C-3 | P1 |
| **A-11** | **La verificación de RLS/Storage no está en el repositorio** (scripts temporales fuera de él). | Carpeta temporal de la sesión; `package.json` sin PGlite. | Nadie puede repetir ni proteger contra regresiones; la próxima migración puede abrir un hueco sin avisar. | Mover los scripts a `supabase/tests/` o `scripts/`, añadir `@electric-sql/pglite` (dev) y ejecutarlos con Vitest en CI. | — | P1 |

## Medios

| ID | Descripción | Evidencia | Consecuencia | Solución | Prioridad |
| --- | --- | --- | --- | --- | --- |
| M-1 | **Migración 007 probablemente sin aplicar** (006 sí, según el dueño). Subir archivos / listar accesos reales fallaría (`portal_recepciones` inexistente). | `…0007_portal_recepciones.sql` creada en la Fase 7. | Portal real roto hasta aplicarla. | Aplicar 007; añadir a Integraciones un chequeo de migraciones. | P1 |
| M-2 | `.env.example` desalineado: lista `DATABASE_URL` y `SUPABASE_JWKS_URL` (nadie las lee) y **omite** `SESSION_SECRET` y `APP_URL` (sí se leen). | `server/.env.example`, `server/config.ts`. | Configuración confusa. | Alinear. | P2 |
| M-3 | **Documentación desactualizada**: `README.md` raíz («no hay conexión real con Zoho», «npm test: reglas de dominio»); `supabase/README.md` («el backend aún no usa Supabase», «los 5 archivos»). | Ambos archivos. | Un asistente/persona nueva se confunde. | Actualizar (esta auditoría puede servir de base). | P2 |
| M-4 | **Código sin cablear**: clasificación de documentos, generación de folios (`siguienteFolio`), versiones de documento, `DocumentUploader`/`DocumentPreview` internos, adaptador WorkDrive. | `src/domain/{clasificacion,folio}`, `entidades/version-documento.ts`. | Complejidad sin valor entregado. | Cablear con A-1/A-8 o archivar. | P2 |
| M-5 | **Limitadores en memoria** y `X-Forwarded-For` falsificable: en serverless/multiinstancia no son globales; el límite por IP del portal se evade rotando la cabecera (el límite por folio sigue). | `server/sesiones.ts`, `server/portal/rutas.ts`. | Menor protección de fuerza bruta en producción. | Almacén compartido (KV/Redis/tabla) y confiar solo en el proxy conocido. | P2 |
| M-6 | `GET /api/integracion/estado` es **público** y devuelve el texto del error de Zoho. | `server/app.ts` (`/api/integracion/estado`). | Fuga de detalles operativos a anónimos. | Mensaje genérico para anónimos; detalle solo con sesión. | P2 |
| M-7 | Subida del portal: `c.req.formData()` **carga todo el cuerpo en memoria**; el tope previo depende de `Content-Length` (falsificable con *chunked*). | `server/portal/rutas.ts`. | Posible consumo de memoria por un cliente con acceso válido (acotado por límite de 20 envíos/10 min). | Límite de tamaño a nivel de servidor/proxy o lectura en *stream* con corte. | P2 |
| M-8 | **Dos motores de validación conviven**: el nuevo (`reglas/`) y el legado (`validacion-cruzada.ts`, `vigencias.ts`, `auditar-expediente.ts`) que usa `portal-cliente.ts` y las pruebas antiguas. | `src/domain/validacion/*`, `src/application/portal-cliente.ts`. | Dos fuentes de verdad para vigencias. | Migrar el portal a `ejecutarReglas` (VIG-*) y retirar lo legado. | P2 |
| M-9 | El código **compartido con el backend** debe usar rutas relativas (el alias `@/` solo existe en Vite/tsx); es una convención frágil. | `src/data/*.ts` y `src/application/portal-cliente.ts` tuvieron que cambiarse. | Un import `@/…` nuevo rompería el backend o el build de Vercel sin aviso. | Regla de lint/prueba que lo detecte, o `tsconfig paths` también para el bundle de Vercel. | P2 |
| M-10 | **El portal muestra `nombre` y ubicación del proyecto tal como están en Zoho** (texto libre). Si alguien escribe información interna en el nombre del proyecto/trato, el cliente la ve. | `server/portal/fuente-zoho.ts` → `aProyectoKv` → `construirVistaPortal` (`nombre`, `ubicacion`). | Posible exposición de datos internos por descuido de captura. | Mostrar un nombre público derivado (p. ej. folio + tipo de sistema + municipio) o un campo explícito «nombre público». | P1 |
| M-11 | Pantallas internas **sin protección de ruta en el cliente**: sin sesión se ven con datos demo, también en producción. | `src/App.tsx`, `src/hooks/FuenteDatos.tsx`. | Aceptable en demo; en producción se ve el caso demostrativo a anónimos. | Bandera de entorno para desactivar MOCK en producción y redirigir a `/acceso`. | P2 |
| M-12 | **PAER**: la BD usa `semana_inicio`, estados `pendiente/en_progreso/cumplido/no_cumplido/cancelado` y `responsable_id`; el código usa `semana`, `completada/pendiente/no_realizada` y responsable texto. | `…0002` (`acuerdos_paer`), `src/domain/acciones/accion.ts`, `paer.ts`. | Cálculo de PAER incorrecto al conectar. | Mapeo explícito y definición de qué estados cuentan como «efectivamente realizada». | P2 |
| M-13 | `consumo_kwh_mes` guardado como texto; el CHECK de `campo` no admite todos los campos del motor. | `…0001`. | Fallos de conversión/rechazos. | Parte de C-3. | P2 |
| M-14 | **No se advierte en pantalla que ReadyCheck no garantiza la aceptación de CFE**, y no hay historial de ejecuciones. | Búsqueda de textos; `validacionEjecutada` sin uso. | Expectativa equivocada del usuario; sin trazabilidad de «cuándo se validó». | Aviso permanente en Validaciones/Resumen; registrar cada ejecución relevante (folio, versión de reglas, resumen). | P2 |
| M-15 | Tablas sin paginación ni ordenación; todo se calcula en el navegador. | `ProjectTable`, páginas de cartera. | No escala. | Paginación + ordenación; cálculo en servidor cuando haya volumen. | P3 |
| M-16 | Color de «En revisión» distinto entre panel (ámbar) y portal (navy); comparte ámbar con «Por vencer» en el panel. | `GateStepper.tsx`, `src/domain/portal/textos.ts`. | Ambigüedad visual. | Definir un tono único. | P3 |
| M-17 | **Relación por nombre** (`folio.campoCrm = null`): un trato renombrado o dos tratos con el mismo prefijo producen ambigüedad. | `server/zoho/mapeo.ts`. | Folio mal enlazado. | Campo personalizado de folio en CRM y Projects + búsqueda por ese campo. | P2 |
| M-18 | Cada visita a `/portal/vista` consulta Zoho (modo real) sin caché. | `server/portal/fuente-zoho.ts`. | Costo de API con muchos clientes. | Caché por folio (60 s). | P2 |

## Bajos

| ID | Descripción | Solución |
| --- | --- | --- |
| L-1 | `docs/PORTAL.md` dice «~79 bits»; son 80 (`32^16`). | Corregir. |
| L-2 | El historial/avisos del portal muestran la fecha **UTC** (`toISOString`), que puede ser el día siguiente en Hermosillo. | Formatear con zona `America/Hermosillo`. |
| L-3 | Un solo *bundle* (466 kB / 137 kB gzip) sin *code-splitting* por ruta; fuentes desde Google (privacidad/offline). | `lazy()` por sección; alojar fuentes localmente. |
| L-4 | Sin ESLint/Prettier/CI. | Añadir lint, formato y un flujo de CI (typecheck+tests). |
| L-5 | Advertencia de Vite por importaciones sin extensión (`configLoader`). | Añadir extensiones o `--configLoader runner`. |
| L-6 | `perfiles.activo` tiene `DEFAULT true` aunque el trigger inserta `false`. | Poner `DEFAULT false`. |
| L-7 | Contraste de color calculado a mano, no medido; sin auditoría automatizada de accesibilidad. | axe/Lighthouse en CI. |
| L-8 | `portal_accesos.permisos` DEFAULT SQL (`subir_documentos:false`) ≠ valor por defecto del backend (`true`). | Alinear. |
| L-9 | Contraseña de emergencia `ADMIN_TOKEN` como `Bearer` sin limitador propio (solo comparación en tiempo constante). | Retirarlo en producción o limitar. |

# 13. Roadmap recomendado

> No se propone reconstruir lo que ya funciona: dominio, backend de auth/permisos, portal, Stage-Gate y componentes se **conservan**; el trabajo es conectar, persistir y endurecer.

## 1. Correcciones de arquitectura y base de datos
| Prioridad | Tarea | Qué falta | Dependencia | Criterio de terminado |
| --- | --- | --- | --- | --- |
| P0 | Commitear y respaldar el trabajo (C-1) | Revisión sin secretos; commits por fase; remoto privado | Visto bueno del dueño | `git log` con commits por fase; sin `.env` versionado |
| P0 | **Catálogo canónico y esquema alineado (C-3)** | Decidir catálogo; migración 008+ (columnas de compuerta/canal/vigencia/cliente/zona; CHECK de campos; configuración técnica; resoluciones por `huella`) | IDC | Migraciones aplicadas en PGlite y en Supabase; el código y la BD usan el **mismo** catálogo |
| P1 | Corrección de políticas (A-2, L-6, L-8) | Migración 008 pequeña | — | Pruebas RLS verdes |
| P1 | Aplicar 007 y comprobar migraciones (M-1) | Chequeo en Integraciones | Acceso a Supabase | `/api/integracion/estado` informa tablas presentes |

## 2. Seguridad y permisos
| P1 | Endurecer HTTP (A-4) | `secure` en cookies; cabeceras globales | HTTPS | Pruebas de cabeceras; cookie `Secure` fuera de localhost |
| P1 | Auditoría inviolable (A-3) | `REVOKE TRUNCATE`; trigger `BEFORE TRUNCATE`; RPC restringida | — | Prueba SQL: TRUNCATE falla; `consulta` no escribe eventos |
| P1 | Permisos de decisiones **en el backend** (C-2) | Rutas que validen `aprobar_excepciones`/`liberar_compuertas` | C-3 | Una petición forjada sin rol recibe 403 (prueba) |
| P2 | Limitadores compartidos (M-5), `estado` no público (M-6), límite de cuerpo (M-7) | — | — | Pruebas |

## 3. Autenticación y portal
| P1 | Verificar la configuración de Supabase Auth (A-9) | Chequeo de signup/SMTP/redirect | Acceso | Lista verde en Integraciones |
| P1 | Nombre público en el portal (M-10) | Campo/derivación | — | El portal no muestra texto libre interno |
| P1 | Cola de recepciones y revisión (A-8) | Pantalla + rutas + URL firmada | A-1 | Un archivo subido puede aceptarse/rechazarse y el cliente lo ve |
| P2 | Notificaciones por correo/WhatsApp; «leído» | — | SMTP | — |

## 4. Integración Zoho
| P1 | Probar escrituras en sandbox (A-6) | Simular → escribir un folio de prueba; confirmar payloads/scopes | Credenciales | Checklist de `docs/ZOHO_SETUP.md` §11 completado |
| P1 | Caché y lectura por lotes (A-7, M-18) | — | — | Tiempo de carga < objetivo con N proyectos |
| P1 | Webhooks de Zoho → auditoría (A-7) | Receptor firmado + `external_event_id` | Registro en Zoho | Evento duplicado no se procesa dos veces |
| P2 | Campo de folio en CRM/Projects (M-17); responsables (A-10) | — | Zoho | — |

## 5. Expediente documental
| P0/P1 | Repositorio de expediente (A-1) | Lectura de `documentos`, datos, sistema FV; composición con Zoho | C-3 | Con datos reales aparecen checklist y validaciones |
| P1 | Subida interna + vista de evidencia con URL firmada | Cablear `DocumentUploader`/`DocumentPreview` | A-1 | Un documento subido aparece en Validaciones |
| P2 | Versiones y clasificación sugerida (M-4) | — | — | — |

## 6. ReadyCheck
| P2 | Aviso «preparación ≠ aceptación de CFE» + historial de ejecuciones (M-14) | — | — | Visible en Resumen/Validaciones |
| P2 | Unificar motores (M-8); confirmar parámetros «supuesto» con IDC | — | IDC | Tabla de reglas sin «supuesto» pendientes |
| P1 | Persistir resoluciones y reaperturas (C-2) | — | C-3 | Una resolución sobrevive a recargar y la ve otra persona |

## 7. PAER y auditoría
| P1 | Captura y lectura de acuerdos (A-10, M-12) | Formulario + `acuerdos_paer` + vista | C-3 | PAER semanal calculado con datos reales |
| P1 | Pantalla de auditoría (solo admin/coord) | Lectura de `auditoria_eventos` | A-3 | Filtro por folio/entidad/actor |

## 8. Diseño y experiencia
| P2 | Tono único de «En revisión» (M-16); paginación/orden (M-15); modo producción sin demo (M-11) | — | — | — |
| P3 | Medir contraste/accesibilidad (L-7); fuentes locales y *code-splitting* (L-3) | — | — | Informe axe sin críticos |

## 9. Pruebas
| P1 | Suite RLS/Storage en el repo (A-11) | Mover scripts, PGlite dev | — | Corre con `npm test` |
| P1 | E2E Playwright (login, portal, resolución) | — | — | Verde en CI |
| P1 | Pruebas contra Zoho sandbox y Supabase de staging | — | Credenciales de prueba | Verde |
| P3 | Lint/CI (L-4) | — | — | Flujo automático |

## 10. Preparación de demo
| P0 | Commit + repaso de la lista «demo» | — | C-1 | Árbol limpio |
| P1 | Aplicar 007; confirmar `PORTAL_MODO_DEMO` o datos reales; ensayar el recorrido: login → Panel → KV-2026-004 → Validaciones (registrar, asignar, resolver) → Stage-Gate (inválidas) → Portal (acceso por enlace, subir, acuse) | Guion | — | Recorrido de 10 minutos sin errores |
| P1 | Decir en voz alta qué es demo (franjas «DEMO/MOCK») y qué es real | — | — | — |
| P2 | Actualizar READMEs (M-3) | — | — | — |

# 14. Resumen ejecutivo para el siguiente asistente

1. **Qué es:** KairóVolt controla y prepara expedientes de interconexión (CFE/generación distribuida) para IDC Sistemas Eléctricos: Zoho = operación, Supabase = complemento, vinculados por folio `KV-AAAA-NNN`. Panel interno + portal del cliente.
2. **Tecnologías:** React 19, Vite 8, TypeScript 7 estricto, react-router 7, Hono 4 (backend), Vitest 5, CSS plano con variables (sin Tailwind/shadcn), sin SDKs de Zoho/Supabase (`fetch`). Fuentes Inter/IBM Plex Mono.
3. **Arquitectura:** capas `domain → application → infrastructure/hooks → components → pages`; puertos/adaptadores; backend único en `server/` que guarda todos los secretos; el navegador solo habla con `/api/*`. Detalle y diagramas en la parte 01.
4. **Carpetas:** `server/` (API), `src/{domain,application,infrastructure,data,hooks,components,pages,styles}`, `supabase/` (SQL), `docs/`, `api/` (Vercel). Inventario: parte 01 §9.
5. **Tablas Supabase (14 + vista):** `proyectos, sistemas_fotovoltaicos, documentos, documento_datos_declarados, requisitos_documentales, resoluciones_documentales, aprobaciones_checklist_g2, acuerdos_paer (+ v_paer_semanal), perfiles, portal_accesos, auditoria_eventos, sincronizaciones, referencias_externas, portal_recepciones`. **Solo 7 tienen código que las usa**: `proyectos` (mínimo), `perfiles`, `portal_accesos`, `portal_recepciones`, `auditoria_eventos`, `sincronizaciones`/`referencias_externas`. Parte 02.
6. **Zoho:** OAuth Self Client; CRM v6 + Projects v3 (+ WorkDrive v1 sin probar). Lectura real de tratos/proyectos/tareas G0–G3/notas; escritura real de estado de compuerta y observaciones; adaptadores de creación solo simulados; **sin webhooks**. Folio por convención de nombre. Parte 03.
7. **Login y roles:** correo+contraseña (Supabase Auth) → cookie HttpOnly firmada (solo `uid`) → rol consultado en vivo; 5 roles; `ADMIN_TOKEN` de emergencia; matriz en `src/domain/usuarios/permisos.ts` (8 acciones).
8. **RLS:** 14/14 tablas con RLS; políticas por rol y `is_active_staff()`; funciones SECURITY DEFINER con `search_path=''`; `anon` sin acceso; verificado en PGlite (no en Supabase real). Huecos: A-2, A-3. El backend usa la clave secreta (salta RLS).
9. **Storage:** bucket privado `expedientes` (20 MB; PDF/JPG/PNG/WEBP), lectura de personal por carpeta-folio, carga por editores, update/delete solo admin. El backend sube las cargas del portal con la clave secreta a `<FOLIO>/portal/<uuid>/<archivo>`. Sin URLs firmadas.
10. **Portal del cliente:** folio + código (SHA-256 en BD), cookie propia 2 h, revocación inmediata, proyección por lista blanca, avance por reglas explícitas, subida validada por contenido, acuses `REC-XXXXXX`. Modo DEMO con código de ejemplo. `docs/PORTAL.md`.
11. **Terminado:** login/roles/usuarios, lectura de Zoho, motor de 27 reglas, Stage-Gate con transiciones, pantallas del panel y del portal (en demo), generación/revocación de accesos, sistema de componentes, 450 pruebas verdes.
12. **Parcial:** decisiones (lógica completa, persistencia local), portal con datos reales (avance aproximado), sincronización Fase 3 (solo simulación), auditoría (parcial), cartera con Zoho (sin expediente).
13. **Simulado:** todo el expediente, PAER, hitos y datos técnicos (caso KV-2026-004), portal en DEMO (memoria, archivos descartados), adaptadores «DEMO — NO CONECTADO».
14. **Problemas principales:** C-1 sin commit; C-2 decisiones en `localStorage`; C-3 esquema ≠ modelo; A-1…A-11 (parte 05).
15. **Pendientes prioritarios:** (1) commitear; (2) decidir catálogo canónico y migrar el esquema; (3) conectar el expediente y persistir decisiones **con permisos en el backend**; (4) endurecer cookies/cabeceras/auditoría; (5) probar escrituras de Zoho y Supabase real; (6) tests RLS y E2E en el repo.
16. **Variables de entorno (nombres):** `ZOHO_ACCOUNTS_URL, ZOHO_PROJECTS_URL, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_PROJECTS_PORTAL_ID, ZOHO_WORKDRIVE_ROOT_FOLDER_ID, ADMIN_TOKEN, SESSION_SECRET, APP_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, PORTAL_MODO_DEMO, PORT` (más `DATABASE_URL`/`SUPABASE_JWKS_URL` en el ejemplo, sin uso).
17. **Ejecutar:** `npm install`; `npm run dev` (interfaz+API, un puerto); `npm start` (producción local en 127.0.0.1:8787).
18. **Probar:** `npm test` (= `vitest run`), `npm run typecheck`, `npm run build`. Resultado hoy: 30 archivos, 450 pruebas OK.
19. **Archivos que hay que conocer primero:** `server/app.ts`, `server/config.ts`, `src/domain/usuarios/permisos.ts`, `src/domain/reglas/{motor,configuracion,tipos}.ts`, `src/domain/compuertas/{bloqueo,transiciones}.ts`, `src/domain/observaciones/resolucion.ts`, `src/application/{analizar-proyecto,decisiones,portal-cliente}.ts`, `src/hooks/{FuenteDatos,useExpediente}.ts`, `src/data/kv-2026-004.demo.ts`, `server/zoho/{lectura,escritura,mapeo}.ts`, `server/portal/rutas.ts`, `supabase/migrations/*.sql`, `docs/{REGLAS,PORTAL,ZOHO_SETUP}.md`, `supabase/README.md` (sección «Lo que NO coincide»).
20. **Siguiente paso técnico recomendado:** una sesión corta para **(a)** commitear, **(b)** acordar con IDC el catálogo canónico de requisitos y campos y **(c)** escribir la migración 008 (alineación + A-2 + A-3 + L-6 + L-8) con su prueba RLS dentro del repo. Es la base para conectar el expediente (A-1) y persistir las decisiones (C-2) sin rehacer nada de lo existente.
