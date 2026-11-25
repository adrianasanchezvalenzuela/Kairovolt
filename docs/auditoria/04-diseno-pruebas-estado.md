# Parte 04 — Diseño y experiencia, pruebas y clasificación de estado

# 9. Diseño y experiencia de usuario

## 9.1 Identidad visual **[V-CÓDIGO]** `src/styles/tokens.css`

| Pedido | Implementado | Valor |
| --- | --- | --- |
| Navy | ✔ `--kv-navy` | `#102b40` (barra lateral, portal, texto) |
| Teal | ✔ `--kv-teal` | `#176b70` (acento, botón primario, «ok») |
| Ámbar | ✔ `--kv-ambar` | `#f2bd55` (borde activo de la barra lateral, anillo de avance, alerta sólida) |
| Hielo | ✔ `--kv-hielo` | `#e9eff2` (encabezados de tabla, fondos suaves) |
| Fondo | ✔ `--kv-fondo` | `#f7f8fa` |

Colores **semánticos añadidos** fuera de la paleta de 5: rojo de error `#b3372f` y un ámbar oscuro de texto `#8a5a0b` (para contraste). Tipografías: Inter e IBM Plex Mono (Google Fonts; con respaldo del sistema).

## 9.2 Los 5 estados pedidos

| Estado pedido | Tono en el código | Color | Observación |
| --- | --- | --- | --- |
| Validado | `ok` | teal | Usado en «Completada/Recibido/Aceptado/Cumple». |
| Por vencer | `alerta` | ámbar | ✔ |
| Bloqueante | `error` | rojo | ✔ (además de «solido» para énfasis). |
| En revisión | **panel:** `alerta` (ámbar) · **portal:** `info` (navy) | ámbar / navy | ⚠ **Inconsistente**: en el panel «En revisión» comparte color con «Por vencer»; en el portal usa otro tono. Definir uno. |
| Sin iniciar | `neutro` | gris | ✔ («Pendiente» en el panel, «Por iniciar» en el portal). |

El color **nunca** es la única señal: todos los estados llevan texto (`StatusBadge`).

## 9.3 Evaluación por criterio

| Criterio | Evaluación | Evidencia |
| --- | --- | --- |
| Consistencia visual | **Buena**: un solo sistema de componentes (19 pedidos en la Fase 5 + `Boton`, `ProgressBar`, `Tabs`, `Dialogo`); clases `.kv-*` con tonos compartidos. El portal tiene un lenguaje visual propio (`.kvp-*`) a propósito. | `src/components/ui`, `src/styles/*.css` |
| Jerarquía | Buena en panel (PageHeader, KPI, tablas) y en portal (anillo, tarjeta de siguiente paso). | capturas en navegador (sesión) |
| Navegación | Barra lateral con 4 secciones; pestañas en el detalle (`aria-selected`, flechas, URL `?tab=`); portal con barra inferior de 4 destinos. | `Sidebar.tsx`, `Tabs.tsx`, `PortalLayout.tsx` |
| Responsive | Panel: barra lateral colapsable <900 px, tablas con scroll horizontal. Portal: **mobile-first** (base 375 px, barra inferior, botones ≥52 px; en ≥900 px la navegación pasa arriba). Verificado en navegador con emulación 375×812: **sin desbordes horizontales** (medido con `scrollWidth`). | **[V-EJEC]** |
| Móvil real | **No probado en dispositivo físico**; la cámara/`capture` del `<input type=file>` depende del navegador. | — |
| Accesibilidad | Foco visible global, enlace «Saltar al contenido», roles ARIA (`tablist`, `progressbar`, `status/alert`, `dialog` nativo con foco inicial en «Cancelar»), tablas con `scope`, `prefers-reduced-motion`, textos para lectores en iconos. Contraste: cálculo manual, **no medido con herramienta (axe/Lighthouse no disponibles)**. | `global.css`, `ConfirmationModal.tsx`, pruebas de marcado |
| Estados vacíos / carga / error | ✔ `EmptyState`, `LoadingState`, `ErrorState` en todas las pantallas; el portal los usa en acceso, layout y cada sección. | `src/components/ui/Estados.tsx` |
| Confirmaciones | ✔ `useConfirmacion` (reemplaza `window.confirm`), diálogos con motivos, avisos `AlertPanel`; subida del portal con acuse. | — |
| Formularios | Validación en cliente (longitudes, formato, contraseña ≥12 con letras y números, archivos) y **siempre revalidada en el servidor**. Etiquetas asociadas, mensajes de error. | `Usuarios.tsx`, `DialogosValidacion.tsx`, `SubirDocumento.tsx` |
| Tablas | Encabezados semánticos, scroll en móvil; **sin paginación ni ordenación por columna**. | — |
| Feedback | Franja de fuente de datos (MOCK/Zoho), insignias de estado, mensajes de simulación vs escritura real. | — |

