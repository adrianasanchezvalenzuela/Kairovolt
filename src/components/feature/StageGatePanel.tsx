import { useState } from 'react';
import type { AnalisisProyecto } from '@/application/analizar-proyecto';
import { aprobacionDe } from '@/application/decisiones';
import { NOMBRE_COMPUERTA, ORDEN_COMPUERTAS, type CompuertaId, type EstadoCompuerta } from '@/domain/compuertas/compuerta';
import { evaluarTransicionCompuerta } from '@/domain/compuertas/transiciones';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ChecklistTable } from './ChecklistTable';
import { ETIQUETA_ESTADO_COMPUERTA, TONO_ESTADO_COMPUERTA } from './GateStepper';
import { StageGateStepper } from './StageGateStepper';

export interface CambioSolicitado { compuerta: CompuertaId; a: EstadoCompuerta; comentario: string; simular: boolean }

export interface StageGatePanelProps {
  proyecto: Proyecto;
  analisis: AnalisisProyecto;
  /** Quién puede qué (la matriz de permisos la aplica quien usa el componente; el backend la vuelve a exigir con datos reales). */
  puedeLiberar: boolean;
  puedeGestionar: boolean;
  /** Con datos reales se puede simular el envío a Zoho Projects sin escribir. */
  permiteSimular: boolean;
  /** Texto de a dónde va el cambio: «Zoho Projects» o «este navegador (datos de prueba)». */
  destinoCambio: string;
  onCambiar: (c: CambioSolicitado) => Promise<string>;
  onAbrirDocumento?: (documentoId: string) => void;
  compuertaInicial?: CompuertaId;
  /** Documentos con la vigencia vencida. */
  vencidos?: ReadonlySet<string>;
}

const ACCION: Record<EstadoCompuerta, { boton: string; ayuda: string }> = {
  pendiente: { boton: 'Regresar a pendiente', ayuda: 'Devuelve la compuerta al inicio.' },
  en_revision: { boton: 'Solicitar revisión', ayuda: 'Pone la compuerta en revisión.' },
  liberada: { boton: 'Liberar compuerta', ayuda: 'Queda registrado quién la aprueba.' },
  bloqueada: { boton: 'Bloquear', ayuda: 'Detiene la compuerta; exige indicar el motivo.' },
};

/**
 * Stage-Gate G0–G3: estado, requisitos, bloqueos, quién aprobó y los cambios de estado permitidos. Los inválidos aparecen
 * deshabilitados con el motivo; las reglas viven en el dominio (`evaluarTransicionCompuerta`), no aquí.
 */
