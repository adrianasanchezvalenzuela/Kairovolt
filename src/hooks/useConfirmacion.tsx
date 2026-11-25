import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ConfirmationModal, type ConfirmationModalProps } from '@/components/ui/ConfirmationModal';

export type OpcionesConfirmacion = Pick<ConfirmationModalProps, 'titulo' | 'confirmarTexto' | 'cancelarTexto' | 'tono'> & { mensaje?: ReactNode };

/**
 * Sustituye a `window.confirm`: `await confirmar({...})` resuelve `true`/`false`.
 * Hay que renderizar `modal` en algún lugar del componente.
 */
export function useConfirmacion() {
  const [opciones, setOpciones] = useState<OpcionesConfirmacion | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback(
    (o: OpcionesConfirmacion) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // una confirmación pendiente anterior se cancela
        resolver.current = resolve;
        setOpciones(o);
      }),
    [],
  );

  const cerrar = (valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    setOpciones(null);
  };

  const modal = opciones && (
    <ConfirmationModal
      abierto
      titulo={opciones.titulo}
      {...(opciones.confirmarTexto && { confirmarTexto: opciones.confirmarTexto })}
      {...(opciones.cancelarTexto && { cancelarTexto: opciones.cancelarTexto })}
      {...(opciones.tono && { tono: opciones.tono })}
      onConfirmar={() => cerrar(true)}
      onCancelar={() => cerrar(false)}
    >
      {opciones.mensaje}
    </ConfirmationModal>
  );

  return { confirmar, modal };
}
