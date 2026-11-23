<!--
Cómo usarlo: copia TODO lo que está debajo de la línea "=== INICIO DEL PROMPT ===" y pégalo en ChatGPT (modelo con razonamiento).
Si la respuesta se corta, escribe "continúa desde donde te quedaste" o pídele una sección a la vez (ver sección 10).
Este archivo no contiene credenciales ni datos de clientes.
-->

=== INICIO DEL PROMPT ===

# Rol y objetivo

Actúa como **arquitecto de bases de datos senior especializado en PostgreSQL y Supabase** (Auth, Row Level Security, Storage) y como revisor de seguridad. Vas a **diseñar completa la base de datos en Supabase** de un producto que ya existe y funciona (código en TypeScript), para que **las tablas embonen directo con mi código sin tener que reescribirlo**.

Entrégame: esquema SQL, relaciones, enums, índices, triggers, políticas RLS, políticas de Storage, datos de prueba y un script de verificación. El formato exacto está en la sección 9. **No inventes requisitos de negocio**: si algo no está en este documento, di tu supuesto explícitamente (sección 10) en vez de decidirlo en silencio.

---

# 1. Contexto del producto

**KairóVolt** es una plataforma de control y seguimiento del proceso de **interconexión eléctrica ante CFE** (generación distribuida fotovoltaica, < 0.7 MW, media tensión) para **IDC Sistemas Eléctricos** (Hermosillo, Sonora, México). Objetivo: **prevenir reingresos documentales**, detectar inconsistencias técnicas, controlar etapas (compuertas), gestionar vigencias y dar trazabilidad a IDC y a sus clientes.

Stack actual (ya construido y con 106 tests):
- Frontend: React + Vite + TypeScript. **El navegador nunca habla con Zoho ni (en el futuro) con Supabase con llaves privilegiadas**: solo llama a `/api/*`.
- Backend: Hono (TypeScript), corre en el mismo puerto que Vite en desarrollo y como función serverless en **Vercel** en producción. Es el único que habla con Zoho y, a futuro, con Supabase (con `service_role`, solo en variables de entorno del servidor).
- Zona horaria del negocio: **America/Hermosillo** (UTC−7, sin horario de verano). Las fechas de negocio son `date` (sin hora); los instantes son `timestamptz`.
- Idioma: **español**. Nombres de tablas/columnas en `snake_case` en español, comentarios SQL en español.

Arquitectura de capas en el código (para que tu diseño la respete): `domain` (reglas puras) → `application` (casos de uso/puertos) → `infrastructure` (adaptadores) → UI. Las reglas de negocio (validación cruzada, vigencias, checklist, PPC/PAER) están **en código, calculadas al vuelo**; la base de datos guarda **hechos**, no resultados derivados.

---

# 2. Principio rector: qué vive en Zoho y qué en Supabase (NO DUPLICAR)

**Zoho es el sistema de registro** de lo comercial/operativo. **Supabase guarda solo lo que Zoho no tiene.** Duplicar datos entre ambos crearía dos fuentes de verdad que se desincronizan.

| Dato | Dueño | Notas |
|---|---|---|
| Trato (Deal): nombre, etapa, fecha de cierre, cuenta (cliente), contacto | **Zoho CRM** | **No crear tablas** para esto |
| Cliente / cuenta (nombre, ciudad, estado) | **Zoho CRM** | No duplicar |
| Proyecto de Zoho Projects (nombre, estado) | **Zoho Projects** | No duplicar |
| **Compuertas G0–G3** y su estado | **Zoho Projects** (una tarea por compuerta: `G0 — …`, `G1 — …`; estado de la tarea = estado de la compuerta) | No crear tabla de compuertas con estado |
| Cronograma (inicio/fin plan y fin real) | **Zoho Projects** (fechas de esas tareas) | No duplicar; PPC se calcula de ahí |
| **Observaciones** (origen cfe/uvie/interna, estado abierta/en_atencion/cerrada, responsable, fecha compromiso) | **Zoho CRM**, como notas del trato con una marca `[KV-OBS:<id>:<estado>]`; la más reciente por id define el estado | **No crear tabla de observaciones** |
| Expediente documental, vigencias, datos declarados | **Supabase** | Hoy no existe en ningún lado |
| Datos técnicos del sistema FV | **Supabase** | |
| Acuerdos semanales (base del PAER) | **Supabase** | |
| Usuarios, roles, auditoría, accesos de portal | **Supabase** | |
| Archivos de los documentos | **Supabase Storage** (privado) mientras no exista Zoho WorkDrive | Dejar columna opcional para un futuro id de WorkDrive |

