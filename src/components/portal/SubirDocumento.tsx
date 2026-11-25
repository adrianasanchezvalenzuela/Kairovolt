import { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { ErrorPortal, type ResultadoSubida } from '@/application/portal-acceso';
import type { DocumentoSolicitado } from '@/application/portal-cliente';
import { clasificarArchivos } from '@/components/feature/DocumentUploader';
import { AlertPanel } from '@/components/ui/AlertPanel';
import { FORMATOS_SUBIDA, MAX_BYTES_SUBIDA } from './estados';

export interface SubirDocumentoProps {
  documento: DocumentoSolicitado;
  onSubir: (documentoId: string, archivo: File, onProgreso: (p: number) => void) => Promise<ResultadoSubida>;
  /** false = demo: el archivo se registra pero no se conserva. */
  conservaArchivos: boolean;
}

type Fase = { tipo: 'libre' } | { tipo: 'subiendo'; nombre: string; peso: string; progreso: number } | { tipo: 'listo'; recibo: string; nombre: string } | { tipo: 'error'; mensaje: string };

/**
 * Botón grande para elegir (o fotografiar) un archivo y enviarlo. Muestra progreso real, confirmación con el acuse de recibo y
 * errores claros. La validación del navegador es solo una ayuda: el servidor vuelve a validar el contenido de todo archivo.
 */
export function SubirDocumento({ documento, onSubir, conservaArchivos }: SubirDocumentoProps) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>({ tipo: 'libre' });

  const elegir = async (lista: FileList | null) => {
    const archivo = lista?.[0];
    if (entrada.current) entrada.current.value = '';
    if (!archivo || fase.tipo === 'subiendo') return;
    const { aceptados, rechazados } = clasificarArchivos([archivo], { aceptar: FORMATOS_SUBIDA, maxBytes: MAX_BYTES_SUBIDA });
    if (aceptados.length === 0) {
      const motivo = rechazados[0]?.motivo ?? '';
      setFase({ tipo: 'error', mensaje: motivo.startsWith('supera') ? 'El archivo pesa más de 10 MB. Elige uno más ligero.' : motivo.startsWith('tipo') ? 'Solo se aceptan archivos PDF, JPG, PNG o WEBP.' : 'El archivo está vacío.' });
      return;
    }
    const peso = archivo.size < 1024 * 1024 ? Math.max(1, Math.round(archivo.size / 1024)) + ' KB' : (archivo.size / (1024 * 1024)).toFixed(1) + ' MB';
    setFase({ tipo: 'subiendo', nombre: archivo.name, peso, progreso: 0 });
    try {
      const r = await onSubir(documento.id, archivo, (progreso) => setFase({ tipo: 'subiendo', nombre: archivo.name, peso, progreso }));
      setFase({ tipo: 'listo', recibo: r.recepcion.recibo, nombre: r.recepcion.archivo });
    } catch (e) {
      setFase({ tipo: 'error', mensaje: e instanceof ErrorPortal ? e.message : 'No se pudo enviar el archivo. Intenta de nuevo.' });
    }
  };

  if (fase.tipo === 'listo') {
    return (
      <div className="kvp-subir" role="status">
        <AlertPanel tono="ok" titulo="¡Recibido!">
          Recibimos «{fase.nombre}». Tu acuse de recibo es <strong className="kvp-recibo__acuse">{fase.recibo}</strong>.
          {!conservaArchivos && <> <em>(Modo demostración: el archivo no se conserva.)</em></>}
        </AlertPanel>
      </div>
    );
  }

  const subiendo = fase.tipo === 'subiendo';
  return (
    <div className="kvp-subir kv-cliente-carga-archivo" onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
      e.preventDefault();
      void elegir(e.dataTransfer.files);
    }}>
      <UploadCloud size={27} aria-hidden="true" />
      <label htmlFor={id} className={`kvp-boton${documento.estado === 'pendiente' ? '' : ' kvp-boton--suave'}`} aria-disabled={subiendo || undefined}>
        {subiendo ? 'Enviando…' : documento.estado === 'rechazado' || documento.estado === 'vencido' ? 'Enviar de nuevo' : 'Subir archivo'}
        <span className="kv-solo-lectores"> para {documento.nombre}</span>
      </label>
      <input ref={entrada} id={id} type="file" accept={FORMATOS_SUBIDA.join(',')} disabled={subiendo} onChange={(e) => void elegir(e.target.files)} />
      {subiendo && (
        <div role="progressbar" aria-label={`Enviando ${fase.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fase.progreso}>
          <div className="kvp-barra"><div style={{ width: `${fase.progreso}%` }} /></div>
          <p className="kvp-ayuda">{fase.progreso}% · {fase.nombre} · {fase.peso}</p>
        </div>
      )}
      {fase.tipo === 'error' && <AlertPanel tono="error" onCerrar={() => setFase({ tipo: 'libre' })}>{fase.mensaje}</AlertPanel>}
      {fase.tipo === 'libre' && <p className="kvp-ayuda"><span className="kv-cliente-arrastrar">Puedes arrastrar el archivo aquí. </span>PDF, JPG, PNG o WEBP · máximo 10 MB.</p>}
    </div>
  );
}
