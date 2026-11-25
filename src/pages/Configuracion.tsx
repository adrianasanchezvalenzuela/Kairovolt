import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UMBRAL_SIN_MOVIMIENTO_DIAS } from '@/application/cartera';
import { CONFIGURACION_BLOQUEO_POR_DEFECTO } from '@/domain/compuertas/bloqueo';
import { NOMBRE_COMPUERTA, ORDEN_COMPUERTAS } from '@/domain/compuertas/compuerta';
import { CONFIGURACION_ZONA_POR_DEFECTO } from '@/domain/checklist/checklist';
import { META_PAER_PORCENTAJE } from '@/domain/indicadores/paer';
import { CATALOGO_REGLAS } from '@/domain/reglas/configuracion';
import { PARES_POR_DEFECTO } from '@/domain/tiempos/tiempos';
import { PERMISOS } from '@/domain/usuarios/permisos';
import { puede } from '@/domain/usuarios/permisos';
import { ROLES_USUARIO } from '@/domain/usuarios/rol';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { catalogoRepositorio } from '@/infrastructure/catalogo';
import type { RequisitoDocumental } from '@/domain/checklist/catalogo';
import type { RevisionDigital } from '@/domain/checklist/preparacion';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';

const TABS = [{ id: 'reglas', etiqueta: 'Reglas de validación' }, { id: 'requisitos', etiqueta: 'Requisitos por compuerta' }, { id: 'permisos', etiqueta: 'Permisos' }, { id: 'parametros', etiqueta: 'Parámetros' }];
const TONO_SEV = { bloqueante: 'error', mayor: 'alerta', menor: 'info', informativa: 'neutro' } as const;
const ACCIONES_ETIQUETA: Record<string, string> = {
  ver_datos: 'Ver datos', sincronizar_zoho: 'Sincronizar con Zoho', descubrir_zoho: 'Explorar Zoho (administración)', gestionar_usuarios: 'Gestionar usuarios',
  aprobar_excepciones: 'Aprobar excepciones', gestionar_validaciones: 'Registrar observaciones y resoluciones', liberar_compuertas: 'Liberar compuertas',
};