Si crees que alguna tabla de Supabase necesita una **copia de solo lectura/caché** de algo de Zoho, **dilo como propuesta separada y justifícalo**, no la incluyas por defecto.

---

# 3. Cómo se enlaza con Zoho: el folio KV

Cada proyecto se identifica por su **folio KV** (ejemplo real: `KV-2026-004`), que aparece al inicio del nombre del trato y del proyecto en Zoho (`KV-2026-004 - Interconexión FV 40 kW Hermosillo`). El backend lo extrae con `/^(KV-\d{4}-\d{3,})/i` y lo normaliza a **MAYÚSCULAS**.

Requisitos para la tabla de proyectos de Supabase (mínima, **no duplica nada de Zoho**):
- **Llave natural: `folio` (text, único, siempre en mayúsculas)**. El frontend usa el folio como `id` del proyecto, así que **todas las demás tablas se enlazan por `folio`** (FK) y no por un uuid artificial.
- Formato de producción: `^KV-\d{4}-\d{3,}$`. **Excepción**: mi proyecto de demostración usa `KV-MOCK-0001` (no cumple ese patrón) → permite datos de demostración con una columna `es_demo boolean` y un CHECK que acepte ambos formatos, sin debilitar el de producción.
- Columnas opcionales de enlace: `zoho_deal_id text`, `zoho_project_id text` (ids numéricos largos de Zoho, guárdalos como **text**).
- Configuración **por proyecto** de una regla que varía por Zona de Distribución de CFE: `uvie_antes_de_ingreso boolean default false` (si el dictamen UVIE se exige antes del ingreso de la solicitud → el requisito pasa de la compuerta G3 a G2).
- Un proyecto puede existir en Supabase antes o después que en Zoho; no asumas orden de creación.

---

# 4. Qué hay que guardar en Supabase (módulos)

## A. Expediente documental
Cada documento **recibido** de un proyecto. Un documento que existe = recibido (**no hay estado "faltante"**: lo faltante se deduce comparando contra el catálogo de requisitos).
- Puede haber **varios documentos del mismo tipo** en un proyecto (p. ej. dos copias de la solicitud, con valores distintos). El checklist se cubre si existe **al menos uno** de ese tipo.
- Campos: id, folio (FK), `tipo` (enum, ver §5), `nombre` (text), `fecha_emision date null`, `fecha_vigencia date null` (fecha de **vencimiento** declarada en el documento), referencia al archivo (`storage_path`, `nombre_archivo`, `tipo_mime`, `tamano_bytes`, `sha256` opcional) y columna opcional `workdrive_file_id`, quién lo subió/cuándo.
- **`null` en una fecha significa "no capturada": NUNCA se infiere ni se rellena.**

## B. Datos declarados por documento (insumo de la validación cruzada)
Valores que se extraen/capturan de cada documento para detectar inconsistencias entre documentos. En código: `{ campo: CampoDato, valor: string | number | null }`.
- `campo` es un enum cerrado (ver §5). Tres campos son "cruzados" (deben coincidir entre todos los documentos que los declaran): `nivel_tension`, `modelo_modulo`, `consumo_kwh_mes`. Los otros dos solo detectan vacíos.
- **Distinción crítica:** un campo **declarado pero vacío** (`valor: null` o cadena vacía) significa "el documento tiene el campo pero está sin llenar" (p. ej. croquis incompleto) y es **distinto de "el documento no declara ese campo"** (no hay fila). Tu modelo debe poder representar ambos casos.
- `consumo_kwh_mes` es numérico (ej. `6921.31`, `697.52`); los demás son texto (`MT`, `BT`, `CS6.2-66TB-615`).
- Un mismo documento no debe repetir el mismo `campo`.
- Propón el modelo (tabla hija con `valor_texto`/`valor_numerico` o `jsonb`) y justifica; **debe poder devolverse fácilmente como el arreglo `[{campo, valor}]`** (vista o función).

