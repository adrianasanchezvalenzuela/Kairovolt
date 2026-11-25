export interface DatosParticipantes {
  tipoTitular: 'fisica' | 'moral' | '';
  titular: string;
  tramita: 'titular' | 'representante' | 'apoderado' | '';
  representante: string;
  apoderado: string;
  testigos: string[];
}

export interface VersionParticipantes {
  version: number;
  datos: DatosParticipantes;
  confirmado: boolean;
}

export const datosIniciales: DatosParticipantes = {
  tipoTitular: '', titular: '', tramita: '', representante: '', apoderado: '', testigos: [],
};

export function validarParticipantes(valor: unknown): DatosParticipantes | null {
  if (!valor || typeof valor !== 'object') return null;
  const d = valor as Record<string, unknown>;
  const nombre = (v: unknown): v is string => typeof v === 'string' && v.length <= 160 && !/[\u0000-\u001f\u007f]/.test(v);
  if (d.tipoTitular !== '' && d.tipoTitular !== 'fisica' && d.tipoTitular !== 'moral') return null;
  if (d.tramita !== '' && d.tramita !== 'titular' && d.tramita !== 'representante' && d.tramita !== 'apoderado') return null;
  if (!nombre(d.titular) || !nombre(d.representante) || !nombre(d.apoderado) ||
      !Array.isArray(d.testigos) || d.testigos.length > 8 || !d.testigos.every(nombre)) return null;
  return {
    tipoTitular: d.tipoTitular, titular: d.titular.trim(), tramita: d.tramita,
    representante: d.representante.trim(), apoderado: d.apoderado.trim(),
    testigos: d.testigos.map((t) => t.trim()).filter(Boolean),
  };
}

export function pasosParticipantes(d: DatosParticipantes): [boolean, boolean] {
  return [
    Boolean(d.tipoTitular && d.titular.trim()),
    d.tramita === 'titular' || (d.tramita === 'representante' && Boolean(d.representante.trim())) ||
      (d.tramita === 'apoderado' && Boolean(d.apoderado.trim())),
  ];
}
