# Parte 03 — Integración Zoho, pantallas y motor de reglas («ReadyCheck»)

# 6. Zoho CRM y Zoho Projects

## 6.1 Respuestas directas

| # | Pregunta | Respuesta |
| --- | --- | --- |
| 1 | ¿Existe conexión real con Zoho? | **Sí para lectura y para dos escrituras** (estado de compuerta y observaciones). Verificada en vivo en fases anteriores de esta sesión (la interfaz mostró «Zoho: autenticación verificada» y se leyeron tratos/proyectos con folio). **No re-verificada en esta auditoría** (sin llamadas a Zoho) **[NO-VERIFICABLE ahora]**. Las demás escrituras (Fase 3) **no se han ejecutado nunca contra tu cuenta**. |
| 2 | ¿Qué API usa? | CRM **v6** (`/crm/v6/{Deals,Accounts,Contacts,Notes,Deals/upsert}`), Projects **v3** (`projectsapi.zoho.com/api/v3/portal/{id}/…`), WorkDrive **v1** JSON:API (adaptador construido, sin uso en vivo). `fetch` directo, sin SDK. |
| 3 | ¿Cómo se autentica? | OAuth 2.0 **Self Client**: un `refresh_token` de larga duración se canjea por `access_token` (`accounts.zoho.com/oauth/v2/token`). `server/zoho/auth.ts`. |
| 4 | ¿Dónde están los tokens? | `ZOHO_REFRESH_TOKEN` solo en `server/.env` (git lo ignora). El `access_token` vive **en memoria del proceso**, con renovación y una invalidación+reintento ante 401. **Nunca llega al navegador.** En Vercel serían variables de entorno del proyecto (cada instancia fría pide token nuevo; Zoho limita las renovaciones). |
| 5 | ¿Módulos que consulta? | CRM: `Deals` (tratos), `Accounts`/`Contacts` (cliente), `Notes` de cada trato (observaciones). Projects: portales, proyectos, **tareas** (cada tarea «G0…G3 - …» = una compuerta), listas de tareas, usuarios. |
| 6 | ¿Cómo se relaciona cada registro con el folio? | **Por convención de nombre**, no por campo único: el folio es el prefijo del nombre del trato/proyecto (`^(KV-\d{4}-\d{3,})`, `server/zoho/mapeo.ts`). Existe `folio.campoCrm` para un campo personalizado, **hoy en `null`**. Zoho no impone unicidad; dos tratos con el mismo prefijo no se detectan como conflicto. |
| 7 | ¿Cómo evita duplicar proyectos? | Lectura: nada se crea al leer. Creación (Fase 3, simulación por defecto): se **busca primero** por folio (trato, proyecto, carpeta) y se reutiliza; CRM usa `upsert` con `duplicate_check_fields` (por campo de folio o por `Deal_Name`) y **solo si hay `etapaInicial` configurada (hoy `null` → no se crean tratos)**; clave de idempotencia por paso `folio\|destino\|operacion\|huella(contenido)` guardada en `sincronizaciones`. Observaciones: marcador con el `observacionId` dentro de la nota (idempotente). |
| 8 | ¿Cómo maneja actualizaciones? | Estado de compuerta: `PATCH` de la tarea con el id de estado mapeado (`escritura.ts`, aprendiendo el id de otra tarea con ese estado). Observaciones: crear/actualizar nota. Fechas de tareas: solo se actualiza si cambió y **solo las fechas definidas** (no borra las de Zoho). |
| 9 | ¿Cómo maneja errores? | `ZohoError` con categoría (`autenticacion`, `permiso`, `limite`, `servidor`, `red`, `validacion`, `no_encontrado`, `desconocido`); mensajes **sin secretos** (`Zoho <servicio> respondió <status> (<código>): …`). El backend responde 4xx/5xx con mensaje legible; la interfaz muestra `ErrorState` con «Reintentar». |
| 10 | ¿Tiene reintentos? | Sí (`server/zoho/cliente.ts`): hasta 4 intentos con espera exponencial + jitter y respeto de `Retry-After` (≤30 s). **429 siempre**; 5xx/red **solo en peticiones idempotentes** (GET, PUT/PATCH marcados, upsert); **POST de creación nunca** (podría duplicar); `permiso` (scope faltante) nunca. 13 pruebas. |
| 11 | ¿Webhooks? | **No hay ninguno** (ni rutas receptoras ni registro en Zoho). |
| 12 | ¿Cómo evita procesar dos veces un evento? | No aplica al no haber eventos entrantes. La BD ya tiene el índice `UNIQUE (origen, external_event_id)` esperando eventos de Zoho, **sin código que lo use**. Las *salidas* sí son idempotentes (arriba). |
| 13 | ¿Qué ocurre si Zoho no responde? | Lecturas: error 502 con mensaje; la interfaz cae a **MOCK con el motivo «error de conexión con Zoho»** (`elegirFuente`) o muestra el error en la pantalla. Escrituras: error y **sin cola ni reintento diferido**: la persona debe reintentar. |
| 14 | ¿Cómo se refleja un cambio de Zoho en la interfaz? | **Solo al recargar/navegar** (modelo *pull*): cada pantalla llama `GET /api/admin/kv/proyectos`. Sin polling, sin push, sin caché. Ver A-7. |
| 15 | ¿Qué información se duplica innecesariamente en Supabase? | **Ninguna** de lo operativo. Solo `proyectos(folio)`, `referencias_externas` (ids) y `sincronizaciones` (bitácora técnica). |

