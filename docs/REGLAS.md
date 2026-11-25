# Reglas de validación (dominio)

Las reglas viven en `src/domain/reglas/` y son **configurables**: severidades, umbrales y tolerancias están en un solo catálogo
(`configuracion.ts`) y se sobrescriben sin tocar código. Las páginas no llevan reglas.

## Qué devuelve cada validación (`ResultadoValidacion`)

`reglaId` · `campo` · `documentosOrigen` (id, nombre y valor de cada fuente) · `valorEncontrado` · `valorEsperado` (calculado, de referencia o de la
configuración técnica; `null` si no hay) · `resultado` (`cumple` / `no_cumple` / `no_evaluable`) · `severidad` · `explicacion` · `accionRecomendada` ·
`requiereAprobacionHumana`. Además: `reglaNombre`, `categoria`, `compuerta`, `huella` (clave estable) y `parametrosSupuestos`.

- **Nunca se corrige nada.** Las reglas solo leen. Con datos contradictorios no eligen uno: lo reportan y exigen una decisión humana.
- **`no_evaluable`** = faltan datos. Nunca se inventan ni se suponen.
- **Severidades:** `bloqueante` (impide solicitar la compuerta), `mayor`, `menor`, `informativa`. Solo los fallos las llevan.
- **`parametrosSupuestos`**: los valores por defecto son propuestas por confirmar con IDC, no requisitos de CFE.

## Catálogo por defecto

| ID | Regla | Severidad | Aprobación humana | Supuesto | Parámetros |
| --- | --- | --- | --- | --- | --- |
| CRU-001 | Nivel de tensión consistente | bloqueante | sí | no | — |
| CRU-002 | Modelo de panel consistente | bloqueante | sí | no | — |
| CRU-003 | Modelo de inversor consistente | bloqueante | sí | no | — |
| CRU-004 | Número de paneles consistente | bloqueante | sí | no | toleranciaRelativa=0; toleranciaAbsoluta=0 |
| CRU-005 | Potencia DC consistente | bloqueante | sí | no | toleranciaRelativa=0.005; toleranciaAbsoluta=0 |
| CRU-006 | Potencia AC consistente | bloqueante | sí | no | toleranciaRelativa=0.005; toleranciaAbsoluta=0 |
| CRU-007 | RPU consistente | bloqueante | sí | no | — |
| CRU-008 | Ubicación geográfica consistente | bloqueante | sí | no | toleranciaMetros=100 |
| CRU-009 | Generación estimada consistente | bloqueante | sí | no | toleranciaRelativa=0.02; toleranciaAbsoluta=0; toleranciaOrdenMagnitud=0.05 |
| CRU-010 | Configuración de strings consistente | bloqueante | sí | no | — |
| CRU-011 | Consumo consistente | bloqueante | sí | no | toleranciaRelativa=0.001; toleranciaAbsoluta=0; toleranciaOrdenMagnitud=0.05 |
| TEC-001 | Potencia DC = paneles × potencia por panel | bloqueante | sí | no | toleranciaRelativa=0.005; toleranciaAbsoluta=0 |
| TEC-002 | Potencia AC = inversores × potencia por inversor | bloqueante | sí | no | toleranciaRelativa=0.005; toleranciaAbsoluta=0 |
| TEC-003 | Relación DC/AC dentro del rango | menor | no | sí | relacionMin=1; relacionMax=1.5 |
| TEC-004 | Paneles = suma de la configuración de strings | bloqueante | sí | no | — |
| TEC-005 | Tensión máxima del string dentro del límite del inversor | bloqueante | sí | sí | temperaturaMinimaC=0 |
| TEC-006 | Generación estimada vs referencia física | mayor | sí | sí | horasSolaresPico=6; rendimiento=0.8; diasMes=30; toleranciaRelativa=0.15 |
| TEC-007 | Formato del RPU | mayor | no | sí | patron="^[A-Za-z0-9]{12}$" |
| TEC-008 | Coordenadas dentro del área esperada | mayor | sí | sí | areaEsperada=[26.2,32.5,-115.1,-108.4] |
| TEC-009 | Nivel de tensión con un valor válido | bloqueante | no | no | valoresPermitidos=["MT","BT"] |
| OBL-001 | Campos obligatorios del documento | bloqueante | no | no | camposObligatoriosPorTipo={"croquis":["coordenadas_croquis","referencia_croquis"]} |
| OBL-002 | Documentos obligatorios por compuerta | mayor | no | no | — |
| OBL-003 | Datos técnicos obligatorios | mayor | no | no | camposObligatorios=["nivelTension","numeroPaneles","potenciaPanelW","modeloPanel","numeroInversores","modeloInversor","potenciaInversorKw","potenciaAcKw","rpu","coordenadas"] |
| VIG-001 | Documento vencido | bloqueante | no | no | — |
| VIG-002 | Documento por vencer | menor | no | sí | umbralDias=30; diasUrgente=7 |
| VIG-003 | Vigencia no capturada | mayor | no | no | — |
| VIG-004 | Fechas incoherentes | bloqueante | no | no | — |

- **CRU-xxx** comparan todas las fuentes (documentos y, si existe, la configuración técnica) entre sí. **TEC-xxx** comprueban la coherencia técnica.
  **OBL-xxx** son campos y documentos obligatorios. **VIG-xxx** son vigencias.
- `configuracion_strings` se captura en formato canónico `NxM` (strings × paneles por string), ordenado y unido con `+`, p. ej. `1x9+1x9+2x10`.
- `ubicacion` se captura como `lat,lon`. Dos puntos a más de `toleranciaMetros` se consideran distintos.

## Cómo configurarlas

```ts
import { ejecutarReglas } from '@/domain/reglas/motor';

ejecutarReglas(contexto, {
  overrides: {
    'CRU-001': { severidad: 'mayor' },                       // otra severidad
    'TEC-003': { activa: false },                            // desactivar
    'TEC-006': { parametros: { horasSolaresPico: 5.8 } },    // otro umbral
    'CRU-002': { requiereAprobacionHumana: false },
  },
});
```

Pueden pedirse solo ciertas categorías o reglas: `ejecutarReglas(ctx, config, { categorias: ['vigencia'] })`.

## Observaciones, compuertas y excepciones

- Una observación nace de un fallo (`observacionDesdeValidacion`) y se cierra con una **resolución humana**: `corregido` (exige que al revalidar ya cumpla),
  `aceptado_con_justificacion` o `no_aplica` (exigen un rol con permiso `aprobar_excepciones` cuando la regla requiere aprobación humana).
- Una excepción aprobada **solo vale para el valor aprobado**: si el dato cambia, el fallo vuelve a bloquear y la observación se reabre.
- `evaluarBloqueoCompuerta` devuelve todas las razones: validaciones bloqueantes pendientes (por defecto en G2), compuertas previas sin liberar,
  documentos obligatorios faltantes y observaciones abiertas de CFE/UVIE o de severidad bloqueante.

## Pendiente de confirmar con IDC

Horas solares pico y rendimiento (TEC-006), rango DC/AC (TEC-003), formato del RPU (TEC-007), área geográfica esperada (TEC-008), umbrales de vigencia (VIG-002),
temperatura mínima (TEC-005), quién puede aprobar excepciones, y qué campos obligatorios exige cada tipo de documento (OBL-001 solo exige los del croquis).