## 9.4 ¿Prototipo o listo para usar?

| Pantalla | Veredicto |
| --- | --- |
| Acceso del portal, Inicio del portal, Historial del portal | **Lista para demo** |
| Documentos del portal (subida) | Lista para demo (en demo no conserva archivos) |
| Panel, Proyectos, Detalle (Resumen/Stage-Gate/Validaciones/Historial) | **Lista para demo** con el caso KV-2026-004 |
| Documentos/Validaciones/Cronograma/Seguimiento CFE/Indicadores (cartera) | Lista para demo; **parecen prototipo** con datos reales de Zoho (sin expediente/PAER) |
| Integraciones | Lista (solo simulación) |
| Configuración | **Prototipo**: solo lectura |
| Usuarios, Mi cuenta, Acceso, Restablecer | Listas (pendiente verificar contra Supabase real) |
| Componentes | Interna (dev) |

# 10. Pruebas y calidad

## 10.1 Ejecución **[V-EJEC]** (2026-11-24)

| Comando | Resultado |
| --- | --- |
| `npx vitest run` | **30 archivos, 450 pruebas, 0 fallos.** |
| `npm run typecheck` (`tsc --noEmit`) | Sin errores. |
| `npm run build` | Correcto (`dist/assets`: JS 466 kB / 137 kB gzip, CSS 30 kB). |
| Advertencia observada | Vite avisa que `vite.config.ts` y los módulos que importa usan importaciones **sin extensión** que no serían compatibles con `configLoader: 'native'` (futuro por defecto): hoy no falla. |
| SQL | 7 migraciones + seed aplicadas en PGlite sin errores; 46 + 15 + 8 + 5 comprobaciones OK (scripts **fuera del repo**). |
| No ejecutado | E2E (no existen), pruebas contra Supabase real, contra Zoho real, en Vercel, en dispositivo móvil físico, auditoría de accesibilidad automatizada. |

## 10.2 Inventario de pruebas existentes

| Tipo | Archivo(s) | N.º |
| --- | --- | --- |
| **Dominio / unitarias** | `src/domain/reglas/reglas.test.ts` (motor) · `flujo-40kw.test.ts` (caso real de 40 kW de punta a punta) · `checklist` · `validacion` (legada) · `seguimiento` · `indicadores/paer` · `folio-clasificacion` · `usuarios` · `portal/avance` · `proyecto/potencia` | 38 · 27 · 12 · 12 · 7 · 6 · 15 · 10 · 9 · 1 |
| **Aplicación** | `application/plataforma.test.ts` (transiciones, decisiones, alertas, historial, demo KV-2026-004) · `portal-cliente.test.ts` (proyección pública) · `integracion.test.ts` | 25 · 13 · 5 |
| **Backend / integración** | `server/auth.test.ts` (login, cookie, roles) · `cuenta` · `usuarios` · `kv` · `servidor` · `zoho/zoho.test.ts` · `zoho/cliente.test.ts` (reintentos) · `zoho/adaptadores.test.ts` · `integracion/sincronizacion.test.ts` · `integracion/rutas.test.ts` · `portal/portal.test.ts` (acceso, permisos, subida, adaptadores Supabase simulados) | 21 · 12 · 16 · 15 · 14 · 19 · 13 · 30 · 19 · 8 · 29 |
| **Componentes (render a HTML, sin DOM)** | `components/componentes.test.ts` · `plataforma-ui.test.ts` · `portal/portal-ui.test.ts` | 33 · 13 · 5 |
| **Infraestructura del frontend** | `zoho-http.test.ts` · `cuenta-http.test.ts` · `usuarios-http.test.ts` | 12 · 5 · 6 |
| **E2E** | **ninguna** | 0 |
| **RLS / Storage** | **ninguna en el repo** (solo scripts ad hoc fuera de él) | 0 |
| **Formularios / validación de documentos** | `clasificarArchivos`, `validarArchivo`, `detectarTipo`, `sanearNombre`, contraseñas | incluidas arriba |

