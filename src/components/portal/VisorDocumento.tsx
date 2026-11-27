import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import type { ArchivoDemo } from '@/demo/archivos-demo';
import { LEYENDA_DEMO } from '@/demo/expediente-demo';

export interface DatosVisor {
  titulo: string; estado: string; responsable: string; version?: number; cargadoEn?: string; validadoEn?: string; archivos: ArchivoDemo[];
}
const fecha = (iso?: string) => iso ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Hermosillo' }).format(new Date(iso)) : '—';

/** Cuenta las páginas de un PDF local (si no es PDF, es una imagen de una página). */
function usePaginas(ruta: string, conocidas?: number): number {
  const [n, setN] = useState(conocidas ?? 1);
  useEffect(() => {
    let vivo = true;
    if (!/\.pdf$/i.test(ruta) && !ruta.startsWith('blob:')) return;
    void fetch(ruta).then((r) => r.arrayBuffer()).then((b) => PDFDocument.load(b, { ignoreEncryption: true })).then((d) => { if (vivo) setN(d.getPageCount()); }).catch(() => { if (vivo) setN(1); });
    return () => { vivo = false; };
  }, [ruta]);
  return n;
}

/** Vista previa real (archivo local de demostración) con navegación de páginas, descarga y ampliación. */
export function VistaArchivo({ archivo, alto = 340, ampliado = false }: { archivo: ArchivoDemo; alto?: number; ampliado?: boolean }) {
  const total = usePaginas(archivo.ruta, archivo.paginas?.length);
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [archivo.ruta]);
  const esImagen = /\.(png|jpe?g|webp)$/i.test(archivo.ruta);
  const src = archivo.ruta + (esImagen || archivo.ruta.startsWith('blob:') ? '' : `#page=${pagina}&toolbar=0&navpanes=0&view=FitH`);
  return <div className="kv-vd__vista">
    {esImagen ? <img src={archivo.ruta} alt={archivo.etiqueta} /> : <iframe key={archivo.ruta + pagina} title={`Vista previa: ${archivo.etiqueta}, página ${pagina}`} src={src} style={{ height: ampliado ? '100%' : alto }} />}
    {total > 1 && <div className="kv-vd__paginas" role="group" aria-label="Páginas del documento">
      <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior"><ChevronLeft size={16} aria-hidden="true" /></button>
      {archivo.paginas?.length === total
        ? archivo.paginas.map((e, i) => <button key={e} type="button" className={pagina === i + 1 ? 'on' : ''} onClick={() => setPagina(i + 1)}>{e}</button>)
        : <span>Página {pagina} de {total}</span>}
      <button type="button" disabled={pagina >= total} onClick={() => setPagina((p) => p + 1)} aria-label="Página siguiente"><ChevronRight size={16} aria-hidden="true" /></button>
    </div>}
  </div>;
}

/** Visor integrado del portal: nombre, vista previa, estado, fechas, responsable, versión, descarga, ampliar y cerrar. */
export function VisorDocumento({ datos, onCerrar }: { datos: DatosVisor; onCerrar: () => void }) {
  const [activo, setActivo] = useState(0);
  const [ampliado, setAmpliado] = useState(false);
  const archivo = datos.archivos[activo] ?? datos.archivos[0]!;
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onCerrar]);
  return <div className="kv-vd" role="dialog" aria-modal="true" aria-label={datos.titulo}>
    <button type="button" className="kv-vd__fondo" onClick={onCerrar} aria-label="Cerrar visor" />
    <section className={'kv-vd__hoja' + (ampliado ? ' kv-vd__hoja--amplia' : '')}>
      <header>
        <div><span className="kv-cliente-etiqueta">{datos.estado}</span><h2>{datos.titulo}</h2></div>
        <div className="kv-vd__botones">
          <a className="kvp-boton kvp-boton--suave" href={archivo.ruta} download={archivo.ruta.split('/').pop()}><Download size={16} aria-hidden="true" /> Descargar</a>
          <button type="button" className="kvp-boton kvp-boton--suave" onClick={() => setAmpliado((a) => !a)} aria-pressed={ampliado}>{ampliado ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />} {ampliado ? 'Reducir' : 'Ampliar'}</button>
          <button type="button" className="kvp-boton" onClick={onCerrar}><X size={16} aria-hidden="true" /> Cerrar</button>
        </div>
      </header>
      {datos.archivos.length > 1 && <nav className="kv-vd__archivos" aria-label="Archivos del documento">{datos.archivos.map((a, i) => <button key={a.ruta} type="button" className={i === activo ? 'on' : ''} onClick={() => setActivo(i)}>{a.etiqueta}</button>)}</nav>}
      <div className="kv-vd__cuerpo">
        <VistaArchivo archivo={archivo} alto={ampliado ? 640 : 460} ampliado={ampliado} />
        <dl className="kv-vd__datos">
          <dt>Estado de revisión</dt><dd>{datos.estado}</dd>
          <dt>Aportado por</dt><dd>{datos.responsable}</dd>
          <dt>Versión</dt><dd>{datos.version ? `v${datos.version}` : '—'}</dd>
          <dt>Fecha de carga</dt><dd>{fecha(datos.cargadoEn)}</dd>
          <dt>Fecha de validación</dt><dd>{fecha(datos.validadoEn)}</dd>
          <dt>Archivo</dt><dd className="kv-mono">{archivo.ruta.startsWith('blob:') ? 'archivo elegido en esta sesión' : archivo.ruta.split('/').pop()}</dd>
        </dl>
      </div>
      <footer>{LEYENDA_DEMO}. Archivo de demostración local; no contiene datos reales.</footer>
    </section>
  </div>;
}
