import { useSyncExternalStore } from 'react';
import { CLIENTE, estadoInicial, type Cita, type Correo, type Estado, type Evento } from './datos';

const LLAVE = 'kairovolt:prototipo:v1';
let estado: Estado = cargar();
const oyentes = new Set<() => void>();

function cargar(): Estado {
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (crudo) { const e = JSON.parse(crudo) as Estado; if (e.v === 1) return e; }
  } catch { /* se usa la semilla */ }
  return estadoInicial();
}
function fijar(sig: Estado) {
  estado = sig;
  try { localStorage.setItem(LLAVE, JSON.stringify(sig)); } catch { /* sin persistencia */ }
  oyentes.forEach((f) => f());
}
// Sincroniza pestañas: cliente en una ventana, IDC en otra.
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => {
  if (e.key === LLAVE) { estado = cargar(); oyentes.forEach((f) => f()); }
});

export function useProto(): Estado {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => estado);
}

const uid = () => Math.random().toString(36).slice(2, 9);
const ahora = () => new Date().toISOString();
const nombre = () => CLIENTE.contacto.split(' ')[0];

function evento(titulo: string, detalle: string, tono: Evento['tono'], quien: Evento['quien']): Evento {
  return { id: uid(), fecha: ahora(), titulo, detalle, tono, quien };
}
function correo(asunto: string, vista: string, cuerpo: string[], cta?: string): Correo {
  return { id: uid(), fecha: ahora(), de: 'KairóVolt · IDC <avisos@kairovolt.example>', para: CLIENTE.correo, asunto, vista, cuerpo, cta, leido: false };
}
function aviso(titulo: string, cuerpo: string, extra?: { accion: string; ruta: string }) {
  return { id: uid(), fecha: ahora(), titulo, cuerpo, leido: false, ...extra };
}

