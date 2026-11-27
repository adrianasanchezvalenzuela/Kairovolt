import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analizarProyecto, hoyIso } from '@/application/analizar-proyecto';
import type { ItemCartera } from '@/application/cartera';
import {
  aplicarDecisiones, asignarResponsable, ErrorDecision, reabrirSiReaparece, registrarCambioCompuerta, registrarObservacion, registrarResolucion,
  type ContextoDecision, type DecisionesProyecto, type DecisionesRepositorio,
} from '@/application/decisiones';
import type { ResultadoSincronizacion } from '@/application/sincronizacion';
import { ErrorSincronizacion } from '@/application/sincronizacion';
import { evaluarBloqueoCompuerta } from '@/domain/compuertas/bloqueo';
import type { CompuertaId, EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { evaluarTransicionCompuerta } from '@/domain/compuertas/transiciones';
import type { Observacion, ResolucionObservacion } from '@/domain/observaciones/observacion';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { hayRequisitosPendientesDeIDC } from '@/domain/checklist/catalogo';
import type { ResultadoValidacion } from '@/domain/reglas/tipos';
import { puede } from '@/domain/usuarios/permisos';
import { catalogoRepositorio, decisionesRepositorio } from '@/infrastructure';
import { useFuenteDatos } from './FuenteDatos';

const SISTEMA = { uid: null, nombre: 'Sistema' } as const;

const ctxBase = (folio: string, actor: ContextoDecision['actor']): ContextoDecision => ({
  folio, actor, hoy: hoyIso(), ahora: new Date().toISOString(), nuevoId: () => crypto.randomUUID(),
});

/** Aplica las decisiones guardadas, analiza y reabre lo que corresponda si un problema reapareció (guardando esa reapertura). */
async function armar(p: Proyecto, repo: DecisionesRepositorio, catalogo: typeof catalogoRepositorio): Promise<{ item: ItemCartera; decisiones: DecisionesProyecto }> {
  const catalogoRequisitos = await catalogo.listar();
  const hoy = hoyIso();
  let decisiones = await repo.cargar(p.folio);
  let efectivo = aplicarDecisiones(p, decisiones);
  let analisis = analizarProyecto(efectivo, { hoy, requisitos: catalogoRequisitos });

  const reabierto = reabrirSiReaparece(decisiones, efectivo.observaciones, analisis.resultados, ctxBase(p.folio, SISTEMA));
  if (reabierto !== decisiones) {
    decisiones = reabierto;
    await repo.guardar(p.folio, decisiones);
    efectivo = aplicarDecisiones(p, decisiones);
    analisis = analizarProyecto(efectivo, { hoy, requisitos: catalogoRequisitos });
  }
  return { item: { proyecto: efectivo, analisis }, decisiones };
}

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : 'Error desconocido');