## 6.2 Fuente de verdad

| Dato | Fuente de verdad | Dónde se consulta | Dónde se almacena hoy | ¿Cumple la regla «Zoho = operación»? |
| --- | --- | --- | --- | --- |
| Tratos (negocios) | **Zoho CRM** | `server/zoho/lectura.ts` (`leerProyectos`) → `/api/admin/kv/proyectos` | Solo en Zoho | ✔ |
| Cuenta/contacto del cliente | Zoho CRM (Accounts/Contacts) | mismo | Solo en Zoho | ✔ |
| Proyecto operativo | **Zoho Projects** | `leerProyectos` | Solo en Zoho (+ id en `referencias_externas` si se sincroniza) | ✔ |
| Compuertas G0–G3 (estado y fechas) | **Zoho Projects** (tareas «Gn - …») | `leerProyectos`; escritura de estado: `escritura.ts` | Solo en Zoho; **en modo MOCK el cambio es local** (`localStorage`) | ✔ con Zoho; ⚠ en MOCK son locales |
| Observaciones operativas | **Zoho CRM** (notas del trato) | `server/zoho/observaciones.ts` | Solo en Zoho. ⚠ Las observaciones **creadas desde una validación** (Fase 6) viven en `localStorage`, **no** en Zoho | ⚠ parcial |
| Responsables y actividades/fechas | Zoho Projects (propietarios y fechas de tarea) | fechas sí; **responsables NO se leen** (`responsable: null` en `adaptar.ts`) | — | ⚠ falta leer propietarios |
| Quién aprobó una compuerta | (por definir) | — | `localStorage` (navegador). Zoho no lo recibe | ⚠ sin dueño |
| Expediente documental / archivos | **Supabase** (`documentos`, Storage) | **no se consulta** | ninguno en modo real; demo en memoria | ✘ no integrado |
| Datos declarados por documento | Supabase | no se consulta | demo en memoria | ✘ |
| Datos técnicos FV | Supabase `sistemas_fotovoltaicos` | no se consulta | demo en memoria | ✘ |
| Catálogo de requisitos | Supabase `requisitos_documentales` | no se consulta | `src/data/catalogo-requisitos.mock.ts` (**otro** catálogo) | ✘ |
| Resoluciones humanas | Supabase | no se consulta | `localStorage` | ✘ |
| Aprobaciones G2 | Supabase | no se consulta | `localStorage` | ✘ |
| PAER | Supabase `acuerdos_paer` | no se consulta | solo demo | ✘ |
| Perfiles y roles | Supabase `perfiles` | `server/supabase/perfiles.ts` | Supabase | ✔ real |
| Accesos del portal | Supabase `portal_accesos` | `server/portal/supabase.ts` | Supabase (o memoria en demo) | ✔ (sin probar en vivo) |
| Auditoría | Supabase `auditoria_eventos` | sin pantalla | Supabase | ✔ parcial (solo escrituras del backend) |

