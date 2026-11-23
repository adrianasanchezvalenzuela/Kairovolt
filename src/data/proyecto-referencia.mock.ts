import type { Proyecto } from '@/domain/proyecto/proyecto';
import type { DocumentoExpediente, TipoDocumento } from '@/domain/documentos/documento';
import type { DatoDeclarado } from '@/domain/validacion/campos';

/**
 * MOCK: proyecto de referencia (Hermosillo, Sonora) para pruebas.
 *
 * - Expediente PARCIAL: la documentación legal del caso real no se mapeó a tipos concretos
 *   (no se conoce cuáles son), por lo que aparecen como faltantes en G1.
 * - Las inconsistencias de prueba (MT/BT, CS6.2 vs CS3.2, 6,921.31 vs 697.52 kWh/mes, croquis
 *   incompleto) están cargadas como datos declarados. La ASIGNACIÓN de cada valor a un documento
 *   concreto es de prueba; no implica que alguno sea el correcto.
 * - ACCIONES (PAER): acuerdos semanales ILUSTRATIVOS, igual que observaciones y cronograma.
 * - OBSERVACIONES Y CRONOGRAMA: contenido y fechas ILUSTRATIVOS (derivados de las inconsistencias de
 *   prueba), solo para ejercitar seguimiento, atrasos y PPC.
 * - FECHAS ILUSTRATIVAS: las vigencias del recibo CFE y de los certificados son inventadas solo para
 *   ejercitar las reglas de vigencia (vencido / por vencer). Las demás fechas no se conocen y son null.
 */
const doc = (
  id: string, tipo: TipoDocumento, nombre: string,
  extra: { datos?: DatoDeclarado[]; fechaVigencia?: string } = {},
): DocumentoExpediente => ({
  id, tipo, nombre, fechaEmision: null, fechaVigencia: extra.fechaVigencia ?? null, datos: extra.datos ?? [],
});