export const acciones = {
  reiniciar() { fijar(estadoInicial()); },

  /** Cliente sube un archivo (o su corrección). Simulado: solo se guarda el nombre. */
  subir(id: string, nombreArchivo: string) {
    const previo = estado.documentos.find((x) => x.id === id)!;
    const corr = previo.estado === 'observado';
    const documentos = estado.documentos.map((d) => d.id !== id ? d : {
      ...d, estado: 'en_revision' as const, observacion: undefined,
      versiones: [...d.versiones, { n: d.versiones.length + 1, archivo: nombreArchivo, fecha: ahora(), autor: 'cliente' as const }],
    });
    const d = documentos.find((x) => x.id === id)!;
    fijar({ ...estado, documentos,
      eventos: [evento(corr ? `${d.corto}: corrección enviada (v${d.versiones.length})` : `${d.corto} enviado`, 'Quedó en la fila de revisión de IDC.', 'info', 'cliente'), ...estado.eventos],
      avisos: [aviso(`Recibimos tu ${d.corto.toLowerCase()}`, `Versión ${d.versiones.length}. IDC lo revisará en menos de 1 día hábil.`), ...estado.avisos],
    });
  },

  aceptar(id: string) {
    const documentos = estado.documentos.map((d) => d.id === id ? { ...d, estado: 'aceptado' as const, observacion: undefined } : d);
    const d = documentos.find((x) => x.id === id)!;
    fijar({ ...estado, documentos,
      eventos: [evento(`${d.corto} aceptado`, `Versión ${d.versiones.length} revisada por ${CLIENTE.ingeniero}.`, 'ok', 'idc'), ...estado.eventos],
      avisos: [aviso(`${d.corto} aceptado`, 'Un paso menos. Ya no tienes que hacer nada con este documento.'), ...estado.avisos],
      correos: [correo(`${d.corto} aceptado · ${CLIENTE.folio}`, 'aceptado', [`Hola ${nombre()},`, `Tu documento «${d.nombre}» fue revisado y aceptado por nuestro equipo.`, 'No necesitas hacer nada más con él.'], 'Ver mi expediente'), ...estado.correos],
    });
  },

  observar(id: string, texto: string) {
    const documentos = estado.documentos.map((d) => d.id === id ? { ...d, estado: 'observado' as const, observacion: texto } : d);
    const d = documentos.find((x) => x.id === id)!;
    fijar({ ...estado, documentos,
      eventos: [evento(`${d.corto} con observación`, texto, 'alerta', 'idc'), ...estado.eventos],
      avisos: [aviso(`IDC dejó una observación en ${d.corto}`, texto, { accion: 'Corregir ahora', ruta: 'documentos' }), ...estado.avisos],
      correos: [correo(`Necesitamos una corrección en ${d.corto} · ${CLIENTE.folio}`, 'observado', [`Hola ${nombre()},`, `Revisamos «${d.nombre}» y necesitamos un pequeño ajuste:`, texto, 'Puedes subir solo la hoja corregida desde tu portal.'], 'Corregir documento'), ...estado.correos],
    });
  },

  solicitarCita(fecha: string, hora: string, nota: string) {
    const cita: Cita = { id: 'CITA-' + uid().toUpperCase(), fecha, hora, estado: 'solicitada', motivo: 'Entrega física del expediente', nota };
    fijar({ ...estado, cita,
      eventos: [evento('Cita solicitada', `${fecha} a las ${hora}. Esperando confirmación de IDC.`, 'info', 'cliente'), ...estado.eventos],
      avisos: [aviso('Solicitud de cita enviada', `${fecha} · ${hora}. Te avisaremos en cuanto IDC la confirme.`), ...estado.avisos],
      correos: [correo(`Recibimos tu solicitud de cita · ${cita.id}`, 'cita_solicitada', [`Hola ${nombre()},`, `Solicitaste visitar IDC el ${fecha} a las ${hora} para entregar tu expediente.`, 'Una persona del equipo la confirmará en las próximas horas.']), ...estado.correos],
    });
  },

  confirmarCita(nota?: string) {
    if (!estado.cita) return;
    const cita: Cita = { ...estado.cita, estado: 'confirmada', nota: nota || estado.cita.nota };
    fijar({ ...estado, cita,
      eventos: [evento('Cita confirmada', `${cita.fecha} a las ${cita.hora} con ${CLIENTE.coordinadora}.`, 'ok', 'idc'), ...estado.eventos],
      avisos: [aviso('¡Tu cita está confirmada!', `${cita.fecha} · ${cita.hora}. Te esperamos con tu lista física.`, { accion: 'Ver cita', ruta: 'cita' }), ...estado.avisos],
      correos: [correo(`Cita confirmada · ${cita.fecha} ${cita.hora}`, 'cita_confirmada', [`Hola ${nombre()},`, `Tu cita para entregar el expediente quedó confirmada: ${cita.fecha}, ${cita.hora} (hora de Hermosillo).`, 'Lleva original y copia de los documentos marcados como físicos.'], 'Ver mi cita'), ...estado.correos],
    });
  },

  reprogramarCita(fecha: string, hora: string) {
    if (!estado.cita) return;
    const cita: Cita = { ...estado.cita, fecha, hora, estado: 'reprogramada' };
    fijar({ ...estado, cita,
      eventos: [evento('Cita reprogramada', `Nuevo horario propuesto por IDC: ${fecha} a las ${hora}.`, 'alerta', 'idc'), ...estado.eventos],
      avisos: [aviso('IDC propone un nuevo horario', `${fecha} · ${hora}`, { accion: 'Ver cita', ruta: 'cita' }), ...estado.avisos],
      correos: [correo(`Nuevo horario propuesto · ${fecha} ${hora}`, 'cita_reprogramada', [`Hola ${nombre()},`, `Por agenda, IDC te propone ${fecha} a las ${hora}.`, 'Si no te acomoda, puedes elegir otro horario desde el portal.'], 'Ver cita'), ...estado.correos],
    });
  },

  leerAviso(id: string) { fijar({ ...estado, avisos: estado.avisos.map((a) => a.id === id ? { ...a, leido: true } : a) }); },
  leerCorreo(id: string) { fijar({ ...estado, correos: estado.correos.map((c) => c.id === id ? { ...c, leido: true } : c) }); },
};

export function avance(e: Estado) {
  const total = e.documentos.length;
  const ok = e.documentos.filter((d) => d.estado === 'aceptado').length;
  const rev = e.documentos.filter((d) => d.estado === 'en_revision').length;
  return { total, ok, rev, pct: Math.round(((ok + rev * 0.5) / total) * 100) };
}