## 6.3 Lo construido en la Fase 3 y su estado

`ZohoClient`, `ZohoCRMAdapter`, `ZohoProjectsAdapter`, `ZohoWorkDriveAdapter`, `ZohoMapper` + orquestador (`src/application/integracion/sincronizar-proyecto.ts`) y rutas `/api/admin/integracion/{estado,registro,sincronizar-proyecto}` (permiso `sincronizar_zoho`). **Simulación por defecto**; la interfaz (Integraciones) **solo simula**. Probado con 30 pruebas de adaptadores + 19 del orquestador sobre un Zoho simulado **[V-EJEC]**. Riesgos conocidos: los cuerpos de creación (proyectos, listas, tareas, archivos) están hechos según documentación, no verificados contra tu cuenta; el refresh token anterior carecía de scopes de tareas/usuarios/WorkDrive (regenerado por el dueño; no re-verificado); dependencias entre tareas desactivadas (endpoint no confirmado); crear tratos desactivado (`etapaInicial: null`).

# 7. Pantallas

**Criterio de estado:** COMPLETA = funciona y está conectada; PARCIAL = funciona pero con datos demo o con piezas faltantes. «Datos» indica de dónde salen: *Z* = Zoho real, *M* = demo en código (`kv-2026-004.demo.ts`), *L* = `localStorage`, *B* = backend/Supabase.

## 7.1 Panel interno (`AppShell`: barra lateral + barra superior)

