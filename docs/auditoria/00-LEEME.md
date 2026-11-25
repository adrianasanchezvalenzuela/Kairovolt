# Auditoría técnica de KairóVolt — índice y método

Fecha de la auditoría: 2026-11-24 · Rama `main` · Auditor: asistente de IA (solo lectura; **no se modificó código, SQL ni datos**).
Este reporte está dividido en partes para que otro asistente pueda retomarlo sin investigar desde cero.

| Parte | Contenido | Secciones del encargo |
| --- | --- | --- |
| [01](01-arquitectura-y-flujos.md) | Tecnologías, carpetas, arquitectura, diagramas, flujo de login, origen de los datos, variables, comandos, inventario de archivos | 3, 14 (parcial) |
| [02](02-supabase-esquema-y-seguridad.md) | Esquema real de Supabase (14 tablas + 1 vista), catálogo de 21 requisitos, RLS, Storage, auditoría, auth, portal | 4, 5 |
| [03](03-zoho-pantallas-readycheck.md) | Integración Zoho, pantallas del panel y del portal, motor de reglas («ReadyCheck») | 6, 7, 8 |
| [04](04-diseno-pruebas-estado.md) | Diseño/UX, pruebas, clasificación COMPLETA/PARCIAL/MOCK/… de cada funcionalidad | 9, 10, 11 |
| [05](05-hallazgos-roadmap-resumen.md) | Hallazgos por severidad, roadmap, resumen ejecutivo para el siguiente asistente | 12, 13, 14 |

## Cómo se verificó cada afirmación (leer antes de confiar en algo)

| Marca | Significa |
| --- | --- |
| **[V-EJEC]** | Lo ejecuté en esta auditoría y vi el resultado (pruebas, typecheck, build, SQL contra un Postgres de pruebas). |
| **[V-CÓDIGO]** | Lo leí en el código o en el SQL (archivo y línea citados). El código dice eso; no significa que se haya ejecutado contra el servicio real. |
| **[NO-VERIFICABLE]** | Requiere acceso que no tengo (proyecto Supabase real, cuenta Zoho real, panel de Supabase). |

### Qué servicios pude y no pude tocar

- **Supabase real: SIN ACCESO.** No tengo credenciales (`server/.env` está bloqueado para mí y no debo leerlo) ni acceso al panel. **No pude comprobar** qué migraciones están realmente aplicadas, qué filas hay, la configuración de Auth (registro abierto, correo, SMTP, URL de redirección) ni las políticas *reales* de tu base.
  Lo que sí hice: apliqué las **7 migraciones + seed en un Postgres en memoria (PGlite, Postgres compilado a WASM) con roles `anon`/`authenticated`/`service_role` simulados** y ejecuté 46 comprobaciones de constraints, RLS por rol, auditoría y Storage, más 15 de la migración 006, 8 de la 007 y 5 extra de auditoría **[V-EJEC]**. PGlite no es Supabase: `auth.uid()`, `storage.*` y los roles son simulaciones mías; el comportamiento de PostgREST/Storage real no está cubierto.
- **Zoho real: SIN ACCESO DIRECTO en esta auditoría.** No hice llamadas a Zoho. En fases anteriores de esta misma sesión de trabajo, la interfaz mostró «Zoho: autenticación verificada» y se leyeron tratos/proyectos reales con el refresh token del dueño; **no re-verifiqué** tras regenerar el token con nuevos scopes ni probé **ninguna escritura real** de la Fase 3 (WorkDrive, creación de proyectos/tareas/listas, upsert de tratos).
- **Vercel: NO PROBADO** (hay una función preparada).

### Cifras del código (verificadas)

- ~14,990 líneas de TypeScript/TSX (`src/`, `server/`, `api/`), 30 archivos de prueba, **450 pruebas, todas en verde** **[V-EJEC]** (`npx vitest run`).
- `npm run typecheck` limpio y `npm run build` correcto **[V-EJEC]** (JS 466 kB / 137 kB gzip, CSS 30 kB).
- **Git: solo 2 commits** (`molde del proyecto`, `Fase 6: integración real con Zoho CRM y Projects…`). **129 entradas sin commitear** (todo el trabajo de las fases 2–7 de esta sesión). Riesgo de pérdida: ver hallazgo C-1.

## Resumen en diez líneas

1. Hay una **aplicación completa que funciona de punta a punta, pero sobre datos de demostración**: panel interno con 10 pantallas + detalle con pestañas, portal del cliente móvil, motor de reglas (27 reglas), Stage-Gate con transiciones validadas.
2. **Zoho es real para lectura** (tratos y proyectos con folio) y para escribir **estado de compuertas y observaciones**; el resto de la integración (CRM upsert, Projects creación, WorkDrive) está construido y probado **solo con simulaciones**.
3. **Supabase real se usa para**: login del personal, perfiles/roles, auditoría de acciones del panel, bitácora de sincronización, accesos y recepciones del portal.
4. **Casi todo el esquema documental de Supabase NO está conectado a la aplicación**: `documentos`, `documento_datos_declarados`, `sistemas_fotovoltaicos`, `requisitos_documentales`, `resoluciones_documentales`, `aprobaciones_checklist_g2`, `acuerdos_paer` y `v_paer_semanal` **no tienen ninguna línea de código que las lea o escriba**.
5. Por eso con datos reales de Zoho **no hay expediente**: las validaciones, el checklist y el PAER solo funcionan con el caso demostrativo KV-2026-004.
6. Las decisiones humanas (observaciones, responsables, resoluciones, liberar compuertas) se guardan en **`localStorage` del navegador**, no en la base.
7. El **catálogo de requisitos del código (21, con G0–G3) no coincide con el de Supabase (21 distintos)** y los campos declarados de la BD (5) son menos que los del motor (13).
8. La seguridad del backend está razonablemente construida (cookies HttpOnly/Strict, permisos por rol revalidados, portal por lista blanca), con huecos concretos: cookies sin `Secure`, sin cabeceras de seguridad, `api/index.ts` sin `PATCH`, políticas de lectura de `sincronizaciones`/`referencias_externas` abiertas a cualquier `authenticated`, `TRUNCATE` posible sobre la auditoría con `service_role`.
9. **No existe nada llamado «ReadyCheck»** en el código: el equivalente es el motor de reglas (`src/domain/reglas`) mostrado en la pestaña Validaciones.
10. Para una demo profesional está casi listo; para uso real faltan: conectar el expediente a Supabase, persistir decisiones, commitear, y cerrar los hallazgos críticos/altos de la parte 05.
