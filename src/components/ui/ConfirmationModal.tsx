import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Boton } from './Boton';
import { claseTono, type Tono } from './tipos';

export interface ConfirmationModalProps {
  abierto: boolean;
  titulo: string;
  children?: ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  /** `error` = acción destructiva (botón rojo); `alerta` = acción con consecuencias externas. */
  tono?: Extract<Tono, 'info' | 'alerta' | 'error'>;
  /** Mientras es `true` no se puede cancelar ni repetir la confirmación. */
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Diálogo modal nativo (`<dialog>`): atrapa el foco, cierra con Esc y devuelve el foco a quien lo abrió.
 * El foco inicial va al botón «Cancelar» para que Enter nunca confirme una acción por accidente.
 */
export function ConfirmationModal({ abierto, titulo, children, confirmarTexto = 'Confirmar', cancelarTexto = 'Cancelar', tono = 'info', ocupado = false, onConfirmar, onCancelar }: ConfirmationModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idTexto = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || typeof d.showModal !== 'function') return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={`kv-modal ${claseTono(tono)}`}
      aria-labelledby={idTitulo}
      aria-describedby={children ? idTexto : undefined}
      onCancel={(e) => { e.preventDefault(); if (!ocupado) onCancelar(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onCancelar(); }}
    >
      <div className="kv-modal__cuerpo">
        <h2 id={idTitulo} className="kv-modal__titulo">{titulo}</h2>
        {children && <div id={idTexto} className="kv-modal__texto">{children}</div>}
      </div>
      <div className="kv-modal__pie">
        <Boton variante="secundario" onClick={onCancelar} disabled={ocupado} autoFocus>{cancelarTexto}</Boton>
        <Boton variante={tono === 'error' ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={ocupado}>{confirmarTexto}</Boton>
      </div>
    </dialog>
  );
}