| Pantalla | Ruta | Objetivo | Componentes principales | Datos / servicios | Acciones | Estado | Falta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Panel** (Dashboard) | `/` | Tabla de proyectos y alertas operativas | `ProjectTable`, `KPIGrid`, `AlertPanel` | `useCartera` → repositorio (Z o M) + L + `analizarProyecto` | Navegar a proyecto/alerta | **PARCIAL** | Con Zoho no hay expediente → sin bloqueantes ni documentos; carga completa en cada visita |
| **Proyectos** | `/proyectos` | Listar/buscar/filtrar por etapa | `ProjectTable`/`ProjectCard` | ídem | Buscar, filtrar, tabla↔tarjetas | **COMPLETA** (sobre lo que haya) | Paginación (todo en memoria) |
| **Detalle de proyecto** | `/proyectos/:id` | Ficha con 5 pestañas | `Tabs`, `StageGatePanel`, `ValidacionesProyecto`, `DocumentosProyecto`, `HistorialProyecto`, `AccesoPortalPanel`, `ObservacionesTable`, `NuevaObservacionForm` | `useProyectoCompleto` (Z o M + L), `/api/admin/sync/*`, `/api/admin/portal/accesos` | Registrar observación, asignar responsable, resolver, cambiar compuerta (local o Zoho), cerrar observación en Zoho, crear observación en Zoho, generar/revocar accesos del portal | **PARCIAL** | Decisiones solo locales; expediente real; evidencia sin archivos |
| **Expediente / Documentos (proyecto)** | `/proyectos/:id?tab=documentos` | Checklist por compuerta + documentos recibidos | `ChecklistTable`, `DocumentTable`, `PanelEvidencia` | `analizarProyecto` | Abrir evidencia (datos declarados; archivo si existe) | **MOCK** con M; **no disponible** con Z | Conectar `documentos` de Supabase; subir archivos; URLs firmadas |
| **Validaciones (proyecto)** | `?tab=validaciones` | Comparar documentos, severidad, evidencia, responsable, resolución | `ValidationCard`, `DialogosValidacion` | motor de reglas | Registrar observación (sin duplicar), asignar, resolver (reglas del dominio), abrir evidencia | **PARCIAL** (lógica completa, persistencia local) | Persistir en BD |
| **Cronograma (proyecto)** | `?tab=cronograma` | Actividades, tiempos entre hitos, acuerdos PAER | `CronogramaTable`, `TiemposTabla`, `AccionesTable` | Z (tareas) / M | — | **PARCIAL** | Responsables (Z no se leen); hitos tipados solo en M |
| **Historial (proyecto)** | `?tab=historial` | Línea de tiempo | `Timeline` | eventos de la fuente + L | — | **PARCIAL** | Mezcla eventos locales con los de Zoho; sin lectura de `auditoria_eventos` |
| **Stage-Gate** | (en Resumen) | G0–G3, requisitos, bloqueantes, aprobador, transiciones | `StageGatePanel` | `evaluarBloqueoCompuerta`, `evaluarTransicionCompuerta` | Cambiar estado (valida en el dominio; en Z escribe en Projects) | **COMPLETA** en lógica | Aprobador persistente |
| **Documentos** | `/documentos` | Faltantes y vencidos de todos los proyectos | tabla propia | `useCartera` | Filtrar | **PARCIAL** | Solo proyectos con expediente |
| **Validaciones** | `/validaciones` | Fallos de todos los proyectos | `ValidationCard` | idem | Filtrar, ir al proyecto | **PARCIAL** | idem |
| **Cronograma** | `/cronograma` | Actividades de todos los proyectos | `CronogramaTable` | idem | Filtrar | **COMPLETA** (sobre datos) | — |
| **Seguimiento CFE** | `/seguimiento-cfe` | Observaciones CFE/UVIE y tiempos de trámite | tablas, `TiemposTabla` | idem | — | **PARCIAL** | Los orígenes `cfe/uvie` dependen de cómo se capturen en Zoho; demo sin observaciones CFE |
| **Indicadores** (PPC, PAER) | `/indicadores` | KPI por proyecto y cartera | `KPI`, tabla | idem | — | **PARCIAL** | PAER solo demo (Zoho: sin acuerdos); **no hay captura de acuerdos** |
| **Integraciones** | `/integraciones` | Estado real de Zoho/adaptadores, simulación, bitácora | `AlertPanel`, tablas | `/api/integracion/estado`, `/api/admin/integracion/*` | **Simular** sincronización de un proyecto | **COMPLETA** (solo simulación) | Escritura real desde UI (deliberadamente ausente) |
| **Configuración** | `/configuracion` | Ver reglas, requisitos, permisos, parámetros | `Tabs`, tablas | constantes del dominio | — (solo lectura) | **PARCIAL** | Editar/persistir overrides |
| **Usuarios** | `/usuarios` | Alta, rol, activar/desactivar | formulario, tabla, `useConfirmacion` | `/api/admin/usuarios` (Supabase Auth + `perfiles`) | Crear, cambiar rol, (des)activar | **COMPLETA** | Verificar contra Supabase real |
| **Mi cuenta** | `/cuenta` | Cambiar contraseña | formulario | `/api/cuenta/contrasena` | Cambiar | **COMPLETA** | — |
| **Acceso / Restablecer** | `/acceso`, `/restablecer` | Login, recuperar | formularios | `/api/sesion`, `/api/recuperar`, `/api/restablecer` | — | **COMPLETA** (correo: no verificable) | — |
| **Componentes** (galería) | `/componentes` | Catálogo visual | todos | — | — | solo en desarrollo | — |

**Pantallas pedidas que NO existen como tal:** *Expediente* (es la pestaña Documentos), *ReadyCheck* (es la pestaña Validaciones), **PAER** (solo KPI en Indicadores y tabla en Cronograma; **sin captura de acuerdos**), **Auditoría** (**no hay pantalla** que lea `auditoria_eventos`).

## 7.2 Portal del cliente (`PortalLayout`: encabezado + navegación inferior)

