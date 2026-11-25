import { useMemo, useState } from 'react';
import type { AnalisisProyecto } from '@/application/analizar-proyecto';
import { evaluarResolucion } from '@/domain/observaciones/resolucion';
import { ETIQUETA_RESOLUCION, type Observacion, type ResolucionObservacion } from '@/domain/observaciones/observacion';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { ORDEN_SEVERIDAD, type ResultadoValidacion, type Severidad } from '@/domain/reglas/tipos';
import { ROLES_USUARIO } from '@/domain/usuarios/rol';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { EmptyState } from '@/components/ui/Estados';
import { KPI, KPIGrid } from '@/components/ui/KPI';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AsignarResponsableDialogo, ResolucionDialogo } from './DialogosValidacion';
import { PanelEvidencia } from './PanelEvidencia';
import { ValidationCard } from './ValidationCard';
import { aValidacionVistaResultado } from './validacion-vista';

export interface AccionesValidacion {
  registrarObservacion: (r: ResultadoValidacion) => Promise<Observacion | null>;
  asignarResponsable: (o: Observacion, responsable: string, fechaCompromiso: string | null) => Promise<void>;
  resolver: (o: Observacion, r: ResolucionObservacion) => Promise<void>;
}

export interface ValidacionesProyectoProps {
  proyecto: Proyecto;
  analisis: AnalisisProyecto;
  acciones: AccionesValidacion;
  permisos: { gestionarValidaciones: boolean; aprobarExcepciones: boolean };
  /** Nombre de quien está dentro (null = sin sesión). */
  usuario: string | null;
  hoy: string;
  /** Huella a resaltar y abrir (viene de una alerta). */
  enfocar?: string | null;
}

type Filtro = 'atencion' | 'todas';
const TONO_SEVERIDAD = { bloqueante: 'error', mayor: 'alerta', menor: 'info', informativa: 'neutro' } as const;

/**
 * Pestaña de validaciones del proyecto: documentos comparados con sus valores, discrepancias y severidad, evidencia abrible,
 * y las decisiones humanas (registrar observación, asignar responsable, registrar resolución). Nada se corrige solo.
 */
