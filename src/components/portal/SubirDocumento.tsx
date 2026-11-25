import { useId, useRef, useState } from 'react';
import { Camera, UploadCloud } from 'lucide-react';
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
  /** Permite seleccionar varias imágenes/archivos en una sola acción (p. ej. fotos del sistema). */
  multiple?: boolean;
  /** Muestra botón directo para usar la cámara en dispositivos móviles compatibles. */
  capturaCamara?: boolean;
}

type Fase =
  | { tipo: 'libre' }
  | { tipo: 'subiendo'; nombre: string; peso: string; progreso: number; indice: number; total: number }
  | { tipo: 'listo'; recibos: { recibo: string; nombre: string }[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Botón grande para elegir (o fotografiar) uno o varios archivos y enviarlos.
 * La validación del navegador es solo una ayuda: el servidor vuelve a validar el contenido de todo archivo.
 */
export function SubirDocumento({ documento, onSubir, conservaArchivos, multiple = false, capturaCamara = false }: SubirDocumentoProps) {
  const id = useId();
  const idCamara = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const entradaCamara = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>({ tipo: 'libre' });

  const elegir = async (lista: FileList | null) => {
    const seleccionados = lista ? Array.from(lista).slice(0, multiple ? 8 : 1) : [];
    if (entrada.current) entrada.current.value = '';
    if (entradaCamara.current) entradaCamara.current.value = '';
    if (seleccionados.length === 0 || fase.tipo === 'subiendo') return;

    const { aceptados, rechazados } = clasificarArchivos(seleccionados, { aceptar: FORMATOS_SUBIDA, maxBytes: MAX_BYTES_SUBIDA });
    if (aceptados.length === 0) {
      const motivo = rechazados[0]?.motivo ?? '';
      setFase({
        tipo: 'error',
        mensaje: motivo.startsWith('supera')
          ? 'El archivo pesa más de 10 MB. Elige uno más ligero.'
          : motivo.startsWith('tipo')
            ? 'Solo se aceptan archivos PDF, JPG, PNG o WEBP.'
            : 'El archivo está vacío.',
      });
      return;
    }

    const recibos: { recibo: string; nombre: string }[] = [];
    for (let i = 0; i < aceptados.length; i++) {
      const archivo = aceptados[i]!;
      const peso =
        archivo.size < 1024 * 1024
          ? Math.max(1, Math.round(archivo.size / 1024)) + ' KB'
          : (archivo.size / (1024 * 1024)).toFixed(1) + ' MB';
      setFase({ tipo: 'subiendo', nombre: archivo.name, peso, progreso: 0, indice: i + 1, total: aceptados.length });
      try {
        const r = await onSubir(documento.id, archivo, (progreso) =>
          setFase({ tipo: 'subiendo', nombre: archivo.name, peso, progreso, indice: i + 1, total: aceptados.length }),
        );
        recibos.push({ recibo: r.recepcion.recibo, nombre: r.recepcion.archivo });
      } catch (e) {
        setFase({ tipo: 'error', mensaje: e instanceof ErrorPortal ? e.message : 'No se pudo enviar el archivo. Intenta de nuevo.' });
        return;
      }
    }
    setFase({ tipo: 'listo', recibos });
  };

  if (fase.tipo === 'listo') {
    return (
      <div className="kvp-subir" role="status">
        <AlertPanel tono="ok" titulo={fase.recibos.length > 1 ? `¡Recibimos ${fase.recibos.length} archivos!` : '¡Recibido!'}>
          {fase.recibos.map((item) => (
            <div key={item.recibo}>
              Recibimos «{item.nombre}». Tu acuse de recibo es <strong className="kvp-recibo__acuse">{item.recibo}</strong>.
            </div>
          ))}
          {!conservaArchivos && <> <em>(Modo demostración: el archivo no se conserva.)</em></>}
        </AlertPanel>
        {multiple && (
          <button type="button" className="kvp-boton kvp-boton--suave" style={{ marginTop: 8 }} onClick={() => setFase({ tipo: 'libre' })}>
            Agregar más fotografías
          </button>
        )}
      </div>
    );
  }

  const subiendo = fase.tipo === 'subiendo';
  const textoBoton = subiendo
    ? 'Enviando…'
    : documento.estado === 'rechazado' || documento.estado === 'vencido'
      ? 'Enviar de nuevo'
      : multiple
        ? 'Seleccionar fotografías'
        : 'Subir archivo';

  return (
    <div
      className="kvp-subir kv-cliente-carga-archivo"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void elegir(e.dataTransfer.files);
      }}
    >
      <UploadCloud size={27} aria-hidden="true" />
      <div className="kvp-subir__controles">
        <label htmlFor={id} className={`kvp-boton${documento.estado === 'pendiente' ? '' : ' kvp-boton--suave'}`} aria-disabled={subiendo || undefined}>
          {textoBoton}
          <span className="kv-solo-lectores"> para {documento.nombre}</span>
        </label>
        {capturaCamara && (
          <label htmlFor={idCamara} className="kvp-boton kvp-boton--suave" aria-disabled={subiendo || undefined}>
            <Camera size={17} aria-hidden="true" /> Tomar fotografía
            <span className="kv-solo-lectores"> con cámara para {documento.nombre}</span>
          </label>
        )}
      </div>
      <input
        ref={entrada}
        id={id}
        type="file"
        accept={FORMATOS_SUBIDA.join(',')}
        multiple={multiple}
        disabled={subiendo}
        onChange={(e) => void elegir(e.target.files)}
      />
      {capturaCamara && (
        <input
          ref={entradaCamara}
          id={idCamara}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={subiendo}
          onChange={(e) => void elegir(e.target.files)}
        />
      )}
      {subiendo && (
        <div role="progressbar" aria-label={`Enviando ${fase.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fase.progreso}>
          <div className="kvp-barra"><div style={{ width: `${fase.progreso}%` }} /></div>
          <p className="kvp-ayuda">
            {fase.total > 1 ? `Archivo ${fase.indice} de ${fase.total} · ` : ''}
            {fase.progreso}% · {fase.nombre} · {fase.peso}
          </p>
        </div>
      )}
      {fase.tipo === 'error' && <AlertPanel tono="error" onCerrar={() => setFase({ tipo: 'libre' })}>{fase.mensaje}</AlertPanel>}
      {fase.tipo === 'libre' && (
        <p className="kvp-ayuda">
          <span className="kv-cliente-arrastrar">Puedes arrastrar {multiple ? 'las fotografías' : 'el archivo'} aquí. </span>
          PDF, JPG, PNG o WEBP · máximo 10 MB{multiple ? ' por archivo' : ''}.
        </p>
      )}
    </div>
  );
}
