import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tareasDeCompuertas, type EstadoIntegracionAdmin, type RegistroSincronizacion, type ResultadoSimulacion } from '@/application/integracion-admin';
import { puede } from '@/domain/usuarios/permisos';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { useCartera } from '@/hooks/useExpediente';
import { integracionAdminRepositorio } from '@/infrastructure';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { EmptyState, LoadingState } from '@/components/ui/Estados';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

const ESTADO_ZOHO = { conectado: { t: 'Autenticación verificada', tono: 'ok' }, no_configurado: { t: 'No conectado (faltan credenciales)', tono: 'alerta' }, error: { t: 'Error de conexión', tono: 'error' }, backend_no_disponible: { t: 'Backend no disponible', tono: 'alerta' } } as const;
const TONO_PASO = { ok: 'ok', error: 'error', omitido: 'neutro' } as const;
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado.');

export function Integraciones() {
  const { integracion, sesion, usuario, fuente } = useFuenteDatos();
  const { items } = useCartera();
  const autorizado = puede(usuario?.rol, 'sincronizar_zoho');
  const [admin, setAdmin] = useState<EstadoIntegracionAdmin | null>(null);
  const [registro, setRegistro] = useState<RegistroSincronizacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folio, setFolio] = useState('');
  const [simulando, setSimulando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [e, r] = await Promise.all([integracionAdminRepositorio.estado(), integracionAdminRepositorio.registro()]);
      setAdmin(e);
      setRegistro(r);
    } catch (e) {
      setError(msg(e));
    }
  }, []);
  useEffect(() => { if (autorizado) void cargar(); }, [autorizado, cargar]);

  const elegido = items?.find((i) => i.proyecto.folio === folio) ?? items?.[0];
  const zoho = ESTADO_ZOHO[integracion.zoho];

  const simular = async () => {
    if (!elegido) return;
    setSimulando(true);
    setError(null);
    setResultado(null);
    try {
      const p = elegido.proyecto;
      setResultado(await integracionAdminRepositorio.simular({ folio: p.folio, nombre: p.nombre, tareas: tareasDeCompuertas(p), subcarpetas: ['G0', 'G1', 'G2', 'G3'] }));
      await cargar();
    } catch (e) {
      setError(msg(e));
    } finally {
      setSimulando(false);
    }
  };

  return (
    <>
      <PageHeader titulo="Integraciones" meta="Estado real de la conexión con Zoho CRM, Projects y WorkDrive." />

      <section aria-label="Estado de Zoho">
        <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge tono={zoho.tono} variante="suave" tamano="md">Zoho: {zoho.t}</StatusBadge>
          <StatusBadge tono={fuente === 'zoho' ? 'ok' : 'alerta'} variante="suave" tamano="md">{fuente === 'zoho' ? 'La plataforma muestra datos reales' : 'La plataforma muestra datos MOCK'}</StatusBadge>
        </p>
        <p className="kv-suave">{integracion.detalle}</p>
      </section>

      {!sesion.autenticado && <AlertPanel tono="info" titulo="Inicia sesión">El detalle de la integración y su bitácora requieren una sesión. <Link to="/acceso">Iniciar sesión</Link></AlertPanel>}
      {sesion.autenticado && !autorizado && <AlertPanel tono="alerta" titulo="Sin permiso">Tu rol no puede consultar la bitácora de sincronización.</AlertPanel>}
      {error && <AlertPanel tono="error" onCerrar={() => setError(null)}>{error}</AlertPanel>}

      {autorizado && (
        <>
          {!admin && !error && <LoadingState etiqueta="Consultando la integración…" />}
          {admin && (
            <>
              <h2>Adaptadores</h2>
              <AlertPanel tono={admin.modo === 'real' ? 'ok' : 'alerta'} titulo={admin.etiqueta}>
                {admin.modo === 'demo' ? 'Sin credenciales de Zoho se usan adaptadores en memoria: no se llama a Zoho ni se finge haberlo hecho.' : 'Autenticación OAuth 2.0 en el servidor; el navegador nunca ve tokens de Zoho.'}
              </AlertPanel>
              <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusBadge tono={admin.servicios.crm ? 'ok' : 'neutro'}>CRM: {admin.servicios.crm ? 'listo' : 'no conectado'}</StatusBadge>
                <StatusBadge tono={admin.servicios.projects ? 'ok' : 'neutro'}>Projects: {admin.servicios.projects ? 'listo' : 'sin portal configurado'}</StatusBadge>
                <StatusBadge tono={admin.servicios.workdrive ? 'ok' : 'neutro'}>WorkDrive: {admin.servicios.workdrive ? 'listo' : 'sin carpeta raíz'}</StatusBadge>
                <StatusBadge tono="info">Bitácora: {admin.persistencia === 'supabase' ? 'Supabase (permanente)' : 'memoria (se pierde al reiniciar)'}</StatusBadge>
              </p>

              <h2>Simular la sincronización de un proyecto</h2>
              <p className="kv-suave">Muestra qué crearía o actualizaría y <strong>no escribe nada</strong>. Con Zoho conectado lee Zoho de verdad; en DEMO no llama a Zoho. Escribir de verdad no se ofrece desde esta pantalla.</p>
              <div className="kv-filtros">
                <div className="kv-campo">
                  <label htmlFor="i-p">Proyecto</label>
                  <select id="i-p" value={elegido?.proyecto.folio ?? ''} onChange={(e) => { setFolio(e.target.value); setResultado(null); }} disabled={!items || items.length === 0}>
                    {(items ?? []).map((i) => <option key={i.proyecto.id} value={i.proyecto.folio}>{i.proyecto.folio} — {i.proyecto.nombre}</option>)}
                  </select>
                </div>
                <Boton variante="primario" cargando={simulando} disabled={!elegido} onClick={() => void simular()}>Simular sincronización</Boton>
              </div>
              {resultado && (
                <>
                  <AlertPanel tono={resultado.ok ? 'ok' : 'alerta'} titulo={`${resultado.folio}: ${resultado.ok ? 'simulación sin errores' : 'la simulación encontró problemas'}`} variante="en-linea">{resultado.etiqueta} · modo {resultado.modo}</AlertPanel>
                  {resultado.advertencias.length > 0 && <AlertPanel tono="alerta" variante="en-linea"><ul style={{ margin: 0, paddingLeft: 18 }}>{resultado.advertencias.map((a) => <li key={a}>{a}</li>)}</ul></AlertPanel>}
                  <div className="kv-tabla-scroll">
                    <table aria-label="Pasos de la simulación">
                      <thead><tr><th scope="col">Destino</th><th scope="col">Operación</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
                      <tbody>
                        {resultado.pasos.map((p) => (
                          <tr key={p.clave}><td>{p.destino}</td><td>{p.operacion}</td><td><StatusBadge tono={TONO_PASO[p.estado]}>{p.accion ?? p.estado}</StatusBadge></td><td className="kv-suave">{p.error ?? ''}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <h2>Bitácora de sincronización</h2>
          {registro === null
            ? null
            : registro.length === 0
              ? <EmptyState compacto titulo="Sin registros" descripcion="Todavía no se ha ejecutado ningún paso de sincronización." />
              : (
                <div className="kv-tabla-scroll">
                  <table aria-label="Bitácora de sincronización">
                    <thead><tr><th scope="col">Fecha</th><th scope="col">Folio</th><th scope="col">Destino</th><th scope="col">Operación</th><th scope="col">Resultado</th><th scope="col">Error</th></tr></thead>
                    <tbody>
                      {registro.slice(0, 50).map((r) => (
                        <tr key={r.id}>
                          <td className="kv-mono kv-nowrap">{r.creadoEn.slice(0, 19).replace('T', ' ')}</td><td className="kv-mono">{r.folio}</td><td>{r.destino}</td><td>{r.operacion}</td>
                          <td><StatusBadge tono={TONO_PASO[r.estado]}>{r.accion ?? r.estado}</StatusBadge></td><td className="kv-suave">{r.error ? `${r.categoriaError ?? ''} ${r.error}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
        </>
      )}
    </>
  );
}
