import type { ConfiguracionReglas, DefinicionRegla, ResolverRegla, Severidad, ValorParametro } from './tipos';

/**
 * CATÁLOGO DE REGLAS por defecto. Es la ÚNICA fuente de severidades, umbrales y tolerancias: las páginas no llevan reglas.
 * Se sobrescribe con `ConfiguracionReglas.overrides` (por zona o proyecto) sin tocar código.
 *
 * Las reglas marcadas `supuesto: true` usan valores por defecto PROPUESTOS que IDC debe confirmar: no son requisitos de CFE.
 */

const TOL_TEXTO = {} as const;
const tolNumero = (relativa: number, absoluta = 0) => ({ toleranciaRelativa: relativa, toleranciaAbsoluta: absoluta });

const cruzada = (n: string, campo: string, nombre: string, parametros: DefinicionRegla['parametros'] = TOL_TEXTO): DefinicionRegla => ({
  id: `CRU-${n}`, nombre, categoria: 'cruzada', campo,
  descripcion: `El valor de «${nombre.toLowerCase()}» debe coincidir en todos los documentos que lo declaran (y con la configuración técnica si existe).`,
  severidad: 'bloqueante', requiereAprobacionHumana: true, activa: true, supuesto: false, parametros,
});

export const CATALOGO_REGLAS: readonly DefinicionRegla[] = [
  // ---- Comparación cruzada entre documentos ----
  cruzada('001', 'nivel_tension', 'Nivel de tensión consistente'),
  cruzada('002', 'modelo_modulo', 'Modelo de panel consistente'),
  cruzada('003', 'modelo_inversor', 'Modelo de inversor consistente'),
  cruzada('004', 'numero_paneles', 'Número de paneles consistente', tolNumero(0)),
  cruzada('005', 'potencia_dc_kwp', 'Potencia DC consistente', tolNumero(0.005)),
  cruzada('006', 'potencia_ac_kw', 'Potencia AC consistente', tolNumero(0.005)),
  cruzada('007', 'rpu', 'RPU consistente'),
  cruzada('008', 'ubicacion', 'Ubicación geográfica consistente', { toleranciaMetros: 100 }),
  cruzada('009', 'generacion_kwh_mes', 'Generación estimada consistente', { ...tolNumero(0.02), toleranciaOrdenMagnitud: 0.05 }),
  cruzada('010', 'configuracion_strings', 'Configuración de strings consistente'),
  cruzada('011', 'consumo_kwh_mes', 'Consumo consistente', { ...tolNumero(0.001), toleranciaOrdenMagnitud: 0.05 }),

  // ---- Coherencia técnica ----
  {
    id: 'TEC-001', nombre: 'Potencia DC = paneles × potencia por panel', categoria: 'tecnica', campo: 'potencia_dc_kwp',
    descripcion: 'La potencia DC declarada debe coincidir con número de paneles × potencia por panel ÷ 1000.',
    severidad: 'bloqueante', requiereAprobacionHumana: true, activa: true, supuesto: false, parametros: tolNumero(0.005),
  },
  {
    id: 'TEC-002', nombre: 'Potencia AC = inversores × potencia por inversor', categoria: 'tecnica', campo: 'potencia_ac_kw',
    descripcion: 'La potencia AC declarada debe coincidir con número de inversores × potencia por inversor.',
    severidad: 'bloqueante', requiereAprobacionHumana: true, activa: true, supuesto: false, parametros: tolNumero(0.005),
  },
  {
    id: 'TEC-003', nombre: 'Relación DC/AC dentro del rango', categoria: 'tecnica', campo: 'relacion_dc_ac',
    descripcion: 'La relación entre potencia DC y AC debe estar dentro del rango de referencia (supuesto, por confirmar con IDC).',
    severidad: 'menor', requiereAprobacionHumana: false, activa: true, supuesto: true, parametros: { relacionMin: 1.0, relacionMax: 1.5 },
  },
  {
    id: 'TEC-004', nombre: 'Paneles = suma de la configuración de strings', categoria: 'tecnica', campo: 'configuracion_strings',
    descripcion: 'La suma de (strings × paneles por string) debe igualar el número total de paneles.',
    severidad: 'bloqueante', requiereAprobacionHumana: true, activa: true, supuesto: false, parametros: {},
  },
  {
    id: 'TEC-005', nombre: 'Tensión máxima del string dentro del límite del inversor', categoria: 'tecnica', campo: 'configuracion_strings',
    descripcion: 'Voc en frío × paneles por string no debe exceder la tensión DC máxima del inversor (requiere datos de las fichas técnicas).',
    severidad: 'bloqueante', requiereAprobacionHumana: true, activa: true, supuesto: true, parametros: { temperaturaMinimaC: 0 },
  },
  {
    id: 'TEC-006', nombre: 'Generación estimada vs referencia física', categoria: 'tecnica', campo: 'generacion_kwh_mes',
    descripcion: 'La generación declarada se compara con DC × horas solares pico × rendimiento × días (supuesto, por confirmar con IDC). Es una referencia, no una corrección.',
    severidad: 'mayor', requiereAprobacionHumana: true, activa: true, supuesto: true,
    parametros: { horasSolaresPico: 6.0, rendimiento: 0.8, diasMes: 30, toleranciaRelativa: 0.15 },
  },
  {
    id: 'TEC-007', nombre: 'Formato del RPU', categoria: 'tecnica', campo: 'rpu',
    descripcion: 'El RPU debe tener el formato esperado (supuesto: 12 caracteres alfanuméricos; por confirmar con IDC).',
    severidad: 'mayor', requiereAprobacionHumana: false, activa: true, supuesto: true, parametros: { patron: '^[A-Za-z0-9]{12}$' },
  },
  {
    id: 'TEC-008', nombre: 'Coordenadas dentro del área esperada', categoria: 'tecnica', campo: 'ubicacion',
    descripcion: 'Las coordenadas deben estar dentro del área esperada (supuesto: Sonora; por confirmar con IDC).',
    severidad: 'mayor', requiereAprobacionHumana: true, activa: true, supuesto: true,
    // [latMin, latMax, lonMin, lonMax]
    parametros: { areaEsperada: [26.2, 32.5, -115.1, -108.4] },
  },
  {
    id: 'TEC-009', nombre: 'Nivel de tensión con un valor válido', categoria: 'tecnica', campo: 'nivel_tension',
    descripcion: 'El nivel de tensión declarado debe ser uno de los valores permitidos.',
    severidad: 'bloqueante', requiereAprobacionHumana: false, activa: true, supuesto: false, parametros: { valoresPermitidos: ['MT', 'BT'] },
  },

  // ---- Campos obligatorios ----
  {
    id: 'OBL-001', nombre: 'Campos obligatorios del documento', categoria: 'obligatorio', campo: 'campos_obligatorios',
    descripcion: 'Un documento no puede declarar campos vacíos, y debe declarar los campos obligatorios de su tipo.',
    severidad: 'bloqueante', requiereAprobacionHumana: false, activa: true, supuesto: false,
    parametros: { camposObligatoriosPorTipo: { croquis: ['coordenadas_croquis', 'referencia_croquis'] } },
  },
  {
    id: 'OBL-002', nombre: 'Documentos obligatorios por compuerta', categoria: 'obligatorio', campo: 'documentos_obligatorios',
    descripcion: 'Cada documento obligatorio del catálogo de requisitos debe estar en el expediente.',
    severidad: 'mayor', requiereAprobacionHumana: false, activa: true, supuesto: false, parametros: {},
  },
  {
    id: 'OBL-003', nombre: 'Datos técnicos obligatorios', categoria: 'obligatorio', campo: 'configuracion_tecnica',
    descripcion: 'La configuración técnica debe tener los datos necesarios para validar el proyecto.',
    severidad: 'mayor', requiereAprobacionHumana: false, activa: true, supuesto: false,
    parametros: {
      camposObligatorios: [
        'nivelTension', 'numeroPaneles', 'potenciaPanelW', 'modeloPanel', 'numeroInversores', 'modeloInversor',
        'potenciaInversorKw', 'potenciaAcKw', 'rpu', 'coordenadas',
      ],
    },
  },

  // ---- Vigencias ----
  {
    id: 'VIG-001', nombre: 'Documento vencido', categoria: 'vigencia', campo: 'fecha_vigencia',
    descripcion: 'Un documento que requiere vigencia no puede estar vencido.',
    severidad: 'bloqueante', requiereAprobacionHumana: false, activa: true, supuesto: false, parametros: {},
  },
  {
    id: 'VIG-002', nombre: 'Documento por vencer', categoria: 'vigencia', campo: 'fecha_vigencia',
    descripcion: 'Aviso cuando la vigencia vence dentro del umbral (días); se vuelve «mayor» si quedan pocos días.',
    severidad: 'menor', requiereAprobacionHumana: false, activa: true, supuesto: true, parametros: { umbralDias: 30, diasUrgente: 7 },
  },
  {
    id: 'VIG-003', nombre: 'Vigencia no capturada', categoria: 'vigencia', campo: 'fecha_vigencia',
    descripcion: 'No se puede verificar la vigencia sin la fecha de vencimiento; nunca se asume una fecha.',
    severidad: 'mayor', requiereAprobacionHumana: false, activa: true, supuesto: false, parametros: {},
  },
  {
    id: 'VIG-004', nombre: 'Fechas incoherentes', categoria: 'vigencia', campo: 'fecha_vigencia',
    descripcion: 'La fecha de vigencia no puede ser anterior a la de emisión.',
    severidad: 'bloqueante', requiereAprobacionHumana: false, activa: true, supuesto: false, parametros: {},
  },
];

