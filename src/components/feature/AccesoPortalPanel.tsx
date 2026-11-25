import { useCallback, useEffect, useState } from 'react';
import { portalAdminHttp, type AccesoCreado, type ListaAccesos } from '@/infrastructure/portal-admin-http';
import { useConfirmacion } from '@/hooks/useConfirmacion';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';
import { LoadingState } from '@/components/ui/Estados';
import { StatusBadge } from '@/components/ui/StatusBadge';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado.');
const dia = (iso: string) => iso.slice(0, 10);

/**
 * Accesos del cliente a su portal (personal con permiso `gestionar_portal`). Genera un código por acceso; el código en claro se
 * muestra UNA sola vez (el servidor solo guarda su huella) y se puede revocar en cualquier momento.
 */
export function AccesoPortalPanel({ folio }: { folio: string }) {
  const [lista, setLista] = useState<ListaAccesos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState(90);
  const [subir, setSubir] = useState(true);
  const [creando, setCreando] = useState(false);
  const [creado, setCreado] = useState<AccesoCreado | null>(null);
  const [copiado, setCopiado] = useState<'codigo' | 'enlace' | null>(null);
  const { confirmar, modal } = useConfirmacion();

  const cargar = useCallback(async () => {
    try { setLista(await portalAdminHttp.listar(folio)); setError(null); } catch (e) { setError(msg(e)); }
  }, [folio]);
  useEffect(() => { void cargar(); }, [cargar]);

  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      setCreado(await portalAdminHttp.crear(folio, dias, { subir_documentos: subir }));
      await cargar();
    } catch (e) {
      setError(msg(e));
    } finally {
      setCreando(false);
    }
  };

  const revocar = async (id: string) => {
    if (!(await confirmar({ titulo: 'Revocar acceso', mensaje: 'El cliente que use este código perderá el acceso de inmediato, incluso con la sesión abierta.', confirmarTexto: 'Revocar', tono: 'error' }))) return;
    try { await portalAdminHttp.revocar(id); await cargar(); } catch (e) { setError(msg(e)); }
  };

  const copiar = async (texto: string, que: 'codigo' | 'enlace') => {
    try { await navigator.clipboard.writeText(texto); setCopiado(que); setTimeout(() => setCopiado(null), 2000); } catch { /* sin permiso del portapapeles: se puede copiar a mano */ }
  };

  return (
    <section aria-label="Acceso del cliente al portal">
      {modal}
      <p className="kv-suave" style={{ marginTop: 0 }}>El cliente entra al portal con el folio <span className="kv-mono">{folio}</span> y un código. Solo ve su avance, sus documentos pedidos, avisos y un historial público.</p>
      {lista?.demo && <p className="kv-demo">Modo demostración: los accesos viven en memoria y se pierden al reiniciar el servidor.</p>}
      {lista && !lista.demo && lista.persistencia === 'memoria' && <AlertPanel tono="alerta" variante="en-linea">Sin Supabase, los accesos solo viven en memoria: se pierden al reiniciar el servidor.</AlertPanel>}
      {error && <AlertPanel tono="error" onCerrar={() => setError(null)}>{error}</AlertPanel>}

      <div className="kv-filtros">
        <div className="kv-campo"><label htmlFor="ap-d">Vigencia</label><select id="ap-d" value={dias} onChange={(e) => setDias(Number(e.target.value))}>{[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} días</option>)}</select></div>
        <label><input type="checkbox" checked={subir} onChange={(e) => setSubir(e.target.checked)} /> Puede subir documentos</label>
        <Boton variante="primario" cargando={creando} onClick={() => void crear()}>Generar acceso</Boton>
      </div>

      {!lista && !error && <LoadingState variante="linea" etiqueta="Cargando accesos…" />}
      {lista && lista.accesos.length === 0 && <p className="kv-suave">Este proyecto no tiene accesos vigentes.</p>}
      {lista && lista.accesos.length > 0 && (
        <div className="kv-tabla-scroll">
          <table aria-label="Accesos vigentes">
            <thead><tr><th scope="col">Creado</th><th scope="col">Vence</th><th scope="col">Último uso</th><th scope="col">Permisos</th><th scope="col"><span className="kv-solo-lectores">Acciones</span></th></tr></thead>
            <tbody>
              {lista.accesos.map((a) => (
                <tr key={a.id}>
                  <td className="kv-mono">{dia(a.creadoEn)}</td><td className="kv-mono">{dia(a.expiraEn)}</td><td className="kv-mono">{a.ultimoUso ? dia(a.ultimoUso) : '—'}</td>
                  <td>{a.permisos.subir_documentos ? <StatusBadge tono="ok" variante="suave">Puede subir</StatusBadge> : <StatusBadge>Solo lectura</StatusBadge>}</td>
                  <td><Boton tamano="sm" variante="peligro" onClick={() => void revocar(a.id)}>Revocar</Boton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={creado !== null} titulo="Acceso creado" onCerrar={() => setCreado(null)} pie={<Boton variante="primario" onClick={() => setCreado(null)}>Listo</Boton>}>
        {creado && (
          <>
            <AlertPanel tono="alerta" variante="en-linea" titulo="Cópialo ahora">Este código no se vuelve a mostrar: el servidor solo guarda su huella. Si se pierde, genera otro y revoca este.</AlertPanel>
            <div className="kv-campo"><span className="kv-campo__etiqueta">Código de acceso</span><p className="kv-mono" style={{ fontSize: 22, margin: 0, userSelect: 'all' }}>{creado.codigo}</p><Boton tamano="sm" onClick={() => void copiar(creado.codigo, 'codigo')}>{copiado === 'codigo' ? 'Copiado' : 'Copiar código'}</Boton></div>
            <div className="kv-campo"><span className="kv-campo__etiqueta">Enlace directo</span><p className="kv-mono" style={{ fontSize: 12, margin: 0, overflowWrap: 'anywhere', userSelect: 'all' }}>{creado.enlace}</p><Boton tamano="sm" onClick={() => void copiar(creado.enlace, 'enlace')}>{copiado === 'enlace' ? 'Copiado' : 'Copiar enlace'}</Boton><span className="kv-campo__ayuda">El código va después del «#»: no se envía a ningún servidor ni queda en bitácoras. Vence el <span className="kv-mono">{dia(creado.acceso.expiraEn)}</span>.</span></div>
          </>
        )}
      </Dialogo>
    </section>
  );
}
