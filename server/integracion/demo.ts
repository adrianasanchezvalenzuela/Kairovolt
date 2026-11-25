import type {
  ArchivoExterno, ClienteExterno, ContactoExterno, DependenciaTarea, EstadoTareaExterna, OportunidadExterna, PuertoArchivos, PuertoCrm,
  PuertoGestionProyectos, ReferenciaExterna, ResultadoAsegurar,
} from '../../src/application/integracion/puertos';

/**
 * Adaptadores DEMO: cumplen los mismos puertos que los reales pero SOLO guardan en memoria. NO hacen ninguna llamada a Zoho ni
 * simulan que la hayan hecho: sus ids empiezan con «demo-» y la API los marca como DEMO. Sirven para probar el flujo completo,
 * incluida la idempotencia, sin credenciales.
 */
export function crearAdaptadoresDemo() {
  const tratos = new Map<string, { id: string; nombre: string }>();
  const notas = new Set<string>();
  const proyectos = new Map<string, string>();
  const listas = new Map<string, string>();
  const tareas = new Map<string, { id: string; clave: string; inicio: string | null; fin: string | null; responsable: string | null }>();
  const carpetas = new Map<string, string>();
  const dependenciasHechas = new Set<string>();
  const archivos = new Map<string, ArchivoExterno[]>();
  let n = 0;
  const id = (tipo: string) => `demo-${tipo}-${++n}`;

  /** Devuelve lo existente o lo crea; en simulación no guarda nada. */
  function asegurar<T>(mapa: Map<string, T>, clave: string, nuevo: () => T, idDe: (v: T) => string, simular: boolean, etiqueta: string): ResultadoAsegurar {
    const existente = mapa.get(clave);
    if (existente !== undefined) return { id: idDe(existente), accion: 'sin_cambios' };
    if (simular) return { id: `(${etiqueta} nuevo)`, accion: 'simulado' };
    const v = nuevo();
    mapa.set(clave, v);
    return { id: idDe(v), accion: 'creado' };
  }

  const crm: PuertoCrm = {
    consultarClientes: async (): Promise<ClienteExterno[]> => [],
    consultarContactos: async (): Promise<ContactoExterno[]> => [],
    consultarOportunidades: async (): Promise<OportunidadExterna[]> =>
      [...tratos.values()].map((t) => ({ id: t.id, nombre: t.nombre, folio: t.nombre.split(' ')[0] ?? null, etapa: null, clienteId: null, contactoId: null, fechaCierre: null })),
    upsertProyecto: async (p, o) => asegurar(tratos, p.folio, () => ({ id: id('trato'), nombre: `${p.folio} - ${p.nombre}` }), (t) => t.id, o.simular, 'trato'),
    sincronizarFolio: async (tratoId) => ({ id: tratoId, accion: 'sin_cambios', detalle: 'DEMO: no hay CRM real.' }),
    async registrarReferencia(tratoId, ref: ReferenciaExterna, o) {
      const clave = `${tratoId}|${ref.sistema}|${ref.tipo}|${ref.idExterno}`;
      if (notas.has(clave)) return { id: tratoId, accion: 'sin_cambios' };
      if (o.simular) return { id: tratoId, accion: 'simulado' };
      notas.add(clave);
      return { id: tratoId, accion: 'creado' };
    },
  };

  const gestion: PuertoGestionProyectos = {
    soportaDependencias: true,
    asegurarProyecto: async (p, o) => asegurar(proyectos, p.folio, () => id('proyecto'), (v) => v, o.simular, 'proyecto'),
    asegurarListaTareas: async (pid, nombre, o) => asegurar(listas, `${pid}|${nombre}`, () => id('lista'), (v) => v, o.simular, 'lista'),
    async asegurarTarea(pid, _lista, _folio, t, o) {
      const clave = `${pid}|${t.clave}`;
      const previa = tareas.get(clave);
      if (!previa) {
        if (o.simular) return { id: '(tarea nueva)', accion: 'simulado' };
        const nueva = { id: id('tarea'), clave: t.clave, inicio: t.inicioPlan, fin: t.finPlan, responsable: null };
        tareas.set(clave, nueva);
        return { id: nueva.id, accion: 'creado' };
      }
      const cambia = (t.inicioPlan !== null && t.inicioPlan !== previa.inicio) || (t.finPlan !== null && t.finPlan !== previa.fin);
      if (!cambia) return { id: previa.id, accion: 'sin_cambios' };
      if (o.simular) return { id: previa.id, accion: 'simulado' };
      tareas.set(clave, { ...previa, inicio: t.inicioPlan ?? previa.inicio, fin: t.finPlan ?? previa.fin });
      return { id: previa.id, accion: 'actualizado' };
    },
    async asignarResponsable(_pid, tareaId, correo, o) {
      const t = [...tareas.entries()].find(([, v]) => v.id === tareaId);
      if (!t) return { id: tareaId, accion: 'sin_cambios' };
      if (t[1].responsable === correo) return { id: tareaId, accion: 'sin_cambios' };
      if (o.simular) return { id: tareaId, accion: 'simulado' };
      tareas.set(t[0], { ...t[1], responsable: correo });
      return { id: tareaId, accion: 'actualizado' };
    },
    async consultarEstados(pid): Promise<EstadoTareaExterna[]> {
      return [...tareas.entries()].filter(([k]) => k.startsWith(`${pid}|`)).map(([, v]) => ({
        id: v.id, nombre: v.clave, clave: v.clave as EstadoTareaExterna['clave'], estadoExterno: 'DEMO', estado: 'pendiente', inicioPlan: v.inicio, finPlan: v.fin, finReal: null,
      }));
    },
    async administrarDependencias(pid, deps: DependenciaTarea[], o) {
      const nuevas = deps.filter((d) => !dependenciasHechas.has(`${d.tareaId}<${d.predecesoraId}`));
      if (nuevas.length === 0) return { id: pid, accion: 'sin_cambios' };
      if (o.simular) return { id: pid, accion: 'simulado', detalle: `DEMO: se enlazarían ${nuevas.length} dependencia(s).` };
      for (const d of nuevas) dependenciasHechas.add(`${d.tareaId}<${d.predecesoraId}`);
      return { id: pid, accion: 'actualizado' };
    },
  };

  const almacen: PuertoArchivos = {
    async asegurarCarpetaProyecto(folio, subcarpetas, o) {
      const principal = asegurar(carpetas, folio, () => id('carpeta'), (v) => v, o.simular, 'carpeta');
      const subs: Record<string, string> = {};
      let creo = principal.accion !== 'sin_cambios';
      for (const s of subcarpetas) {
        const r = asegurar(carpetas, `${folio}/${s}`, () => id('carpeta'), (v) => v, o.simular, `carpeta ${s}`);
        subs[s] = r.id;
        creo = creo || r.accion !== 'sin_cambios';
      }
      return { carpetaId: principal.id, subcarpetas: subs, accion: !creo ? 'sin_cambios' : o.simular ? 'simulado' : 'creado' };
    },
    async subirArchivo(carpetaId, nombre, contenido, _mime, o) {
      if (o.simular) return { archivo: null, accion: 'simulado' };
      const previos = archivos.get(carpetaId) ?? [];
      const anterior = previos.find((a) => a.nombre === nombre);
      const archivo: ArchivoExterno = { id: anterior?.id ?? id('archivo'), nombre, carpetaId, version: (anterior?.version ?? 0) + 1, tamano: contenido.byteLength, url: null };
      archivos.set(carpetaId, [...previos.filter((a) => a.nombre !== nombre), archivo]);
      return { archivo, accion: anterior ? 'nueva_version' : 'creado' };
    },
    listarArchivos: async (carpetaId) => archivos.get(carpetaId) ?? [],
  };

  return { crm, proyectos: gestion, archivos: almacen };
}