## C. Datos técnicos del sistema fotovoltaico (1 por proyecto)
Campos exactos que espera el código (`SistemaFotovoltaico`): `numero_paneles int`, `potencia_panel_w` (W por panel, numérico), `potencia_ac_kw` numérico, `numero_inversores int`, `marca_inversor text`, `potencia_inversor_kw` numérico, `transformador_kva` numérico. **La potencia DC (kWp) NO se guarda**: se calcula como `numero_paneles × potencia_panel_w / 1000` (ej. 74 × 615 W = 45.51 kWp). Pon CHECKs (> 0).

## D. Catálogo de requisitos documentales (configuración editable por IDC)
Hoy es una constante en código; quiero que sea **tabla editable** porque IDC todavía está validando qué exige cada compuerta. Estructura de `Requisito`: ver §5. Debe incluir los **21 requisitos base** de la sección 8 como datos semilla. Regla del código: **`obligatorio = false` exactamente cuando hay `condicion`**.

## E. Checklist anti-reingresos y hallazgos
- Los **hallazgos se calculan en código** (discrepancia entre documentos, campo incompleto, vigencia vencida/por vencer/sin fecha/fechas incoherentes). **No los persistas como fuente de verdad** (se recalculan siempre).
- Lo que sí hay que persistir son las **decisiones humanas**, porque el sistema **nunca decide cuál versión de un documento es la correcta**: tabla de **resoluciones de hallazgos** (folio, clave estable del hallazgo p. ej. `discrepancia:modelo_modulo`, `valor_confirmado` texto, `documento_id` que se tomó como correcto (opcional), `comentario`, quién y cuándo, y si se **revoca/reabre**).
- Y el **registro de aprobación del checklist de consistencia cruzada y vigencias** de la compuerta G2 (quién aprobó, cuándo, y una **instantánea** `jsonb` de lo evaluado en ese momento). Esa aprobación es la evidencia exigida por el requisito `checklist_consistencia`.
- Regla de negocio que el esquema debe poder sustentar: **G2 no puede solicitarse con hallazgos bloqueantes abiertos** (la aplicación lo evalúa; tú provee los datos y, si aporta, una vista).

## F. Acuerdos semanales — "Sprint de Energización" (base del PAER)
Rutina de los **lunes 8:30–9:00** con proyectista, supervisor de campo y coordinación administrativa. Cada acuerdo: `id`, `folio` (FK), `semana date` (fecha de la sesión en que se acordó = corte del PAER), `descripcion text`, `responsable text null` (hoy texto libre; propón enlazarlo opcionalmente a un usuario), `estado` enum (`completada` | `pendiente` | `no_realizada`).
- **PAER = completadas / total acordadas × 100** (por semana; `null` si no hubo acciones, nunca 0 % falso). Meta semanal > 90 %. **Se calcula, no se guarda.**
- Quiero poder consultar el PAER semanal con una **vista SQL** como apoyo (aunque la fuente de cálculo sigue siendo el código).

## G. Auditoría
Registro **append-only** (nadie puede editar ni borrar, ni siquiera los admins desde la app): quién (usuario o "sistema"), cuándo (`timestamptz`), acción, entidad y id de entidad, `folio`, **antes/después** (`jsonb`) y origen (`ui` | `sync_zoho` | `sistema`). Debe cubrir cambios en A–F **y también los envíos hacia Zoho** que hace el backend (cambio de estado de una compuerta, creación/cierre de observación), porque Zoho no sabe qué usuario de KairóVolt los originó. Implementa con triggers + una función que el backend pueda llamar para eventos que no son cambios de tabla.

