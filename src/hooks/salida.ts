/** Aviso antes de abandonar un formulario con cambios sin enviar (lo usa el logo que regresa al inicio público). */
let sucio = false;
export const marcarFormularioSucio = (valor: boolean) => { sucio = valor; };
export function confirmarSalida(): boolean {
  return !sucio || window.confirm('Tienes información sin enviar. Si sales ahora, se perderá. ¿Quieres volver al inicio?');
}