Observaciones: los dobles de Supabase y Zoho (`server/supabase/falso.ts`, `server/zoho/falso.ts`) son **simulaciones propias**: validan nuestra lógica, no el comportamiento real de los servicios. Los componentes se prueban por marcado estático (no hay jsdom): **no se prueban clics, foco ni teclado reales**, que sí se verificaron a mano en el navegador.

## 10.3 Pruebas que faltan (prioridad)

1. **Suite RLS/Storage reproducible en el repo** (PGlite o Postgres local) con los scripts que hoy están fuera: bloquea regresiones de seguridad. **Alta.**
2. **Pruebas de contrato contra Supabase real** (staging) para accesos del portal, recepciones, Storage y RPC de auditoría. **Alta.**
3. **E2E** (Playwright): login → panel → resolver validación; portal: acceso por enlace → subir → acuse; revocación. **Alta.**
4. **Pruebas contra Zoho sandbox**: creación de proyecto/lista/tarea, upsert de trato, WorkDrive, mapeo de estados. **Alta** antes de usar escrituras de la Fase 3.
5. Persistencia de decisiones (cuando exista), concurrencia y reapertura automática con datos reales. Media.
6. Accesibilidad automatizada (axe) y contraste medido. Media.
7. Migraciones: prueba de «aplicar desde cero» y de idempotencia en CI. Media.
8. Carga: tamaño máximo de subida, 429 del limitador, reintentos con `Retry-After`. Baja.

# 11. Clasificación de funcionalidades

Estados: **COMPLETA** (funciona y está conectada) · **PARCIAL** · **MOCK** · **PENDIENTE** · **BLOQUEADA** · **NO VERIFICABLE**. Cuando una funcionalidad está completa en código pero no pude comprobarla contra el servicio real, lo indico en «Nota».