## H. Usuarios, roles y accesos
- **Autenticación: Supabase Auth** (correo + contraseña). Hoy el panel usa un único `ADMIN_TOKEN` compartido; esto lo reemplaza.
- Tabla `perfiles` enlazada a `auth.users` (nombre, rol, activo). **El rol NO debe vivir en `user_metadata`** (el usuario puede editarlo); define dónde vive y cómo llega al JWT o cómo lo consulta una función `security definer`.
- Roles internos (propón la matriz de permisos y justifícala): `admin`, `coordinacion_admin`, `proyectista`, `supervisor_campo`, `consulta` (solo lectura).
- **Los clientes NO son usuarios de Supabase.** Acceden al **portal** con su folio + un **token aleatorio**: tabla `portal_accesos` (folio, **hash** del token —nunca el token en claro—, creado_por, `expira_en`, `revocado_en`, `ultimo_uso`). El backend valida el token y arma una **proyección de solo lectura** (ver §7); el cliente jamás consulta tablas directamente.

---

# 5. Contrato con mi código (enums y tipos EXACTOS)

Respeta **literalmente** estos valores y formas; el frontend y el backend ya los usan.

```ts
type CompuertaId = 'G0' | 'G1' | 'G2' | 'G3';
type EstadoCompuerta = 'pendiente' | 'en_revision' | 'liberada' | 'bloqueada'; // vive en Zoho, solo referencia

// 21 tipos de documento (cerrado)
type TipoDocumento =
  // G0
  | 'consulta_capacidad_mt' | 'recibo_cfe' | 'datos_preliminares'
  // G1 cliente
  | 'identificacion_oficial' | 'constancia_situacion_fiscal' | 'carta_poder' | 'acta_constitutiva'
  // G1 ingeniería
  | 'croquis' | 'diagrama_unifilar' | 'memoria_calculo' | 'ficha_tecnica' | 'certificado'
  // G2
  | 'solicitud' | 'evidencia_fotografica' | 'checklist_consistencia'
  // G3
  | 'dictamen_uvie' | 'certificado_uiie' | 'oficio_resolutivo'
  | 'contrato_interconexion' | 'contrato_contraprestacion' | 'medidor_bidireccional';

type CampoDato =
  | 'nivel_tension'        // texto: 'MT' | 'BT'   (cruzado)
  | 'modelo_modulo'        // texto: 'CS6.2-66TB-615' (cruzado)
  | 'consumo_kwh_mes'      // numérico              (cruzado)
  | 'coordenadas_croquis'  // texto, solo detecta vacío
  | 'referencia_croquis';  // texto, solo detecta vacío

interface DocumentoExpediente {
  id: string;                      // uuid como string
  tipo: TipoDocumento;
  nombre: string;
  fechaEmision: string | null;     // 'YYYY-MM-DD'
  fechaVigencia: string | null;    // 'YYYY-MM-DD' (vencimiento)
  datos: { campo: CampoDato; valor: string | number | null }[];
}

type CanalEntrega = 'digital' | 'fisico'; // fisico = requiere impresión/firma autógrafa/entrega en oficina

interface Requisito {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  compuerta: CompuertaId;
  obligatorio: boolean;            // false <=> hay condicion
  canal: CanalEntrega;
  condicion?: string;              // texto de cuándo aplica
  requiereVigencia?: boolean;      // se audita fechaVigencia
  aportaCliente?: boolean;         // lo entrega el cliente (se muestra como pendiente suyo en el portal)
  reubicablePorZona?: boolean;     // su compuerta cambia con uvie_antes_de_ingreso (G3 -> G2)
}

interface SistemaFotovoltaico {
  numeroPaneles: number; potenciaPanelW: number; potenciaAcKw: number;
  numeroInversores: number; marcaInversor: string; potenciaInversorKw: number; transformadorKva: number;
}

type EstadoAccion = 'completada' | 'pendiente' | 'no_realizada';
interface AccionAcordada { id: string; semana: string /* 'YYYY-MM-DD' */; descripcion: string; responsable: string | null; estado: EstadoAccion }

// Referencia (computado en código, NO persistir como fuente de verdad):
type SeveridadHallazgo = 'bloqueante' | 'advertencia';
type CategoriaHallazgo = 'discrepancia' | 'campo_incompleto' | 'vigencia';
type SubtipoHallazgo = 'vencido' | 'por_vencer' | 'sin_fecha' | 'incoherente';
// id de hallazgo (clave estable): 'discrepancia:<campo>' | 'incompleto:<documentoId>'
//   | 'vigencia:vencido:<documentoId>' | 'vigencia:por-vencer:<documentoId>'
//   | 'vigencia:sin-fecha:<documentoId>' | 'vigencia:incoherente:<documentoId>'   (ojo: con guion en el id, guion bajo en el subtipo)

// Referencia (viven en Zoho, NO crear tablas):
type EstadoObservacion = 'abierta' | 'en_atencion' | 'cerrada';
type OrigenObservacion = 'cfe' | 'uvie' | 'interna';
```