/** Todos los proyectos de la fuente activa, ya analizados (para el dashboard y las páginas de cartera). */
export function useCartera() {
  const { repositorio, catalogo } = useFuenteDatos();
  const [items, setItems] = useState<ItemCartera[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(() => {
    setItems(null);
    setError(null);
    repositorio.listar()
      .then((ps) => Promise.all(ps.map((p) => armar(p, decisionesRepositorio, catalogo))))
      .then((r) => setItems(r.map((x) => x.item)))
      .catch((e: unknown) => setError(mensaje(e)));
  }, [repositorio, catalogo]);
  useEffect(recargar, [recargar]);

  return { items, error, recargar, hoy: hoyIso() };
}

export type ResultadoCambioCompuerta = { tipo: 'local' } | { tipo: 'zoho'; resultado: ResultadoSincronizacion } | { tipo: 'simulado'; resultado: ResultadoSincronizacion };

/** Un proyecto con su análisis y las operaciones de decisión (todas con permiso comprobado y auditoría). */
export function useProyectoCompleto(id: string) {
  const { repositorio, catalogo, sincronizacion, usuario, fuente } = useFuenteDatos();
  const [estado, setEstado] = useState<{ item: ItemCartera; decisiones: DecisionesProyecto } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const baseRef = useRef<Proyecto | null>(null);

  const cargar = useCallback(async () => {
    try {
      const p = await repositorio.obtenerPorId(id);
      baseRef.current = p;
      setEstado(p ? await armar(p, decisionesRepositorio, catalogo) : null);
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    }
  }, [repositorio, id, catalogo]);
  useEffect(() => { setEstado(undefined); void cargar(); }, [cargar]);

  const actor = useMemo(() => ({ uid: null, nombre: usuario?.nombre ?? usuario?.correo ?? 'Sin sesión' }), [usuario]);
  const rol = usuario?.rol;

  /** Aplica una decisión sobre las decisiones guardadas y vuelve a calcular todo. */
  const mutar = useCallback(async (f: (d: DecisionesProyecto, ctx: ContextoDecision) => DecisionesProyecto) => {
    const base = baseRef.current;
    if (!base) throw new ErrorDecision(['El proyecto no está cargado.']);
    const actuales = await decisionesRepositorio.cargar(base.folio);
    const nuevas = f(actuales, ctxBase(base.folio, actor));
    await decisionesRepositorio.guardar(base.folio, nuevas);
    setEstado(await armar(base, decisionesRepositorio, catalogo));
  }, [actor, catalogo]);

  const exigir = (permitido: boolean, texto: string) => {
    if (!permitido) throw new ErrorDecision([texto]);
  };
  const item = estado?.item;

  return {
    cargando: estado === undefined && error === null,
    noEncontrado: estado === null,
    error,
    proyecto: item?.proyecto ?? null,
    analisis: item?.analisis ?? null,
    decisiones: estado?.decisiones ?? null,
    fuente,
    usuario,
    permisos: {
      gestionarValidaciones: puede(rol, 'gestionar_validaciones'),
      aprobarExcepciones: puede(rol, 'aprobar_excepciones'),
      liberarCompuertas: puede(rol, 'liberar_compuertas'),
    },
    recargar: cargar,

    /** Registra (sin duplicar) la observación de un fallo de validación. */
    registrarObservacion: (r: ResultadoValidacion) => {
      exigir(puede(rol, 'gestionar_validaciones'), 'Tu rol no puede registrar observaciones.');
      let creada: Observacion | null = null;
      return mutar((d, ctx) => {
        const res = registrarObservacion(d, item!.proyecto.observaciones, r, ctx, { responsable: null });
        creada = res.observacion;
        return res.decisiones;
      }).then(() => creada as Observacion | null);
    },

    asignarResponsable: (obs: Observacion, responsable: string, fechaCompromiso: string | null) => {
      exigir(puede(rol, 'gestionar_validaciones'), 'Tu rol no puede asignar responsables.');
      return mutar((d, ctx) => asignarResponsable(d, obs, responsable, fechaCompromiso, ctx));
    },

    resolver: (obs: Observacion, resolucion: ResolucionObservacion) => {
      exigir(puede(rol, 'gestionar_validaciones'), 'Tu rol no puede registrar resoluciones.');
      const huella = obs.origenValidacion?.huella;
      const actual = huella ? item?.analisis.resultados.find((x) => x.huella === huella) ?? null : null;
      return mutar((d, ctx) => registrarResolucion(d, obs, resolucion, { validacionActual: actual, actorPuedeAprobar: puede(rol, 'aprobar_excepciones') }, ctx));
    },

    /**
     * Cambia el estado de una compuerta validando la transición con el dominio. Con datos reales escribe en Zoho Projects
     * (o solo simula); con datos de prueba queda como decisión local.
     */
    cambiarCompuerta: async (compuerta: CompuertaId, a: EstadoCompuerta, opciones: { comentario?: string; simular?: boolean } = {}): Promise<ResultadoCambioCompuerta> => {
      const p = item?.proyecto;
      const an = item?.analisis;
      if (!p || !an) throw new ErrorDecision(['El proyecto no está cargado.']);
      const de = p.compuertas.find((c) => c.id === compuerta)?.estado;
      if (!de) throw new ErrorDecision([`El proyecto no tiene la compuerta ${compuerta}.`]);
      if (fuente === 'zoho' && a === 'liberada' && opciones.simular !== true) {
        const requisitos = await catalogo.listarAdministrativo();
        if (hayRequisitosPendientesDeIDC(requisitos)) throw new ErrorDecision(['No se puede liberar una compuerta: el catálogo documental tiene requisitos pendientes de validación por IDC.']);
      }
      const bloqueo = an.disponible
        ? an.bloqueos[compuerta]
        // Sin expediente no se puede afirmar que no hay bloqueos: se consideran por lo que sí se sabe y se avisa.
        : evaluarBloqueoCompuerta({ compuerta, compuertas: p.compuertas, resumenes: [], validacionesBloqueantes: [], observaciones: p.observaciones });
      const decision = evaluarTransicionCompuerta({ compuerta, de, a, bloqueo, actorPuedeLiberar: puede(rol, 'liberar_compuertas'), motivo: opciones.comentario ?? null });
      if (!decision.ok) throw new ErrorDecision(decision.motivos);
      if (!an.disponible && (a === 'en_revision' || a === 'liberada')) throw new ErrorDecision(['El expediente no está disponible desde la fuente: no se puede comprobar el checklist ni las validaciones.']);
      exigir(puede(rol, 'gestionar_validaciones'), 'Tu rol no puede cambiar el estado de las compuertas.');

      if (fuente === 'zoho') {
        if (!sincronizacion) throw new ErrorSincronizacion('Tu rol no puede escribir en Zoho.');
        const resultado = await sincronizacion.compuerta({ folio: p.folio, compuerta, estado: a, simular: opciones.simular === true });
        if (opciones.simular === true || resultado.tipo === 'simulado') return { tipo: 'simulado', resultado };
        await mutar((d, ctx) => registrarCambioCompuerta(d, { compuerta, de, a, comentario: opciones.comentario ?? null }, ctx));
        return { tipo: 'zoho', resultado };
      }
      await mutar((d, ctx) => registrarCambioCompuerta(d, { compuerta, de, a, comentario: opciones.comentario ?? null }, ctx));
      return { tipo: 'local' };
    },
  };
}

export type ProyectoCompleto = ReturnType<typeof useProyectoCompleto>;
