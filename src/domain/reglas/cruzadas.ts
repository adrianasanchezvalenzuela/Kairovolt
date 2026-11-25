import { CAMPOS, type CampoDato } from '../validacion/campos';
import { agruparDeclaraciones, ordenDeMagnitud, parseNumero } from './comparacion';
import { CATALOGO_REGLAS, paramNum } from './configuracion';
import { declaracionesDe, unidadCampo, valorDeConfiguracion } from './declaraciones';
import { crearResultado } from './resultado';
import type { DefinicionRegla, Evaluador, ResultadoValidacion } from './tipos';

const ACCION =
  'Confirma con el cliente o el proyectista cuál es el dato correcto, corrige el documento que esté mal y vuelve a cargar la versión corregida.';

function evaluarCampo(ctx: Parameters<Evaluador>[0], regla: DefinicionRegla): ResultadoValidacion {
  const campo = regla.campo as CampoDato;
  const def = CAMPOS[campo];
  const unidad = unidadCampo(campo);
  const decl = declaracionesDe(ctx, campo);
  const origen = decl.map((d) => ({ id: d.origenId, nombre: d.origenNombre, valor: `${d.valor}${unidad}` }));

  if (decl.length < 2) {
    return crearResultado(regla, {
      resultado: 'no_evaluable',
      documentosOrigen: origen,
      explicacion: decl.length === 0
        ? `Ninguna fuente declara «${def.etiqueta}».`
        : `Solo «${decl[0]!.origenNombre}» declara «${def.etiqueta}»: se necesitan al menos dos fuentes para comparar.`,
      accionRecomendada: 'Captura este dato en los documentos donde aparece para poder compararlo.',
    });
  }

  const grupos = agruparDeclaraciones(decl, def.tipoValor, {
    relativa: paramNum(regla, 'toleranciaRelativa', 0),
    absoluta: paramNum(regla, 'toleranciaAbsoluta', 0),
    metros: paramNum(regla, 'toleranciaMetros', 100),
  });

  if (grupos.length === 1) {
    return crearResultado(regla, {
      resultado: 'cumple', documentosOrigen: origen, valorEncontrado: grupos[0]!.representante,
      explicacion: `«${def.etiqueta}» coincide en ${decl.length} fuentes.`, accionRecomendada: 'Ninguna.',
    });
  }

  let pista = '';
  const [a, b] = grupos;
  if (grupos.length === 2 && def.tipoValor === 'numero' && a && b) {
    const x = parseNumero(a.representante);
    const y = parseNumero(b.representante);
    const factor = x !== null && y !== null ? ordenDeMagnitud(x, y, paramNum(regla, 'toleranciaOrdenMagnitud', 0.05)) : null;
    if (factor !== null) pista = ` Los valores difieren casi exactamente ×${factor}: revisa si hay un punto decimal mal ubicado (es solo una pista; no se corrige nada).`;
  }
  const detalle = grupos.map((g) => `${g.representante}${unidad} (${g.miembros.map((m) => m.origenNombre).join(', ')})`).join('; ');
  return crearResultado(regla, {
    resultado: 'no_cumple',
    documentosOrigen: origen,
    valorEncontrado: grupos.map((g) => g.representante).join(' / ') + unidad,
    valorEsperado: valorDeConfiguracion(ctx.configuracion, campo),
    explicacion: `«${def.etiqueta}»: hay ${grupos.length} valores distintos entre fuentes: ${detalle}.${pista} Requiere confirmación humana; el sistema no determina cuál versión es la correcta.`,
    accionRecomendada: ACCION,
  });
}

/** Una regla CRU-xxx por campo cruzado. Compara todas las fuentes entre sí; NUNCA elige una como la correcta. */
export const evaluarCruzadas: Evaluador = (ctx, resolver) =>
  CATALOGO_REGLAS.filter((r) => r.categoria === 'cruzada').map((r) => evaluarCampo(ctx, resolver(r.id)));