**Convención de mapeo:** cada campo `camelCase` del código ↔ columna `snake_case` (p. ej. `fechaVigencia` ↔ `fecha_vigencia`, `numeroPaneles` ↔ `numero_paneles`). En tu entrega incluye una **tabla de mapeo TS→SQL** completa.
**Ids:** el código trata todos los ids como `string`; usa `uuid` con `gen_random_uuid()` (se serializa como string). Los ids de Zoho van como `text`.
**Enums:** usa tipos `ENUM` de Postgres con los valores exactos de arriba (o `text` + `CHECK` si argumentas que conviene para poder agregar valores; justifica). `TipoDocumento` y `CampoDato` deben poder **ampliarse** con una migración simple.

---

# 6. Reglas de negocio que el esquema debe respetar

1. **Nunca decidir qué versión es la correcta** entre documentos discrepantes: solo se registran decisiones humanas explícitas (§4.E).
2. `null` en fechas = no capturada; **jamás** rellenar por defecto ni inferir.
3. Varios documentos del mismo `tipo` por proyecto son válidos.
4. Un requisito se cubre por **tipo** de documento (no por id).
5. `obligatorio = false` ⇔ hay `condicion` en el requisito.
6. El dictamen UVIE (`dictamen_uvie`) es `reubicablePorZona`: base en G3; con `uvie_antes_de_ingreso = true` en el proyecto pasa a G2.
7. G2 es un filtro bloqueante: no se solicita con hallazgos bloqueantes abiertos.
8. Folio siempre en MAYÚSCULAS y único.
9. PPC (plan cumplido) y PAER son **calculados**; no se almacenan.
10. Los documentos de identidad/fiscales (INE, CSF, carta poder) son **datos personales sensibles**: bucket privado, URLs firmadas de corta duración, y minimizar lo que se copia a columnas de texto.

---

# 7. Seguridad y arquitectura de acceso

Modelo de acceso que uso: **navegador → mi backend (`/api`) → Supabase**. El backend usa la `service_role` **solo en el servidor** (variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); el navegador **nunca** recibe esa llave. Aun así quiero **defensa en profundidad**:

- **RLS habilitado en todas las tablas** (`enable row level security`) con política por defecto **denegar**; ninguna tabla accesible a `anon`.
- Políticas para `authenticated` basadas en el rol de `perfiles` (funciones auxiliares `security definer` con `search_path` fijo, p. ej. `tiene_rol(...)`), por si en el futuro la interfaz consulta Supabase directamente con el JWT del usuario. Entrega la **matriz rol × tabla × operación** (select/insert/update/delete) y justifícala.
- **Auditoría inmutable**: sin políticas de `update`/`delete`; refuérzalo con trigger que lance excepción.
- **Storage**: bucket privado `expedientes` con ruta `<folio>/<tipo>/<uuid>-<nombre>`; políticas por rol; nada público. Define límites de tamaño y tipos MIME permitidos (PDF, JPG, PNG).
- **Portal del cliente**: `portal_accesos` guarda solo `token_hash` (sha-256 u otro hash apropiado); el backend compara con tiempo constante; el token en claro se muestra una única vez al crearlo. Incluye revocación y caducidad.
- **Proyección del portal** (lo ÚNICO que debe ver un cliente; el backend la arma, pero define qué datos de Supabase la alimentan): avance de documentos obligatorios recibidos por compuerta, pendientes del cliente (requisitos con `aporta_cliente` faltantes, vencidos o por vencer) y nada más. **No** hallazgos internos, valores discrepantes, observaciones, PAER/PPC ni responsables.
- Evita `user_metadata` para autorización, evita `security definer` sin `search_path`, evita vistas que salten RLS sin querer (usa `security_invoker` donde aplique).
- Rendimiento: índices en `folio`, en llaves foráneas y en columnas usadas por políticas RLS.

---