| Pantalla | Ruta | Objetivo | Datos | Acciones | Estado | Falta |
| --- | --- | --- | --- | --- | --- | --- |
| **Acceso** | `/portal` | Folio + código; enlace directo `#folio=…&codigo=…`; muestra código de ejemplo en demo | `/api/portal/{estado,acceso}` | Entrar | **COMPLETA** | — |
| **Inicio** (= «Seguimiento») | `/portal/inicio` | Avance %, etapa actual, siguiente paso, etapas, cómo se calcula | `/api/portal/vista` (lista blanca) | Ir a documentos | **COMPLETA** (demo); con Zoho: avance *aproximado* | Pesos del avance por confirmar |
| **Documentos** (= «Documentación») | `/portal/documentos` | Pendientes, subir, recibos | idem + `POST /api/portal/documentos/:id` | Subir PDF/JPG/PNG/WEBP con progreso y acuse | **PARCIAL** | Sin lista con Zoho (no hay expediente); sin descarga; sin revisión interna |
| **Avisos** (= «Notificaciones») | `/portal/avisos` | Novedades derivadas del estado | idem | — | **PARCIAL** | Sin correo/WhatsApp ni «leído» |
| **Historial** | `/portal/historial` | Hechos públicos con etiquetas fijas | idem | — | **COMPLETA** | — |
| Cierre de sesión | botón «Salir» | `DELETE /api/portal/sesion` | — | — | **COMPLETA** | — |

## 7.3 ¿Datos reales, mocks o estáticos?
- **Mocks por diseño**: el caso KV-2026-004, el PAER, los hitos y el expediente (`src/data/kv-2026-004.demo.ts`), marcados `esMock: true` y mostrados con la franja «DEMO / Datos MOCK».
- **Textos fijos del dominio** (no «datos escritos en componentes»): nombres de etapas del cliente (`src/domain/portal/textos.ts`), catálogo de reglas.
- **Valores estáticos dentro de componentes:** la galería `/componentes` (solo dev). Las pantallas productivas no incrustan datos de ejemplo.
- **Reales:** usuarios, sesión, Zoho (lectura/estado de compuerta/observaciones), bitácora de integración, accesos y recepciones del portal (pendiente de probar con Supabase real).

# 8. «ReadyCheck» = motor de reglas

> **No existe nada llamado «ReadyCheck»** en el código ni en la documentación (búsqueda en `src/`, `server/`, `docs/`, `README.md`). Lo equivalente es el **motor de reglas** `src/domain/reglas/` y la pestaña *Validaciones*. Además, **la interfaz no dice** que la preparación del expediente no garantiza la aceptación de CFE: debe añadirse (M-14).

## 8.1 Cómo funciona **[V-CÓDIGO] + [V-EJEC] (38 pruebas del motor + 27 del flujo de 40 kW)**
- `ejecutarReglas(contexto, config?, opciones?)` (`motor.ts`): función **pura**; recibe documentos vigentes, configuración técnica y requisitos; devuelve **todos** los resultados (cumple / no cumple / no evaluable) ordenados por gravedad. Las pruebas pasan el contexto **congelado** (`Object.freeze` profundo) para demostrar que ninguna regla muta ni «corrige» datos.
- Cada resultado (`ResultadoValidacion`): `reglaId, reglaNombre, categoria, campo, documentosOrigen[{id,nombre,valor}], valorEncontrado, valorEsperado, resultado, severidad, explicacion, accionRecomendada, requiereAprobacionHumana, compuerta, huella, parametrosSupuestos`.
- **Severidades**: `bloqueante`, `mayor`, `menor`, `informativa` (solo los fallos las llevan; lo que cumple o no es evaluable es `informativa`).
- **`no_evaluable`**: cuando faltan datos; **nunca** se inventan.
- **Configurable sin tocar código**: `overrides` por regla (severidad, activa, parámetros, requiereAprobacionHumana) en `configuracion.ts`; **aún sin pantalla ni persistencia**.

## 8.2 Las 27 reglas (`CATALOGO_REGLAS`; `docs/REGLAS.md` tiene la tabla completa con parámetros)

