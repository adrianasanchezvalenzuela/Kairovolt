import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';

export interface DialogoProps {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Botones al pie (el formulario puede llevar su propio botón de envío y usar `form="id"`). */
  pie?: ReactNode;
  /** `derecha` = panel lateral de altura completa; `centro` = ventana modal. */
  posicion?: 'centro' | 'derecha';
  /** Mientras es `true` no se puede cerrar con Esc ni haciendo clic fuera. */
  ocupado?: boolean;
}

/** Ventana con contenido libre (formularios, vista de evidencia). Para confirmar acciones simples usa `ConfirmationModal`. */
export function Dialogo({ abierto, titulo, onCerrar, children, pie, posicion = 'centro', ocupado = false }: DialogoProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || typeof d.showModal !== 'function') return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref} className={cx('kv-dialogo', posicion === 'derecha' && 'kv-dialogo--derecha')} aria-labelledby={idTitulo}
      onCancel={(e) => { e.preventDefault(); if (!ocupado) onCerrar(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}
    >
      {abierto && (
        <>
          <header className="kv-dialogo__cab">
            <h2 id={idTitulo} className="kv-dialogo__titulo">{titulo}</h2>
            <button type="button" className="kv-alerta__cerrar" onClick={onCerrar} disabled={ocupado} aria-label="Cerrar">×</button>
          </header>
          <div className="kv-dialogo__cuerpo">{children}</div>
          {pie && <footer className="kv-dialogo__pie">{pie}</footer>}
        </>
      )}
    </dialog>
  );
}