# 8. Datos de prueba (semilla) — usa exactamente esto

**8.1 Catálogo de requisitos base (21 filas)** `compuerta | tipo | nombre | canal | obligatorio | extras`

- G0 | `consulta_capacidad_mt` | Consulta/registro de capacidad del circuito MT (Plataforma GD de CFE) | digital | sí
- G0 | `recibo_cfe` | Recibo CFE del último corte, sin adeudos | digital | sí | requiereVigencia, aportaCliente
- G0 | `datos_preliminares` | Datos técnicos preliminares (capacidad AC/DC, tensión, modalidad) | digital | sí
- G1 | `identificacion_oficial` | Identificación oficial vigente del propietario o representante | digital | sí | requiereVigencia, aportaCliente
- G1 | `constancia_situacion_fiscal` | Constancia de Situación Fiscal (SAT) actualizada | digital | sí | requiereVigencia, aportaCliente
- G1 | `carta_poder` | Carta poder (con INE del otorgante, apoderado y 2 testigos) | **fisico** | sí | aportaCliente
- G1 | `acta_constitutiva` | Acta constitutiva / acreditación de propiedad o posesión | digital | **no** | condicion: "Titular persona moral o cuando aplique", aportaCliente
- G1 | `croquis` | Croquis de localización georreferenciado | digital | sí
- G1 | `diagrama_unifilar` | Diagrama unifilar (SFV-01) | digital | sí
- G1 | `memoria_calculo` | Memoria de cálculo fotovoltaica y plano de planta (SFV-02) | digital | sí
- G1 | `ficha_tecnica` | Fichas técnicas de módulos e inversores | digital | sí
- G1 | `certificado` | Certificados UL/CSA vigentes de paneles e inversores | digital | sí | requiereVigencia
- G2 | `solicitud` | Solicitud de interconexión CFE llenada y firmada | **fisico** | sí
- G2 | `evidencia_fotografica` | Evidencia fotográfica del sistema (módulos, inversores, tablero, medidor) | digital | sí
- G2 | `checklist_consistencia` | Checklist de consistencia cruzada y vigencias aprobado | digital | sí
- G3 | `dictamen_uvie` | Dictamen de verificación UVIE (NOM-001-SEDE-2012) | **fisico** | sí | reubicablePorZona
- G3 | `certificado_uiie` | Certificado de cumplimiento UIIE | digital | **no** | condicion: "Si aplica por criterio de Zona / acuerdo A/054/2024"
- G3 | `oficio_resolutivo` | Acuse de ingreso / Oficio Resolutivo de CFE | digital | sí
- G3 | `contrato_interconexion` | Contrato de Interconexión (CFE Distribución) | **fisico** | sí
- G3 | `contrato_contraprestacion` | Contrato de Contraprestación (CFE Suministrador) | **fisico** | sí
- G3 | `medidor_bidireccional` | Evidencia de instalación de medidor bidireccional y alta comercial | digital | sí

**8.2 Proyecto de demostración `KV-MOCK-0001`** (`es_demo = true`, sin ids de Zoho). Sistema: 74 paneles de 615 W, 40 kW AC, 4 inversores GoodWe de 10 kW, transformador 75 kVA. Expediente (valores **ilustrativos y a propósito inconsistentes** para probar la validación cruzada; las fechas no listadas son `null`):

| Documento | tipo | datos declarados | vigencia |
|---|---|---|---|
| Solicitud de interconexión (copia 1) | `solicitud` | `nivel_tension`=MT; `consumo_kwh_mes`=6921.31 | — |
| Solicitud de interconexión (copia 2) | `solicitud` | `nivel_tension`=BT | — |
| Croquis de ubicación | `croquis` | `coordenadas_croquis`=**vacío**; `referencia_croquis`=**vacío** (campos declarados sin llenar) | — |
| Recibo CFE | `recibo_cfe` | `consumo_kwh_mes`=697.52 | 2026-10-31 |
| Diagrama unifilar | `diagrama_unifilar` | `nivel_tension`=MT | — |
| Fichas técnicas | `ficha_tecnica` | `modelo_modulo`=CS6.2-66TB-615 | — |
| Certificados | `certificado` | `modelo_modulo`=CS6.2-66TB-615 | 2026-12-10 |
| Memoria de cálculo | `memoria_calculo` | `modelo_modulo`=CS3.2-66TB-615 | — |
| Dictamen UVIE | `dictamen_uvie` | — | — |