/** Configuración vigente, en solo lectura. Las reglas, umbrales y permisos viven en el dominio; aún no se editan desde la interfaz. */
export function Configuracion() {
  const { usuario, fuente } = useFuenteDatos();
  const [tab, setTab] = useState('reglas');
  const [requisitos, setRequisitos] = useState<RequisitoDocumental[] | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [guardandoModo, setGuardandoModo] = useState<string | null>(null);
  const bloqueo = CONFIGURACION_BLOQUEO_POR_DEFECTO;
  useEffect(() => { void catalogoRepositorio.listarAdministrativo().then(setRequisitos).catch((e: unknown) => setErrorCatalogo(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.')); }, []);

  async function configurarModo(id: string, modo: RevisionDigital) {
    setGuardandoModo(id);
    setErrorCatalogo(null);
    try {
      const r = await fetch('/api/admin/revision/catalogo/' + encodeURIComponent(id), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kairovolt' }, body: JSON.stringify({ modo }),
      });
      if (!r.ok) throw new Error('No se pudo guardar la modalidad de revisión digital.');
      catalogoRepositorio.invalidar();
      setRequisitos((items) => items?.map((item) => item.id === id ? { ...item, revisionDigital: modo } : item) ?? null);
    } catch (e) { setErrorCatalogo(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setGuardandoModo(null); }
  }

  return (
    <>
      <PageHeader titulo="Configuración" meta="Valores vigentes del sistema. Los marcados «supuesto» son propuestas por confirmar con IDC, no requisitos de CFE." acciones={puede(usuario?.rol, 'gestionar_usuarios') && <Link to="/usuarios" className="kv-btn kv-btn--secundario kv-btn--sm">Gestionar usuarios</Link>} />
      <AlertPanel tono="info" variante="en-linea">IDC puede ajustar la modalidad de revisión por requisito. Las reglas, los permisos y los umbrales se configuran en el dominio.</AlertPanel>
      <Tabs tabs={TABS} activa={tab} onCambiar={setTab} etiqueta="Secciones de configuración">
        {tab === 'reglas' && (
          <div className="kv-tabla-scroll">
            <table aria-label="Catálogo de reglas">
              <thead><tr><th scope="col">Regla</th><th scope="col">Qué comprueba</th><th scope="col">Severidad</th><th scope="col">Decisión humana</th><th scope="col">Origen de los valores</th></tr></thead>
              <tbody>
                {CATALOGO_REGLAS.map((r) => (
                  <tr key={r.id}>
                    <td className="kv-nowrap"><span className="kv-mono">{r.id}</span>{!r.activa && <StatusBadge>Inactiva</StatusBadge>}<span className="kv-doc__detalle">{r.nombre}</span></td>
                    <td>{r.descripcion}</td>
                    <td><StatusBadge tono={TONO_SEV[r.severidad]}>{r.severidad}</StatusBadge></td>
                    <td>{r.requiereAprobacionHumana ? 'Sí' : 'No'}</td>
                    <td>{r.supuesto ? <StatusBadge tono="alerta" variante="suave">Supuesto por confirmar</StatusBadge> : <StatusBadge tono="ok" variante="suave">Definido</StatusBadge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'requisitos' && errorCatalogo && <AlertPanel tono="error" titulo="Catálogo no disponible">{errorCatalogo}</AlertPanel>}
        {tab === 'requisitos' && !requisitos && !errorCatalogo && <p role="status">Cargando catálogo documental…</p>}
        {tab === 'requisitos' && requisitos && ORDEN_COMPUERTAS.map((g) => (
          <section key={g} aria-label={`Requisitos de ${g}`} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px' }}>{g} · {NOMBRE_COMPUERTA[g]}</h3>
            <div className="kv-tabla-scroll">
              <table aria-label={`Requisitos de ${g}`}>
                <thead><tr><th scope="col">Documento / código</th><th scope="col">Etapa / categoría</th><th scope="col">Canal / obligación</th><th scope="col">Vigencia / aportante</th><th scope="col">IDC</th></tr></thead>
                <tbody>
                  {requisitos.filter((r) => r.compuerta === g).map((r) => (
                    <tr key={r.codigo}>
                      <td>{r.nombre}<div className="kv-doc__detalle">{r.codigo}{!r.activo && ' · Inactivo'}</div><details><summary>Ver guía y campos</summary><div className="kv-doc__detalle">{r.descripcion && <p>{r.descripcion}</p>}{r.condicion && <p>Condición: {r.condicion}</p>}{r.instruccionesCliente && <p>{r.instruccionesCliente}</p>}{r.camposEsperados.length > 0 && <p>Campos: {r.camposEsperados.join(' · ')}</p>}{r.ejemplosAutorizados.length > 0 && <p>Ejemplos autorizados: {r.ejemplosAutorizados.join(' · ')}</p>}<p>{r.generacionAutomatica ? 'Generación automática habilitada' : 'Sin generación automática'}</p></div></details></td>
                      <td>{r.compuerta ?? 'Pendiente de mapeo'} · {r.categoria}</td>
                      <td>{r.canal === 'fisico' ? 'Físico / firma' : 'Digital'} · {r.obligatorio ? 'Obligatorio' : `Condicional: ${r.condicion ?? 'por definir'}`}
                        {r.activo && r.aportaCliente && fuente === 'zoho' && puede(usuario?.rol, 'gestionar_portal') &&
                          <label className="kv-campo">Revisión digital
                            <select value={r.revisionDigital ?? 'opcional'} disabled={guardandoModo !== null}
                              onChange={(e) => void configurarModo(r.id, e.target.value as RevisionDigital)}>
                              <option value="opcional">Opcional</option><option value="obligatoria">Obligatoria</option><option value="no_disponible">No disponible</option>
                            </select>
                          </label>}
                      </td>
                      <td>{r.requiereVigencia ? 'Requiere vigencia' : 'Sin vigencia declarada'} · {r.quienAporta}</td>
                      <td><StatusBadge tono={r.validacionIdc === 'validado' ? 'ok' : 'alerta'}>{r.validacionIdc === 'validado' ? 'Validado' : 'Pendiente'}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {tab === 'requisitos' && requisitos && requisitos.some((r) => r.compuerta === null) && <section aria-label="Requisitos pendientes de mapeo"><h3>Pendientes de mapeo a checklist</h3><p className="kv-suave">Estos registros históricos se conservan, pero IDC debe validar su equivalencia antes de incorporarlos al motor de reglas.</p><ul>{requisitos.filter((r) => r.compuerta === null).map((r) => <li key={r.codigo}>{r.codigo} · {r.nombre} · Pendiente IDC</li>)}</ul></section>}
        {tab === 'permisos' && (
          <div className="kv-tabla-scroll">
            <table aria-label="Matriz de permisos">
              <thead><tr><th scope="col">Acción</th>{ROLES_USUARIO.map((r) => <th key={r.valor} scope="col">{r.etiqueta}</th>)}</tr></thead>
              <tbody>
                {Object.entries(PERMISOS).map(([accion, roles]) => (
                  <tr key={accion}>
                    <th scope="row">{ACCIONES_ETIQUETA[accion] ?? accion}</th>
                    {ROLES_USUARIO.map((r) => <td key={r.valor}>{(roles as readonly string[]).includes(r.valor) ? <StatusBadge tono="ok" variante="suave">Sí</StatusBadge> : <span className="kv-suave">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="kv-suave">La matriz es la misma que exige el servidor en cada petición; ocultar un botón en pantalla no es seguridad. Algunas filas son supuestos por confirmar con IDC.</p>
          </div>
        )}
        {tab === 'parametros' && (
          <dl className="kv-dato" style={{ gridTemplateColumns: '260px minmax(0, 1fr)' }}>
            <dt>Meta PAER</dt><dd>Mayor a {META_PAER_PORCENTAJE}% por sesión semanal</dd>
            <dt>Compuertas con validaciones bloqueantes</dt><dd>{bloqueo.compuertasConValidaciones.join(', ')} (filtro anti-reingresos)</dd>
            <dt>Orígenes que bloquean su compuerta</dt><dd>{bloqueo.origenesQueBloquean.map((o) => o.toUpperCase()).join(', ')}</dd>
            <dt>Dictamen UVIE antes del ingreso</dt><dd>{CONFIGURACION_ZONA_POR_DEFECTO.uvieAntesDeIngreso ? 'Sí (se exige en G2)' : 'No (se exige en G3)'} <StatusBadge tono="alerta" variante="suave">Por zona, por confirmar</StatusBadge></dd>
            <dt>Aviso por falta de movimiento</dt><dd>{UMBRAL_SIN_MOVIMIENTO_DIAS} días sin que termine un hito <StatusBadge tono="alerta" variante="suave">Supuesto</StatusBadge></dd>
            <dt>Tramos de tiempo que se miden</dt><dd>{PARES_POR_DEFECTO.map((p) => p.etiqueta).join(' · ')}</dd>
          </dl>
        )}
      </Tabs>
    </>
  );
}