export const proyectoReferenciaMock: Proyecto = {
  id: 'mock-ref-001',
  folio: 'KV-MOCK-0001',
  nombre: 'FV referencia 45.51 kWp',
  cliente: 'Cliente de referencia (mock)',
  municipio: 'Hermosillo',
  estado: 'Sonora',
  esMock: true,
  sistema: {
    numeroPaneles: 74,
    potenciaPanelW: 615,
    potenciaAcKw: 40,
    numeroInversores: 4,
    marcaInversor: 'GoodWe',
    potenciaInversorKw: 10,
    transformadorKva: 75,
  },
  compuertas: [
    { id: 'G0', estado: 'pendiente' },
    { id: 'G1', estado: 'pendiente' },
    { id: 'G2', estado: 'pendiente' },
    { id: 'G3', estado: 'pendiente' },
  ],
  documentosDisponibles: true,
  documentos: [
    doc('d1', 'solicitud', 'Solicitud de interconexión (copia 1)', {
      datos: [{ campo: 'nivel_tension', valor: 'MT' }, { campo: 'consumo_kwh_mes', valor: 6921.31 }],
    }),
    doc('d2', 'solicitud', 'Solicitud de interconexión (copia 2)', {
      datos: [{ campo: 'nivel_tension', valor: 'BT' }],
    }),
    doc('d3', 'croquis', 'Croquis de ubicación', {
      datos: [{ campo: 'coordenadas_croquis', valor: null }, { campo: 'referencia_croquis', valor: '' }],
    }),
    doc('d4', 'recibo_cfe', 'Recibo CFE', {
      datos: [{ campo: 'consumo_kwh_mes', valor: 697.52 }], fechaVigencia: '2026-10-31',
    }),
    doc('d5', 'diagrama_unifilar', 'Diagrama unifilar', { datos: [{ campo: 'nivel_tension', valor: 'MT' }] }),
    doc('d6', 'ficha_tecnica', 'Fichas técnicas', { datos: [{ campo: 'modelo_modulo', valor: 'CS6.2-66TB-615' }] }),
    doc('d7', 'certificado', 'Certificados', {
      datos: [{ campo: 'modelo_modulo', valor: 'CS6.2-66TB-615' }], fechaVigencia: '2026-12-10',
    }),
    doc('d8', 'memoria_calculo', 'Memoria de cálculo', { datos: [{ campo: 'modelo_modulo', valor: 'CS3.2-66TB-615' }] }),
    doc('d9', 'dictamen_uvie', 'Dictamen UVIE'),
  ],
  observaciones: [
    { id: 'o1', origen: 'interna', compuerta: 'G2', descripcion: 'Confirmar nivel de tensión (MT/BT) entre copias de solicitud y documentación técnica', estado: 'abierta', fechaRegistro: '2026-11-18', fechaCompromiso: '2026-11-25', responsable: 'Ingeniería IDC' },
    { id: 'o2', origen: 'interna', compuerta: 'G1', descripcion: 'Completar campos vacíos del croquis', estado: 'en_atencion', fechaRegistro: '2026-11-16', fechaCompromiso: '2026-11-20', responsable: 'Ingeniería IDC' },
    { id: 'o3', origen: 'interna', compuerta: 'G0', descripcion: 'Solicitar al cliente recibo CFE vigente', estado: 'abierta', fechaRegistro: '2026-11-19', fechaCompromiso: null, responsable: null },
    { id: 'o4', origen: 'interna', compuerta: 'G0', descripcion: 'Registrar capacidad del circuito MT', estado: 'cerrada', fechaRegistro: '2026-11-02', fechaCompromiso: '2026-11-06', responsable: 'Ingeniería IDC' },
  ],
  cronograma: [
    { id: 'a1', nombre: 'Consulta de capacidad del circuito MT', compuerta: 'G0', inicioPlan: '2026-11-02', finPlan: '2026-11-06', finReal: '2026-11-05', responsable: 'Ingeniería IDC' },
    { id: 'a2', nombre: 'Acopio legal del cliente', compuerta: 'G1', inicioPlan: '2026-11-09', finPlan: '2026-11-13', finReal: '2026-11-16', responsable: 'Gestión IDC' },
    { id: 'a3', nombre: 'Ingeniería: unifilar y memoria de cálculo', compuerta: 'G1', inicioPlan: '2026-11-09', finPlan: '2026-11-18', finReal: '2026-11-17', responsable: 'Ingeniería IDC' },
    { id: 'a4', nombre: 'Validación cruzada y vigencias', compuerta: 'G2', inicioPlan: '2026-11-19', finPlan: '2026-11-23', finReal: null, responsable: 'Ingeniería IDC' },
    { id: 'a5', nombre: 'Verificación UVIE', compuerta: 'G3', inicioPlan: '2026-11-24', finPlan: '2026-12-04', finReal: null, responsable: null },
    { id: 'a6', nombre: 'Ingreso CFE y contratos', compuerta: 'G3', inicioPlan: '2026-12-07', finPlan: '2026-12-18', finReal: null, responsable: null },
  ],
  acciones: [
    { id: 'ac1', semana: '2026-11-09', descripcion: 'Solicitar documentos legales al cliente', responsable: 'Coordinación administrativa', estado: 'completada' },
    { id: 'ac2', semana: '2026-11-09', descripcion: 'Iniciar unifilar y memoria de cálculo', responsable: 'Proyectista', estado: 'completada' },
    { id: 'ac3', semana: '2026-11-16', descripcion: 'Corregir croquis con campos vacíos', responsable: 'Proyectista', estado: 'completada' },
    { id: 'ac4', semana: '2026-11-16', descripcion: 'Perseguir recibo CFE vigente', responsable: 'Coordinación administrativa', estado: 'no_realizada' },
    { id: 'ac5', semana: '2026-11-16', descripcion: 'Verificar evidencia fotográfica en sitio', responsable: 'Supervisor de campo', estado: 'completada' },
    { id: 'ac6', semana: '2026-11-23', descripcion: 'Confirmar MT/BT entre solicitud y unifilar', responsable: 'Proyectista', estado: 'completada' },
    { id: 'ac7', semana: '2026-11-23', descripcion: 'Dar seguimiento a vencimiento de certificados', responsable: 'Coordinación administrativa', estado: 'pendiente' },
  ],
};