| # | Funcionalidad | Estado | Nota / evidencia |
| --- | --- | --- | --- |
| 1 | Login correo/contraseña del personal | **COMPLETA** | `server/app.ts`, 21 pruebas con Supabase simulado. Contra Supabase real: **NO VERIFICABLE** ahora (usado antes por el dueño). |
| 2 | Perfiles y roles; permisos por ruta en el backend | **COMPLETA** | `permisos.ts` + `exigir()`; pruebas de 403 por rol. |
| 3 | Gestión de usuarios y cambio de contraseña | **COMPLETA** | Con Supabase simulado; real **NO VERIFICABLE**. |
| 4 | Recuperación de contraseña por correo | **BLOQUEADA** / **NO VERIFICABLE** | Depende del SMTP y URLs de redirección del panel de Supabase. |
| 5 | Primer administrador | **PARCIAL** | Manual por SQL o con `ADMIN_TOKEN`. |
| 6 | Lectura de Zoho (tratos, proyectos, tareas G0–G3, notas) | **COMPLETA** | Verificada en vivo en fases previas; **no re-verificada hoy**. |
| 7 | Cambio de estado de compuerta en Zoho Projects | **COMPLETA** (código+pruebas) | Escritura real **NO VERIFICABLE** hoy; validación de transición en dominio. |
| 8 | Observaciones en Zoho CRM (crear/cerrar) | **COMPLETA** (código+pruebas) | Ídem. |
| 9 | Sincronización de proyecto (CRM upsert, Projects, WorkDrive) | **PARCIAL** / **BLOQUEADA** | Solo simulación probada; cuerpos de creación sin verificar; trato requiere `etapaInicial`; WorkDrive requiere carpeta raíz y scopes. |
| 10 | Webhooks de Zoho / eventos entrantes | **PENDIENTE** | Sin código. |
| 11 | Expediente documental en Supabase (documentos, datos declarados, sistema FV) | **PENDIENTE** | Esquema listo; **ningún código lo usa**. |
| 12 | Catálogo editable de requisitos en la aplicación | **PENDIENTE** | La app usa otro catálogo (en código); conflicto C-3. |
| 13 | Carga de documentos por el personal; URLs firmadas; vista previa de archivos reales | **PENDIENTE** | `DocumentUploader`/`DocumentPreview` existen sin cablear. |
| 14 | Motor de reglas (27 reglas) | **COMPLETA** | Sobre datos en memoria; 38+27 pruebas. |
| 15 | Pantalla de validaciones (comparación, severidad, evidencia) | **COMPLETA** (UI) / **MOCK** (datos con Zoho no existen) | |
| 16 | Observaciones/responsables/resoluciones/liberación de compuertas | **PARCIAL** | Lógica completa; **persistencia solo en `localStorage`**. |
| 17 | Aprobaciones del checklist G2 y snapshot | **PENDIENTE** | Tabla lista; la UI registra «quién aprobó» localmente sin snapshot. |
| 18 | Stage-Gate: transiciones inválidas impedidas | **COMPLETA** | `transiciones.ts` + pruebas; en Zoho también escribe. |
| 19 | PAER: cálculo y KPI | **COMPLETA** (cálculo) / **MOCK** (datos) | `paer.ts`. |
| 20 | PAER: captura de acuerdos semanales | **PENDIENTE** | Sin formulario ni uso de `acuerdos_paer`. |
| 21 | Auditoría: escritura de acciones del panel | **PARCIAL** | No cubre decisiones locales ni inicios de sesión. |
| 22 | Auditoría: pantalla de consulta | **PENDIENTE** | |
| 23 | Portal: acceso, avance, etapa, siguiente paso, historial, avisos | **COMPLETA** (demo) | Con Zoho el avance es aproximado; Supabase real **NO VERIFICABLE**. |
| 24 | Portal: subir archivos y acuse | **PARCIAL** | En demo no se conservan; Storage/BD reales sin probar; migración 007 probablemente no aplicada. |
| 25 | Portal: revisión de archivos por el personal | **PENDIENTE** | Solo columnas de estado en la tabla. |
| 26 | Portal: descarga/URLs firmadas; notificaciones por correo/WhatsApp | **PENDIENTE** | |
| 27 | Generar/revocar accesos del portal (panel) | **COMPLETA** (código+pruebas) | Real **NO VERIFICABLE**. |
| 28 | Dashboard, Proyectos, Cronograma, Seguimiento CFE, Indicadores | **PARCIAL** | Con Zoho faltan expediente y PAER. |
| 29 | Integraciones (UI) | **COMPLETA** | Solo simulación. |
| 30 | Configuración editable (reglas, umbrales, permisos) | **PENDIENTE** | Solo lectura. |
| 31 | Caso demostrativo KV-2026-004 | **MOCK** | `src/data/kv-2026-004.demo.ts`; sin archivos reales. |
| 32 | Clasificación automática de documentos, generación de folios, versiones de documento | **PENDIENTE** (integración) | Dominio probado, sin pantalla. |
| 33 | Cabeceras de seguridad HTTP, cookie `Secure` | **PENDIENTE** | A-4. |
| 34 | Despliegue en Vercel | **BLOQUEADA** | Función sin probar y con bug (A-5). |
| 35 | CI, lint, E2E | **PENDIENTE** | No existen. |
