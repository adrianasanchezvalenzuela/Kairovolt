import { ExternalLink, FileDown } from 'lucide-react';
import type { Recepcion } from '@/application/portal-cliente';
import { archivoPortalUrl } from '@/infrastructure/portal-http';

export function VistaArchivoPortal({ recepcion }: { recepcion: Recepcion }) {
  if (!recepcion.mime) return <p className="kv-suave">Esta versión no tiene una vista previa digital disponible.</p>;
  const src = archivoPortalUrl(recepcion.recibo);
  return <div className="kv-doc-archivo">
    {recepcion.mime.startsWith('image/') ? <img src={src} alt={'Vista de ' + recepcion.archivo} />
      : <iframe title={'Vista previa de ' + recepcion.archivo} src={src} />}
    <div className="kv-doc-archivo__acciones">
      <a href={src} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> Ampliar</a>
      <a href={archivoPortalUrl(recepcion.recibo, true)} download><FileDown size={15} aria-hidden="true" /> Descargar</a>
    </div>
  </div>;
}
