import type { DocumentoExpediente, TipoDocumento } from '../domain/documentos/documento';
import type { HitoProyecto, TipoHito } from '../domain/entidades/hito';
import { configuracionVacia } from '../domain/entidades/configuracion-tecnica';
import type { Proyecto } from '../domain/proyecto/proyecto';
import type { DatoDeclarado } from '../domain/validacion/campos';

/**
 * CASO DEMOSTRATIVO KV-2026-004 (datos de PRUEBA, `esMock: true`).
 *
 * Reproduce el caso de 40 kW de Hermosillo con sus inconsistencias reales (MT/BT, CS6.2 vs CS3.2, 6,921.31 vs 697.52 kWh/mes,
 * croquis incompleto, recibo vencido). Qué es inventado y qué no:
 *  - ASIGNACIÓN de cada valor a un documento, fechas de vigencia, hitos, observaciones y acuerdos semanales: ilustrativos.
 *  - NO hay archivos: ningún documento trae `archivo`, así que «abrir evidencia» muestra los datos declarados y avisa que no hay archivo.
 *  - La aprobación de G0 lleva un ROL (no una persona) y está marcada como demostrativa.
 *  - Lo que no se conoce (modelo del inversor, strings, RPU, coordenadas) queda en null: las reglas lo reportan «no evaluable».
 *  - El modelo de panel queda sin decidir a propósito: hay dos versiones contradictorias y el sistema no elige.
 */
const doc = (id: string, tipo: TipoDocumento, nombre: string, extra: { datos?: DatoDeclarado[]; fechaVigencia?: string; fechaEmision?: string } = {}): DocumentoExpediente => ({
  id, tipo, nombre, fechaEmision: extra.fechaEmision ?? null, fechaVigencia: extra.fechaVigencia ?? null, datos: extra.datos ?? [],
});

const hito = (id: string, nombre: string, compuerta: HitoProyecto['compuerta'], inicioPlan: string, finPlan: string, finReal: string | null, tipo: TipoHito | null, responsable: string | null): HitoProyecto =>
  ({ id, nombre, compuerta, inicioPlan, finPlan, finReal, responsable, tipo });

const hitos: HitoProyecto[] = [
  hito('h1', 'Alta del proyecto', 'G0', '2026-11-02', '2026-11-02', '2026-11-02', 'inicio_proyecto', 'Coordinación administrativa'),
  hito('h2', 'Consulta de capacidad del circuito MT', 'G0', '2026-11-02', '2026-11-06', '2026-11-05', 'consulta_capacidad', 'Ingeniería IDC'),
  hito('h3', 'Acopio legal del cliente', 'G1', '2026-11-09', '2026-11-13', null, 'acopio_completo', 'Coordinación administrativa'),
  hito('h4', 'Instalación FV terminada', 'G1', '2026-11-04', '2026-11-10', '2026-11-12', 'obra_terminada', 'Supervisor de campo'),
  hito('h5', 'Ingeniería: unifilar y memoria de cálculo', 'G1', '2026-11-09', '2026-11-18', '2026-11-17', null, 'Proyectista'),
  hito('h6', 'Validación cruzada y vigencias', 'G2', '2026-11-19', '2026-11-23', null, 'validacion_g2', 'Proyectista'),
  hito('h7', 'Ingreso de la solicitud a CFE', 'G3', '2026-11-24', '2026-11-27', null, 'ingreso_cfe', 'Coordinación administrativa'),
  hito('h8', 'Verificación UVIE', 'G3', '2026-11-30', '2026-12-11', null, 'dictamen_uvie', null),
];

