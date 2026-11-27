# Contrato mock · Consulta preliminar de nuevos proyectos

Para coordinar el portal público (demo 00 «Antes de comenzar») con el panel IDC. **Solo dummy data**: no hay Supabase, Zoho, correo ni WhatsApp reales.

- Tipos y acciones: `src/demo/consulta-demo.ts` (`ConsultaPreliminar`, `accionesConsulta`).
- Estado compartido: `localStorage['kairovolt:demo-consultas:v1']` → `{ v: 1, consultas: Record<idPreliminar, ConsultaPreliminar>, ultimo?: string }`. Se sincroniza entre pestañas (evento `storage`).
- Autoridad futura: **Zoho CRM** (comercial). No implementada; este contrato debe mapearse a esa integración cuando exista.

## Registro `ConsultaPreliminar`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `idPreliminar` | `PRE-AAAA-NNN` | Referencia pública **no** autenticante. No es folio KV. `PRE-2026-000` es un caso de ejemplo sembrado. |
| `codigoSeguimiento` | `PRUEBA-NNNN` | Código de prueba: el seguimiento exige referencia **y** código. |
| `nombre`, `correo`, `telefono?` | string | Datos de contacto ficticios. |
| `medioContacto` | `correo \| telefono \| whatsapp` | |
| `horarioContacto` | string | Texto libre acotado (mañana/tarde/cualquiera). |
| `consentimientoContacto` | boolean | Obligatorio para enviar. |
| `motivo` | `interconectar \| regularizar \| asesoria` | Motivos de consulta, no catálogo de servicios. |
| `tipoInmueble` | `residencial \| comercial \| industrial \| otro` | |
| `ubicacion` | string | Ciudad o zona aproximada. |
| `potenciaKw` | number \| null | Opcional; no se calcula ni se valida técnicamente. |
| `nivelTension` | `baja \| media \| no_se` | |
| `etapa` | `explorando \| propuesta \| instalacion \| instalado` | |
| `descripcion` | string | Opcional. |
| `adjuntos` | `AdjuntoRef[]` | Solo referencias (`id`, `nombre`, `tamano`, `tipo`, `categoria`). Los archivos viven en memoria del navegador; **no** se persisten. |
| `fechaSolicitud` | ISO | |
| `estado` | `recibida \| en_revision \| info_solicitada \| asesoria_programada \| propuesta_en_preparacion \| proyecto_formalizado \| cerrada` | |
| `responsable` | `{ nombre, rol } \| null` | Se asigna al iniciar la revisión. |
| `historial` | `MensajeConsulta[]` | `de: cliente \| idc \| sistema`, `canal: portal \| correo \| whatsapp`, `adjuntos?`. |
| `cita?` | `CitaAsesoria` | Asesoría `telefonica \| virtual \| presencial`; `pendiente_confirmacion → confirmada`. Independiente de las citas de entrega física. |
| `notificacionesGestor` | `NotificacionGestor[]` | Simulación de correo + WhatsApp al gestor al enviar. |

## Qué debe hacer el panel (lado IDC)

1. Leer `consultas` del estado compartido y listarlas por `fechaSolicitud`.
2. Cambiar `estado`, asignar `responsable` y agregar mensajes `de: 'idc'` al `historial` (p. ej. pedir información adicional).
3. Confirmar `cita.estado = 'confirmada'` (y pasar `estado` a `asesoria_programada`).
4. **No** crear automáticamente un proyecto ni un folio KV: la formalización es una decisión manual de IDC.

Reglas del prototipo: no se promete viabilidad técnica ni aprobación de CFE; no se piden INE, constancia fiscal, carta poder ni documentos legales en la consulta.