Resultado esperado al evaluarlo con mi código: 3 discrepancias bloqueantes (tensión MT/BT, modelo de módulo CS6.2/CS3.2, consumo 6921.31/697.52), 1 campo incompleto (croquis), 1 vigencia vencida (recibo, según la fecha de hoy) y 1 por vencer (certificados).

**8.3 Acuerdos semanales de `KV-MOCK-0001`**: sesión 2026-11-09: 2 acciones (2 completadas); sesión 2026-11-16: 3 acciones (2 completadas, 1 no realizada); sesión 2026-11-23: 2 acciones (1 completada, 1 pendiente). Responsables de ejemplo: "Proyectista", "Supervisor de campo", "Coordinación administrativa". (PAER esperado: 100 %, 66.7 %, 50 %.)

**8.4 Proyecto real de pruebas `KV-2026-004`**: fila mínima con `es_demo = false` y sin documentos (existe en Zoho; sirve para probar el enlace por folio).

**8.5 Usuarios de prueba**: no insertes en `auth.users` con SQL hacks. Explícame cómo crear 1 usuario por rol desde el panel de Supabase y entrega el SQL para asignarles su fila en `perfiles` (con placeholders `<UUID_DEL_USUARIO>`).

---

# 9. Entregables y formato (en este orden)

1. **Decisiones y supuestos** (máx. 1 página): lo que decidiste y por qué; lista de supuestos; **preguntas bloqueantes** (máximo 5; si ninguna bloquea, procede).
2. **Diagrama ER** en Mermaid (`erDiagram`).
3. **Migraciones SQL numeradas y ejecutables en orden** en el editor SQL de Supabase (PostgreSQL 15): extensiones necesarias, enums, tablas (con PK, FK, CHECK, UNIQUE, defaults), índices, triggers (`actualizado_en`, auditoría, bloqueo de update/delete en auditoría), funciones, vistas (incl. `datos` como `[{campo, valor}]` y PAER semanal). **Idempotentes** donde sea razonable (`if not exists`).
4. **RLS**: habilitado en todas las tablas, funciones auxiliares, políticas por rol y la **matriz rol × tabla × operación**.
5. **Storage**: creación del bucket y sus políticas.
6. **Semilla**: SQL con 8.1 a 8.4 (+ lo de 8.5).
7. **Script de verificación**: consultas que prueben (a) las constraints (folio inválido, valor de enum inválido, campo duplicado en un documento, update a auditoría), (b) las políticas RLS por rol (simulando JWT con `set local role` / `request.jwt.claims`), (c) que el catálogo tiene 21 filas y que el PAER semanal da 100 / 66.7 / 50.
8. **Tabla de mapeo TS→SQL** completa y **ejemplos de payload** (supabase-js o REST) para: crear un documento con sus datos declarados, listar el expediente de un folio como `DocumentoExpediente[]`, upsert del sistema FV, registrar una resolución de hallazgo y crear un acuerdo semanal.
9. **Script de reversa** (rollback) de las migraciones.
10. **Riesgos y siguientes pasos** (qué queda fuera de este alcance).

---

# 10. Reglas de trabajo para ti

- Si la respuesta es muy larga, entrégala **por partes** en el orden de la sección 9 y pregunta si continúas; no recortes ni resumas el SQL.
- **No dupliques** nada de lo que la sección 2 asigna a Zoho.
- **No inventes** reglas de CFE ni requisitos documentales nuevos; usa solo lo listado aquí. Si necesitas un supuesto, márcalo como `SUPUESTO:`.
- Usa **nombres en español** y respeta **literalmente** los enums de la sección 5.
- Evita sobreingeniería: nada de multi-tenant, particionado ni microservicios; es una app interna de un solo despacho con portal de clientes.
- Todo SQL debe correr **sin errores** en un proyecto Supabase nuevo y **vacío**; verifica mentalmente el orden de dependencias.
- No incluyas llaves, contraseñas ni datos reales de clientes en ningún ejemplo.

=== FIN DEL PROMPT ===