export const kv2026004Demo: Proyecto = {
  id: 'kv-2026-004',
  folio: 'KV-2026-004',
  nombre: 'Interconexión FV 40 kW · caso demostrativo',
  cliente: 'Cliente demostrativo',
  municipio: 'Hermosillo',
  estado: 'Sonora',
  esMock: true,
  sistema: { numeroPaneles: 74, potenciaPanelW: 615, potenciaAcKw: 40, numeroInversores: 4, marcaInversor: 'GoodWe', potenciaInversorKw: 10, transformadorKva: 75 },
  configuracionTecnica: {
    ...configuracionVacia(),
    numeroPaneles: 74, potenciaPanelW: 615, potenciaDcKwpDeclarada: 45.51, numeroInversores: 4, marcaInversor: 'GoodWe', potenciaInversorKw: 10, potenciaAcKw: 40, transformadorKva: 75,
  },
  compuertas: [
    { id: 'G0', estado: 'liberada' },
    { id: 'G1', estado: 'en_revision' },
    { id: 'G2', estado: 'pendiente' },
    { id: 'G3', estado: 'pendiente' },
  ],
  aprobaciones: [{ compuerta: 'G0', aprobadoPor: 'Coordinación administrativa (demostrativo)', fecha: '2026-11-06', comentario: 'Capacidad del circuito confirmada (dato de demostración).' }],
  documentosDisponibles: true,
  documentos: [
    doc('d0a', 'consulta_capacidad_mt', 'Consulta de capacidad del circuito MT'),
    doc('d0b', 'datos_preliminares', 'Datos técnicos preliminares'),
    doc('d4', 'recibo_cfe', 'Recibo CFE', { datos: [{ campo: 'consumo_kwh_mes', valor: 697.52 }], fechaVigencia: '2026-10-31' }),
    doc('d1', 'solicitud', 'Solicitud de interconexión (copia 1)', { datos: [{ campo: 'nivel_tension', valor: 'MT' }, { campo: 'consumo_kwh_mes', valor: 6921.31 }] }),
    doc('d2', 'solicitud', 'Solicitud de interconexión (copia 2)', { datos: [{ campo: 'nivel_tension', valor: 'BT' }] }),
    doc('d3', 'croquis', 'Croquis de ubicación', { datos: [{ campo: 'coordenadas_croquis', valor: null }, { campo: 'referencia_croquis', valor: '' }] }),
    doc('d5', 'diagrama_unifilar', 'Diagrama unifilar', { datos: [{ campo: 'nivel_tension', valor: 'MT' }] }),
    doc('d6', 'ficha_tecnica', 'Fichas técnicas', { datos: [{ campo: 'modelo_modulo', valor: 'CS6.2-66TB-615' }] }),
    doc('d7', 'certificado', 'Certificados', { datos: [{ campo: 'modelo_modulo', valor: 'CS6.2-66TB-615' }], fechaVigencia: '2026-12-10' }),
    doc('d8', 'memoria_calculo', 'Memoria de cálculo', { datos: [{ campo: 'modelo_modulo', valor: 'CS3.2-66TB-615' }] }),
    doc('d9', 'dictamen_uvie', 'Dictamen UVIE'),
  ],
  observaciones: [
    { id: 'o1', origen: 'interna', compuerta: 'G1', descripcion: 'Completar los campos vacíos del croquis de ubicación', estado: 'en_atencion', fechaRegistro: '2026-11-16', fechaCompromiso: '2026-11-20', responsable: 'Proyectista' },
    { id: 'o2', origen: 'interna', compuerta: 'G1', descripcion: 'Solicitar al cliente un recibo CFE vigente', estado: 'abierta', fechaRegistro: '2026-11-19', fechaCompromiso: null, responsable: null },
    { id: 'o3', origen: 'interna', compuerta: 'G0', descripcion: 'Registrar la capacidad del circuito MT', estado: 'cerrada', fechaRegistro: '2026-11-02', fechaCompromiso: '2026-11-06', responsable: 'Ingeniería IDC' },
  ],
  cronograma: hitos.map(({ tipo: _tipo, ...actividad }) => actividad),
  hitos,
  acciones: [
    { id: 'ac1', semana: '2026-11-09', descripcion: 'Solicitar documentos legales al cliente', responsable: 'Coordinación administrativa', estado: 'completada' },
    { id: 'ac2', semana: '2026-11-09', descripcion: 'Iniciar unifilar y memoria de cálculo', responsable: 'Proyectista', estado: 'completada' },
    { id: 'ac3', semana: '2026-11-16', descripcion: 'Corregir croquis con campos vacíos', responsable: 'Proyectista', estado: 'no_realizada' },
    { id: 'ac4', semana: '2026-11-16', descripcion: 'Perseguir recibo CFE vigente', responsable: 'Coordinación administrativa', estado: 'no_realizada' },
    { id: 'ac5', semana: '2026-11-16', descripcion: 'Verificar evidencia fotográfica en sitio', responsable: 'Supervisor de campo', estado: 'completada' },
    { id: 'ac6', semana: '2026-11-23', descripcion: 'Confirmar MT/BT entre solicitud y unifilar', responsable: 'Proyectista', estado: 'pendiente' },
  ],
};
