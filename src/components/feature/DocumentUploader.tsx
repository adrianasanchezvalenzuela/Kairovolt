import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { cx } from '@/components/ui/cx';

export interface RestriccionesArchivo {
  /** Extensiones (`.pdf`) o tipos MIME (`image/png`, `image/*`). Vacío = cualquiera. */
  aceptar?: readonly string[];
  /** Tamaño máximo por archivo, en bytes. */
  maxBytes?: number;
}
export interface ArchivoRechazado { nombre: string; motivo: string }

const mb = (b: number) => `${Math.round((b / 1024 / 1024) * 10) / 10} MB`;

function coincide(archivo: { name: string; type: string }, patron: string): boolean {
  const p = patron.trim().toLowerCase();
  if (p.startsWith('.')) return archivo.name.toLowerCase().endsWith(p);
  if (p.endsWith('/*')) return archivo.type.toLowerCase().startsWith(p.slice(0, -1));
  return archivo.type.toLowerCase() === p;
}

/** Separa los archivos que cumplen las restricciones de los que no (con el motivo). Función pura: no sube nada. */
export function clasificarArchivos<T extends { name: string; type: string; size: number }>(archivos: readonly T[], r: RestriccionesArchivo = {}): { aceptados: T[]; rechazados: ArchivoRechazado[] } {
  const aceptados: T[] = [];
  const rechazados: ArchivoRechazado[] = [];
  for (const a of archivos) {
    if (a.size === 0) rechazados.push({ nombre: a.name, motivo: 'el archivo está vacío' });
    else if (r.aceptar && r.aceptar.length > 0 && !r.aceptar.some((p) => coincide(a, p))) rechazados.push({ nombre: a.name, motivo: `tipo no permitido (se aceptan ${r.aceptar.join(', ')})` });
    else if (r.maxBytes !== undefined && a.size > r.maxBytes) rechazados.push({ nombre: a.name, motivo: `supera el máximo de ${mb(r.maxBytes)}` });
    else aceptados.push(a);
  }
  return { aceptados, rechazados };
}

export interface DocumentUploaderProps extends RestriccionesArchivo {
  /** Recibe SOLO los archivos válidos. Quien lo usa decide cómo y dónde subirlos; este componente no sube nada. */
  onArchivos: (archivos: File[]) => void;
  multiple?: boolean;
  deshabilitado?: boolean;
  etiqueta?: string;
  ayuda?: string;
}

export function DocumentUploader({ onArchivos, aceptar, maxBytes, multiple = false, deshabilitado = false, etiqueta = 'Seleccionar o arrastrar documentos', ayuda }: DocumentUploaderProps) {
  const [arrastrando, setArrastrando] = useState(false);
  const [rechazados, setRechazados] = useState<ArchivoRechazado[]>([]);
  const entrada = useRef<HTMLInputElement>(null);
  const idAyuda = useId();

  const procesar = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const { aceptados, rechazados: malos } = clasificarArchivos(Array.from(lista).slice(0, multiple ? undefined : 1), { ...(aceptar && { aceptar }), ...(maxBytes !== undefined && { maxBytes }) });
    setRechazados(malos);
    if (aceptados.length > 0) onArchivos(aceptados);
    if (entrada.current) entrada.current.value = ''; // permite volver a elegir el mismo archivo
  };

  const soltar = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastrando(false);
    if (!deshabilitado) procesar(e.dataTransfer.files);
  };

  const textoAyuda = ayuda ?? [aceptar && aceptar.length > 0 ? `Permitidos: ${aceptar.join(', ')}` : null, maxBytes !== undefined ? `máximo ${mb(maxBytes)} por archivo` : null].filter(Boolean).join(' · ');

  return (
    <div>
      <label
        className={cx('kv-carga', arrastrando && 'kv-carga--arrastrando', deshabilitado && 'kv-carga--deshabilitada')}
        onDragOver={(e) => { e.preventDefault(); if (!deshabilitado) setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
      >
        <span className="kv-carga__titulo">{etiqueta}</span>
        {textoAyuda && <span className="kv-carga__ayuda" id={idAyuda}>{textoAyuda}</span>}
        <input
          ref={entrada} type="file" className="kv-solo-lectores" multiple={multiple} disabled={deshabilitado}
          {...(aceptar && aceptar.length > 0 && { accept: aceptar.join(',') })}
          aria-describedby={textoAyuda ? idAyuda : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => procesar(e.target.files)}
        />
      </label>
      {rechazados.length > 0 && (
        <ul className="kv-carga__errores" role="alert">
          {rechazados.map((r, i) => <li key={`${i}-${r.nombre}`}><strong>{r.nombre}</strong>: {r.motivo}</li>)}
        </ul>
      )}
    </div>
  );
}