export function ValidacionesProyecto({ proyecto, analisis, acciones, permisos, usuario, hoy, enfocar }: ValidacionesProyectoProps) {
  const [filtro, setFiltro] = useState<Filtro>('atencion');
  const [severidad, setSeveridad] = useState<'todas' | Severidad>('todas');
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const [asignando, setAsignando] = useState<Observacion | null>(null);
  const [resolviendo, setResolviendo] = useState<Observacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const idsAbribles = useMemo(() => new Set(proyecto.documentos.map((d) => d.id)), [proyecto.documentos]);
  const documentoAbierto = proyecto.documentos.find((d) => d.id === evidencia) ?? null;
  const sugerencias = useMemo(() => [...new Set([
    ...ROLES_USUARIO.map((r) => r.etiqueta), ...proyecto.cronograma.flatMap((a) => (a.responsable ? [a.responsable] : [])), ...proyecto.acciones.flatMap((a) => (a.responsable ? [a.responsable] : [])), ...(usuario ? [usuario] : []),
  ])], [proyecto, usuario]);

  if (!analisis.disponible) {
    return <AlertPanel tono="info" titulo="Validaciones no disponibles">La fuente de datos no trae el expediente de este proyecto (documentos y datos técnicos), así que no hay nada que validar. No se muestran resultados inventados.</AlertPanel>;
  }

  const visibles = analisis.resultados
    .filter((r) => (filtro === 'todas' ? true : r.resultado === 'no_cumple'))
    .filter((r) => severidad === 'todas' || r.severidad === severidad);
  const { resumen, pendientes, excepciones } = analisis;

  const ejecutar = async (clave: string, f: () => Promise<void>) => {
    setOcupado(clave);
    setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); } finally { setOcupado(null); }
  };

  const registrarYAsignar = (r: ResultadoValidacion) => ejecutar(r.huella, async () => {
    const obs = await acciones.registrarObservacion(r);
    if (obs) setAsignando(obs);
  });

  const seguimiento = (r: ResultadoValidacion) => {
    const o = analisis.vinculos.get(r.huella);
    return (
      <>
        {excepciones.has(r.huella) && <StatusBadge tono="alerta" variante="suave">Excepción aprobada</StatusBadge>}
        {o && o.estado !== 'cerrada' && <StatusBadge tono="info" variante="suave">Observación {o.estado === 'en_atencion' ? 'en atención' : 'abierta'}{o.responsable ? ` · ${o.responsable}` : ' · sin responsable'}</StatusBadge>}
        {o && o.estado === 'cerrada' && <StatusBadge tono="ok" variante="suave">Resuelta{o.resolucion ? ` · ${ETIQUETA_RESOLUCION[o.resolucion.tipo]}` : ''}</StatusBadge>}
      </>
    );
  };

  const acciones_ = (r: ResultadoValidacion) => {
    if (r.resultado !== 'no_cumple') return null;
    const o = analisis.vinculos.get(r.huella);
    const abierta = o && o.estado !== 'cerrada' ? o : null;
    return (
      <div className="kv-fila" role="group" aria-label={`Decisiones sobre ${r.reglaNombre}`}>
        {abierta && (
          <p style={{ margin: 0, width: '100%' }} className="kv-suave">
            Responsable: <strong>{abierta.responsable ?? 'sin asignar'}</strong> · Compromiso: <span className="kv-mono">{abierta.fechaCompromiso ?? 'sin fecha'}</span>
          </p>
        )}
        {o?.resolucion && o.estado === 'cerrada' && (
          <p style={{ margin: 0, width: '100%' }} className="kv-suave">
            Resuelta por <strong>{o.resolucion.responsable}</strong> el <span className="kv-mono">{o.resolucion.fecha}</span>: {o.resolucion.justificacion}
          </p>
        )}
        {!abierta && !o && <Boton tamano="sm" variante="primario" disabled={!permisos.gestionarValidaciones} cargando={ocupado === r.huella} onClick={() => void registrarYAsignar(r)}>Registrar observación</Boton>}
        {abierta && <Boton tamano="sm" disabled={!permisos.gestionarValidaciones} onClick={() => setAsignando(abierta)}>Asignar responsable</Boton>}
        {abierta && <Boton tamano="sm" variante="primario" disabled={!permisos.gestionarValidaciones} onClick={() => setResolviendo(abierta)}>Registrar resolución</Boton>}
        {!permisos.gestionarValidaciones && <span className="kv-campo__ayuda">{usuario ? 'Tu rol no puede tomar decisiones sobre validaciones.' : 'Inicia sesión con un rol autorizado para tomar decisiones.'}</span>}
        {r.requiereAprobacionHumana && !permisos.aprobarExcepciones && <span className="kv-campo__ayuda">Aceptar este valor como excepción requiere un rol autorizado.</span>}
      </div>
    );
  };

  return (
    <>
      <p className="kv-demo">Las decisiones (observaciones, responsables y resoluciones) se guardan <strong>en este navegador</strong> con tu nombre y fecha; todavía no hay una base de datos compartida de decisiones y no se envían a Zoho.</p>
      <KPIGrid etiqueta="Resumen de validaciones">
        <KPI etiqueta="Bloqueantes sin resolver" tono={pendientes.length > 0 ? 'error' : 'ok'} valor={String(pendientes.length)} detalle="Sin resolver ni excepción aprobada" />
        <KPI etiqueta="No cumplen" tono={resumen.noCumplen > 0 ? 'alerta' : 'ok'} valor={String(resumen.noCumplen)} detalle={`${resumen.porSeveridad.bloqueante} bloqueantes · ${resumen.porSeveridad.mayor} mayores · ${resumen.porSeveridad.menor} menores`} />
        <KPI etiqueta="Requieren decisión humana" tono="info" valor={String(resumen.requierenAprobacionHumana)} detalle="El sistema no elige la versión correcta" />
        <KPI etiqueta="No evaluables" tono="neutro" valor={String(resumen.noEvaluables)} detalle="Faltan datos para evaluar" />
      </KPIGrid>

      <div className="kv-filtros" style={{ marginTop: 16 }}>
        <div className="kv-campo">
          <label htmlFor="f-res">Mostrar</label>
          <select id="f-res" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
            <option value="atencion">Solo lo que no cumple</option>
            <option value="todas">Todo (cumple, no evaluable)</option>
          </select>
        </div>
        <div className="kv-campo">
          <label htmlFor="f-sev">Severidad</label>
          <select id="f-sev" value={severidad} onChange={(e) => setSeveridad(e.target.value as 'todas' | Severidad)}>
            <option value="todas">Todas</option>
            {(Object.keys(ORDEN_SEVERIDAD) as Severidad[]).map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <StatusBadge tono={visibles.length === 0 ? 'ok' : TONO_SEVERIDAD[visibles[0]!.severidad]} variante="suave" tamano="md">{visibles.length} resultado(s)</StatusBadge>
      </div>

      {error && <AlertPanel tono="error" onCerrar={() => setError(null)}>{error}</AlertPanel>}
      {visibles.length === 0
        ? <EmptyState icono="✓" titulo="Nada que mostrar con este filtro" descripcion="Cambia el filtro para ver los resultados que cumplen o no son evaluables." />
        : (
          <ul className="kv-lista-alertas" aria-label="Resultados de validación">
            {visibles.map((r) => (
              <li key={r.huella} id={`val-${r.huella}`}>
                <ValidationCard
                  validacion={aValidacionVistaResultado(r, idsAbribles)}
                  abierta={enfocar === r.huella ? true : undefined}
                  seguimiento={seguimiento(r)}
                  acciones={acciones_(r)}
                  onAbrirEvidencia={setEvidencia}
                />
              </li>
            ))}
          </ul>
        )}

      <PanelEvidencia documento={documentoAbierto} onCerrar={() => setEvidencia(null)} />
      <AsignarResponsableDialogo
        key={`asig-${asignando?.id ?? 'x'}`} observacion={asignando} sugerencias={sugerencias} onCerrar={() => setAsignando(null)}
        onGuardar={(resp, fecha) => acciones.asignarResponsable(asignando!, resp, fecha)}
      />
      <ResolucionDialogo
        key={`res-${resolviendo?.id ?? 'x'}`} observacion={resolviendo} hoy={hoy} responsableInicial={usuario ?? ''}
        documentos={proyecto.documentos.map((d) => ({ id: d.id, nombre: d.nombre }))}
        motivosPrevios={(res) => {
          if (!resolviendo) return [];
          const huella = resolviendo.origenValidacion?.huella;
          const actual = huella ? analisis.resultados.find((x) => x.huella === huella) ?? null : null;
          const d = evaluarResolucion(resolviendo, res, { validacionActual: actual, actorPuedeAprobar: permisos.aprobarExcepciones });
          return d.ok ? [] : d.motivos;
        }}
        onCerrar={() => setResolviendo(null)} onGuardar={(res) => acciones.resolver(resolviendo!, res)}
      />
    </>
  );
}
