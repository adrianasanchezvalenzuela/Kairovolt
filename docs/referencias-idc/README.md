# Referencias IDC (solo para diseño del prototipo)

Esta carpeta **no contiene los PDF originales**. Aquí solo se documenta qué se tomó de cada referencia y su estado de privacidad.

| Referencia | Uso en el prototipo | Estado de privacidad |
| --- | --- | --- |
| `Requisitos_Interconexion_MT_CFE_IDC.pdf` | Fuente de verdad de los **11 requisitos** de interconexión en media tensión y de quién integra cada uno (Cliente / IDC / IDC-Cliente). | Documento de IDC sin datos personales. |
| `Requisitos_Inspeccion_UIIE_IDC.pdf` | Solo referencia. Son **17 requisitos de inspección UIIE**; **no se mezclan** con los 11 de interconexión. | Sin datos personales. |
| `Solicitud para la interconexión.pdf` | Plantilla en blanco usada por el generador de la solicitud (`public/guias/solicitud-interconexion-formato.pdf`). | Formato en blanco. |
| `SOLICITUD_RECIBIDA_ANONIMIZADA.pdf` | Ejemplo completado en la guía (`public/guias/solicitud-ejemplo-anonimizado.pdf` + miniaturas). | Imagen aplanada (sin capa de texto); datos personales cubiertos. **Publicado**; revisa antes de compartir fuera del equipo. |
| `DICTAMEN_VERIFICACION_ANONIMIZADO.pdf`, `EXPEDIENTE_INTERCONEXION_ANONIMIZADO.pdf`, `OFICIO_RESOLUTIVO_CFE_ANONIMIZADO.pdf`, `Volantia_anonimizado.pdf`, `DIAGRAMA_FLUJO_INTERCONEXION.pdf` | Solo consulta interna para entender el proceso. **No se publican** en el repositorio ni en la app: conservan datos técnicos y de negocio del proyecto original. Las guías usan ilustraciones propias ficticias. | No publicar sin una revisión de anonimización adicional. |

## Reparto de responsabilidades (demos 2 y 3)

- **Tus documentos (cliente):** identificación oficial, carta poder, constancia de situación fiscal, recibo CFE.
- **Lo hacemos juntos:** formato de solicitud de interconexión (IDC la prepara, el cliente firma).
- **IDC se encarga:** croquis, diagrama unifilar, fichas técnicas, certificados UL, fotografías del sistema y dictamen UVIE (emitido por la unidad de verificación y gestionado por IDC).

El estado mock compartido vive en `src/demo/expediente-demo.ts` (localStorage). Panel IDC de demostración: `/idc/KV-2026-005` (solo en desarrollo).