| Grupo | Reglas | Qué hacen |
| --- | --- | --- |
| Comparación cruzada (11) | `CRU-001…011`: nivel de tensión, modelo de módulo, modelo de inversor, nº de paneles, potencia DC, potencia AC, RPU, ubicación, generación, strings, consumo | Comparan el valor de **cada documento** (y de la configuración técnica) entre sí. Texto normalizado; números con tolerancia relativa/absoluta **y detección de errores de orden de magnitud** (p. ej. 6,921.31 vs 697.52 kWh/mes); coordenadas por distancia (100 m). Todas **bloqueantes y con decisión humana**. |
| Coherencia técnica (9) | `TEC-001…009`: DC = paneles × W/panel; AC = inversores × kW; relación DC/AC (**supuesto** 1.0–1.5); strings suman paneles; tensión máx. del string (**supuesto**); generación vs referencia física (**supuesto** 6 h solares, 0.8, ±15 %); formato RPU (**supuesto** 12 alfanuméricos); coordenadas dentro de Sonora (**supuesto**); nivel de tensión válido (MT/BT) | Calculan un valor de **referencia** y lo comparan; no corrigen. |
| Obligatorios (3) | `OBL-001` campos obligatorios por documento; `OBL-002` documentos obligatorios por compuerta (según el catálogo **del código**); `OBL-003` datos técnicos obligatorios | Faltantes. |
| Vigencias (4) | `VIG-001` vencido (bloqueante); `VIG-002` por vencer (umbral 30 d, urgente ≤7 d → «mayor»; supuesto); `VIG-003` sin fecha de vigencia; `VIG-004` fechas incoherentes (vigencia < emisión) | Nunca asume una fecha. |

## 8.3 Preguntas específicas
| Pregunta | Respuesta |
| --- | --- |
| ¿Cómo detecta documentos faltantes? | `OBL-002` cruza el catálogo de requisitos del **código** con los tipos de documento recibidos; `evaluarChecklist` hace lo mismo para el progreso y la carpeta física. |
| ¿Vencidos? | `VIG-001` con la fecha `hoy` pasada como parámetro (resultados reproducibles). |
| ¿Campos no declarados vs declarados vacíos? | En el modelo del código: **entrada ausente = no declarado**; **`valor: null` o `''` = declarado vacío**. `OBL-001` marca el vacío (y los obligatorios ausentes, p. ej. el croquis exige `coordenadas_croquis` y `referencia_croquis`). Equivale a la semántica de la BD (`declarado`/`valor_texto`) pero **hace falta un mapeo explícito** cuando se conecte (el CHECK de la BD solo admite 5 campos). |
| ¿Cómo compara documentos? | `comparacion.ts` por tipo de valor (texto, número, coordenadas). Con N valores distintos devuelve **todos con su documento**; no elige. |
| ¿Discrepancias técnicas? | Reglas `TEC-*` y `CRU-*` sobre la configuración técnica. |
| ¿Cómo muestra resultados? | `ValidationCard` (título, severidad, tabla «lo que declara cada documento», acción recomendada, «requiere decisión de una persona», botón «Abrir evidencia») y `DiscrepancyPanel`. |
| ¿Falsos positivos? | Riesgos: (1) `OBL-002` depende del catálogo del código, que **no coincide** con el de Supabase (C-3); (2) las reglas `supuesto` (TEC-003/005/006/007/008, VIG-002) pueden marcar casos válidos hasta confirmar umbrales con IDC; (3) el checklist asocia **un solo documento por tipo** (`find`); varias copias del mismo tipo se evalúan en las reglas cruzadas pero cuentan una vez en el checklist; (4) con datos incompletos devuelve `no_evaluable`, no «cumple» (no hay falso negativo por falta de datos). |
| ¿Resolución humana? | Sí: `observacionDesdeValidacion` → `asignarResponsable` → `resolverObservacion` (reglas: responsable, fecha, justificación ≥10 caracteres; `corregido` exige que al **revalidar** ya cumpla; excepciones exigen rol `aprobar_excepciones`; **la excepción vale solo para ese valor** y la observación se **reabre sola** si el dato cambia). **Persistencia: `localStorage`.** |
| ¿Bloqueantes vs advertencias? | Sí (4 severidades). `evaluarBloqueoCompuerta` devuelve **todas** las razones (validaciones bloqueantes pendientes —por defecto en G2—, compuertas previas, documentos faltantes, observaciones CFE/UVIE abiertas). |
| ¿Historial de ejecuciones? | **No.** El motor se vuelve a ejecutar en cada render; no se guarda cuándo se corrió ni qué resultó (existe la constante `validacion_ejecutada` en `evento-auditoria.ts`, sin uso). El historial muestra decisiones, no ejecuciones. |
| ¿Garantiza aceptación de CFE? | **No, y no se dice en pantalla.** |
