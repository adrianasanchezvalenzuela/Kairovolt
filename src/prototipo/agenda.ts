export const HORAS = ['09:00', '10:30', '12:00', '13:30', '16:00'];

/** Próximos días hábiles (a partir de mañana), fecha ISO local. */
export function diasHabiles(n = 6): string[] {
  const out: string[] = [];
  const d = new Date(); d.setHours(12, 0, 0, 0);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Ocupación ficticia y determinista para que la agenda se vea viva. */
export function ocupado(fecha: string, hora: string): boolean {
  let h = 7;
  for (const c of fecha + hora) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % 4 === 0;
}
export const OTRAS_CITAS = ['Solaris del Norte', 'Ing. Hugo Ramírez', 'Granja Los Cedros', 'Dental Plus Hermosillo', 'Panadería La Espiga'];
export const quienOcupa = (fecha: string, hora: string) => OTRAS_CITAS[(fecha.charCodeAt(9) + hora.charCodeAt(1)) % OTRAS_CITAS.length];