export const CONFIGURACION_POR_DEFECTO: ConfiguracionReglas = {};

/** Combina una regla del catálogo con su override. Si el id no existe, falla de forma explícita. */
export function crearResolvedor(config: ConfiguracionReglas = CONFIGURACION_POR_DEFECTO): ResolverRegla {
  return (id) => {
    const base = CATALOGO_REGLAS.find((r) => r.id === id);
    if (!base) throw new Error(`Regla desconocida: ${id}`);
    const o = config.overrides?.[id];
    if (!o) return base;
    return {
      ...base,
      ...(o.severidad !== undefined && { severidad: o.severidad as Severidad }),
      ...(o.requiereAprobacionHumana !== undefined && { requiereAprobacionHumana: o.requiereAprobacionHumana }),
      ...(o.activa !== undefined && { activa: o.activa }),
      parametros: { ...base.parametros, ...o.parametros },
    };
  };
}

// ---- Lectura tipada de parámetros ----
export function paramNum(r: DefinicionRegla, nombre: string, defecto: number): number {
  const v: ValorParametro | undefined = r.parametros[nombre];
  return typeof v === 'number' ? v : defecto;
}
export function paramTxt(r: DefinicionRegla, nombre: string, defecto: string): string {
  const v = r.parametros[nombre];
  return typeof v === 'string' ? v : defecto;
}
export function paramLista(r: DefinicionRegla, nombre: string): readonly (string | number)[] {
  const v = r.parametros[nombre];
  return Array.isArray(v) ? (v as readonly (string | number)[]) : [];
}
export function paramMapa(r: DefinicionRegla, nombre: string): { readonly [clave: string]: readonly (string | number)[] } {
  const v = r.parametros[nombre];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as { readonly [clave: string]: readonly (string | number)[] }) : {};
}