export function StageGatePanel({ proyecto, analisis, puedeLiberar, puedeGestionar, permiteSimular, destinoCambio, onCambiar, onAbrirDocumento, compuertaInicial, vencidos }: StageGatePanelProps) {
  const [id, setId] = useState<CompuertaId>(compuertaInicial ?? ORDEN_COMPUERTAS.find((c) => proyecto.compuertas.find((x) => x.id === c)?.estado !== 'liberada') ?? 'G0');
  const [pendiente, setPendiente] = useState<EstadoCompuerta | null>(null);
  const [comentario, setComentario] = useState('');
  const [simular, setSimular] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const estado = proyecto.compuertas.find((c) => c.id === id)?.estado ?? 'pendiente';
  const resumen = analisis.checklist.find((r) => r.compuerta === id);
  const bloqueo = analisis.bloqueos[id];
  const aprobacion = aprobacionDe(proyecto, id);
  const razones = bloqueo.razones.filter((r) => r.tipo !== 'compuerta_liberada');
  const tituloValidacion = new Map(analisis.pendientes.map((v) => [v.huella, v.titulo]));

  const decisionPara = (a: EstadoCompuerta, motivo?: string) => evaluarTransicionCompuerta({ compuerta: id, de: estado, a, bloqueo, actorPuedeLiberar: puedeLiberar, ...(motivo !== undefined && { motivo }) });
  const otros = (['pendiente', 'en_revision', 'liberada', 'bloqueada'] as EstadoCompuerta[]).filter((e) => e !== estado);
  const sinExpediente = !analisis.disponible;

  const confirmar = async () => {
    if (!pendiente) return;
    setEnviando(true);
    setError(null);
    try {
      setAviso(await onCambiar({ compuerta: id, a: pendiente, comentario, simular }));
      setPendiente(null);
      setComentario('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setEnviando(false);
    }
  };

  const decisionPendiente = pendiente ? decisionPara(pendiente, comentario) : null;

  return (
    <div className="kv-gate">
      <StageGateStepper
        etiqueta="Compuertas del proyecto" seleccionadoId={id} onSeleccionar={(x) => { setId(x as CompuertaId); setAviso(null); }}
        pasos={ORDEN_COMPUERTAS.map((c) => {
          const e = proyecto.compuertas.find((x) => x.id === c)?.estado ?? 'pendiente';
          const r = analisis.checklist.find((x) => x.compuerta === c);
          return { id: c, titulo: NOMBRE_COMPUERTA[c], tono: TONO_ESTADO_COMPUERTA[e], estado: ETIQUETA_ESTADO_COMPUERTA[e], progreso: r ? `${r.recibidosObligatorios}/${r.totalObligatorios} documentos` : '—' };
        })}
      />
      {aviso && <AlertPanel tono="ok" onCerrar={() => setAviso(null)}>{aviso}</AlertPanel>}

      <section className="kv-gate__bloque" aria-labelledby="gate-estado">
        <h3 id="gate-estado">{id} · {NOMBRE_COMPUERTA[id]} <StatusBadge tono={TONO_ESTADO_COMPUERTA[estado]}>{ETIQUETA_ESTADO_COMPUERTA[estado]}</StatusBadge></h3>
        <p style={{ margin: 0 }}>
          {aprobacion
            ? <>Aprobada por <strong>{aprobacion.aprobadoPor}</strong> el <span className="kv-mono">{aprobacion.fecha}</span>{aprobacion.comentario ? ` — ${aprobacion.comentario}` : ''}.</>
            : estado === 'liberada' ? <span className="kv-suave">Liberada, pero la fuente no indica quién la aprobó.</span> : <span className="kv-suave">Sin aprobación registrada.</span>}
        </p>
      </section>

      <section className="kv-gate__bloque" aria-labelledby="gate-bloqueos">
        <h3 id="gate-bloqueos">Bloqueantes</h3>
        {sinExpediente && <AlertPanel tono="alerta" variante="en-linea">El expediente no está disponible desde la fuente: no se pueden comprobar documentos ni validaciones de esta compuerta.</AlertPanel>}
        {razones.length === 0 && !sinExpediente
          ? <p style={{ margin: 0 }}><StatusBadge tono="ok" variante="suave">Sin bloqueos</StatusBadge> <span className="kv-suave">{estado === 'liberada' ? 'La compuerta ya está liberada.' : 'Puede avanzar.'}</span></p>
          : (
            <ul className="kv-gate__lista">
              {razones.map((r) => (
                <li key={r.tipo}>
                  <strong>{r.mensaje}</strong>
                  {r.tipo === 'validacion_bloqueante' && <ul className="kv-gate__motivos">{r.referencias.map((h) => <li key={h}>{tituloValidacion.get(h) ?? h}</li>)}</ul>}
                  {r.tipo === 'documentos_faltantes' && resumen && <ul className="kv-gate__motivos">{resumen.faltantes.map((f) => <li key={f.requisito.id}>{f.requisito.nombre}</li>)}</ul>}
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="kv-gate__bloque" aria-labelledby="gate-req">
        <h3 id="gate-req">Requisitos de {id}</h3>
        {!resumen || resumen.items.length === 0
          ? <p className="kv-suave" style={{ margin: 0 }}>{sinExpediente ? 'Sin expediente disponible.' : `Sin requisitos definidos para ${id}.`}</p>
          : (
            <ChecklistTable resumen={resumen} {...(onAbrirDocumento && { onAbrir: onAbrirDocumento })} vencidos={vencidos} />
          )}
      </section>

      <section className="kv-gate__bloque" aria-labelledby="gate-trans">
        <h3 id="gate-trans">Cambiar el estado de {id}</h3>
        {estado === 'liberada' && <p className="kv-suave" style={{ marginTop: 0 }}>Una compuerta liberada es definitiva: su estado ya no se cambia desde aquí.</p>}
        <div className="kv-gate__acciones">
          {otros.map((a) => {
            const d = decisionPara(a, 'motivo de ejemplo');
            const invalida = !d.ok;
            return (
              <div key={a}>
                <Boton variante={a === 'liberada' ? 'primario' : a === 'bloqueada' ? 'peligro' : 'secundario'} disabled={invalida || !puedeGestionar} aria-describedby={invalida ? `gate-m-${a}` : undefined} onClick={() => { setPendiente(a); setError(null); }}>
                  {ACCION[a].boton}
                </Boton>
                {invalida && !d.ok && <ul className="kv-gate__motivos" id={`gate-m-${a}`}>{d.motivos.map((m) => <li key={m}>{m}</li>)}</ul>}
              </div>
            );
          })}
        </div>
        {!puedeGestionar && <p className="kv-campo__ayuda">Inicia sesión con un rol autorizado para cambiar el estado de las compuertas.</p>}
        {puedeGestionar && !puedeLiberar && <p className="kv-campo__ayuda">Tu rol no puede liberar compuertas.</p>}
      </section>

      <Dialogo
        abierto={pendiente !== null} titulo={pendiente ? `${ACCION[pendiente].boton}: ${id}` : ''} onCerrar={() => setPendiente(null)} ocupado={enviando}
        pie={<><Boton onClick={() => setPendiente(null)} disabled={enviando}>Cancelar</Boton><Boton variante={pendiente === 'bloqueada' ? 'peligro' : 'primario'} cargando={enviando} disabled={decisionPendiente !== null && !decisionPendiente.ok} onClick={() => void confirmar()}>{simular ? 'Simular' : 'Confirmar'}</Boton></>}
      >
        {pendiente && (
          <>
            <p>{ACCION[pendiente].ayuda} El cambio se guarda en <strong>{destinoCambio}</strong> con tu nombre y la fecha.</p>
            <div className="kv-campo">
              <label htmlFor="gate-com">{pendiente === 'bloqueada' ? 'Motivo del bloqueo' : 'Comentario (opcional)'}</label>
              <textarea id="gate-com" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} required={pendiente === 'bloqueada'} />
            </div>
            {permiteSimular && <label><input type="checkbox" checked={simular} onChange={(e) => setSimular(e.target.checked)} /> Solo simular (no escribe en Zoho)</label>}
            {decisionPendiente && !decisionPendiente.ok && <AlertPanel tono="alerta" variante="en-linea" titulo="No procede"><ul style={{ margin: 0, paddingLeft: 18 }}>{decisionPendiente.motivos.map((m) => <li key={m}>{m}</li>)}</ul></AlertPanel>}
            {error && <AlertPanel tono="error" variante="en-linea">{error}</AlertPanel>}
          </>
        )}
      </Dialogo>
    </div>
  );
}
