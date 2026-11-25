import { describe, expect, it } from 'vitest';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { kv2026004Demo } from '@/data/kv-2026-004.demo';
import type { Proyecto } from '@/domain/proyecto/proyecto';
import { construirVistaPortal, normalizarFolio, PERMISOS_PORTAL_POR_DEFECTO, type PermisosPortal, type Recepcion } from './portal-cliente';

const hoy = '2026-11-23';
const vistaDe = (extra: { proyecto?: Proyecto; recepciones?: Recepcion[]; permisos?: Partial<PermisosPortal> } = {}) =>
  construirVistaPortal({ proyecto: extra.proyecto ?? kv2026004Demo, catalogo: catalogoRequisitosBase, hoy, recepciones: extra.recepciones ?? [], permisos: { ...PERMISOS_PORTAL_POR_DEFECTO, ...extra.permisos } });
const recepcion = (estado: Recepcion['estado'], extra: Partial<Recepcion> = {}): Recepcion =>
  ({ recibo: 'REC-AAAAAA', documentoId: 'carta_poder', documento: 'Carta poder', archivo: 'carta.pdf', fecha: '2026-11-23T10:00:00.000Z', estado, motivo: null, ...extra });

describe('proyección pública del portal', () => {
  const v = vistaDe();

  it('es una lista blanca: solo estas claves, y ninguna cosa interna', () => {
    expect(Object.keys(v).sort()).toEqual(['avance', 'demo', 'documentos', 'documentosTecnicos', 'etapaActual', 'etapas', 'folio', 'guiaDocumental', 'historial', 'nombre', 'notificaciones', 'permisos', 'recepciones', 'siguientePaso', 'ubicacion']);
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/CS3\.2|CS6\.2|6921|697\.52|nivel_tension|discrepan|bloqueante|hallazgo|observacion|paer|ppc|costo/i);
    expect(json).not.toMatch(/Ingeniería IDC|Proyectista|Supervisor de campo|Coordinación administrativa|Gestión IDC/);
    expect(json).not.toMatch(/Completar los campos vacíos|Solicitar al cliente un recibo|Validación cruzada|Ingeniería: unifilar|Verificación UVIE/);
    expect(json).not.toMatch(/Cliente demostrativo|configuracionTecnica|"cliente":/);
  });

  it('avance y etapa actual salen de reglas explícitas', () => {
    expect(v.avance).toMatchObject({ porcentaje: 54, exacto: true });
    expect(v.etapaActual).toMatchObject({ id: 'G1', nombre: 'Documentos y diseño' });
    expect(v.etapas.map((e) => [e.id, e.estado, e.actual])).toEqual([['G0', 'Completada', false], ['G1', 'En curso', true], ['G2', 'Por iniciar', false], ['G3', 'Por iniciar', false]]);
  });

  it('el estado interno «bloqueada» se muestra como «En pausa», sin el motivo', () => {
    const p = { ...kv2026004Demo, compuertas: kv2026004Demo.compuertas.map((c) => (c.id === 'G1' ? { ...c, estado: 'bloqueada' as const } : c)) };
    const bloq = vistaDe({ proyecto: p, permisos: { ver_documentos_autorizados: false } });
    expect(bloq.etapas[1]?.estado).toBe('En pausa');
    expect(JSON.stringify(bloq)).not.toMatch(/bloquead/i);
    expect(bloq.siguientePaso).toMatchObject({ titulo: 'Tu proyecto está en pausa', responsable: 'idc' });
  });

  it('documentos solicitados: solo los obligatorios que aporta el cliente, con su estado', () => {
    const d = v.documentos!;
    expect(d.map((x) => x.id).sort()).toEqual(['carta_poder', 'constancia_situacion_fiscal', 'identificacion_oficial', 'recibo_cfe']);
    expect(d.find((x) => x.id === 'recibo_cfe')).toMatchObject({ estado: 'vencido', puedeSubir: true, vigencia: '2026-10-31' });
    expect(d.find((x) => x.id === 'carta_poder')).toMatchObject({ estado: 'pendiente', puedeSubir: true, etapa: 'G1' });
  });

  it('siguiente paso: si faltan documentos, le toca al cliente; con la cuenta correcta', () => {
    expect(v.siguientePaso).toMatchObject({ responsable: 'cliente', titulo: 'Entrega 4 documentos' });
    const uno = vistaDe({ recepciones: ['carta_poder', 'identificacion_oficial', 'constancia_situacion_fiscal'].map((id, i) => recepcion('recibido', { documentoId: id, recibo: `REC-00000${i}` })) });
    expect(uno.siguientePaso.titulo).toBe('Entrega: Recibo CFE del último corte, sin adeudos');
  });

  it('sin documentos pendientes el siguiente paso es de IDC, con texto fijo de la etapa', () => {
    const todos = vistaDe({ recepciones: ['carta_poder', 'identificacion_oficial', 'constancia_situacion_fiscal', 'recibo_cfe'].map((id, i) => recepcion('recibido', { documentoId: id, recibo: `REC-00000${i}` })) });
    expect(todos.siguientePaso).toMatchObject({ responsable: 'idc', titulo: 'IDC trabaja en «Documentos y diseño»' });
  });

  it('un trámite completo lo dice y su avance es 100', () => {
    const p = { ...kv2026004Demo, compuertas: kv2026004Demo.compuertas.map((c) => ({ ...c, estado: 'liberada' as const })) };
    const c = vistaDe({ proyecto: p });
    expect(c.avance.porcentaje).toBe(100);
    expect(c.etapaActual).toBeNull();
    expect(c.siguientePaso.titulo).toBe('Tu trámite está completo');
  });

  it('estados de documento según las recepciones: en revisión, aceptado, rechazado (con el motivo de IDC) y re-envío', () => {
    const estado = (r: Recepcion) => vistaDe({ recepciones: [r] }).documentos!.find((d) => d.id === 'carta_poder')!;
    expect(estado(recepcion('recibido'))).toMatchObject({ estado: 'en_revision', puedeSubir: false });
    expect(estado(recepcion('aceptado'))).toMatchObject({ estado: 'aceptado', puedeSubir: false });
    expect(estado(recepcion('rechazado', { motivo: 'La foto está borrosa' }))).toMatchObject({ estado: 'rechazado', puedeSubir: true, detalle: 'La foto está borrosa' });
  });

  it('confirmaciones, avisos e historial reflejan las recepciones sin texto interno', () => {
    const r = vistaDe({ recepciones: [recepcion('recibido'), recepcion('rechazado', { recibo: 'REC-BBBBBB', documentoId: 'recibo_cfe', documento: 'Recibo CFE', motivo: 'No se lee' })] });
    expect(r.recepciones.map((x) => x.recibo).sort()).toEqual(['REC-AAAAAA', 'REC-BBBBBB']);
    expect(r.notificaciones.map((n) => n.titulo)).toEqual(expect.arrayContaining(['Recibimos «Carta poder»', '«Recibo CFE» necesita una corrección']));
    expect(r.historial.some((e) => e.titulo === 'Documento recibido: Carta poder')).toBe(true);
  });

  it('historial público: solo hitos con etiqueta fija; los nombres de actividades internas no salen', () => {
    const t = v.historial.map((e) => e.titulo);
    expect(t).toEqual(expect.arrayContaining(['Proyecto registrado', 'Capacidad de la red confirmada', 'Instalación terminada', 'Etapa completada: Revisión inicial']));
    expect(t.join('|')).not.toMatch(/unifilar|memoria de cálculo|Alta del proyecto/);
    const fechas = v.historial.map((e) => e.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it('permisos: sin «ver documentos» no hay lista ni recepciones; sin «subir» no hay botón de subida', () => {
    const sin = vistaDe({ recepciones: [recepcion('recibido')], permisos: { ver_documentos_autorizados: false } });
    expect(sin.documentos).toBeNull();
    expect(sin.guiaDocumental).toBeNull();
    expect(sin.recepciones).toEqual([]);
    expect(sin.siguientePaso.responsable).not.toBe('cliente');
    const soloLeer = vistaDe({ permisos: { subir_documentos: false } });
    expect(soloLeer.documentos!.every((d) => !d.puedeSubir)).toBe(true);
    expect(soloLeer.permisos.subirDocumentos).toBe(false);
  });

  it('la guía conserva instrucciones y deja en revisión requisitos condicionales no validados', () => {
    const guia = v.guiaDocumental!;
    expect(guia.find((r) => r.id === 'carta_poder')).toMatchObject({ validacionIdc: 'pendiente', aplicabilidad: 'pendiente_revision', instrucciones: 'Instrucciones pendientes de validación por IDC.' });
    expect(guia.some((r) => r.id === 'acta_constitutiva' && r.aplicabilidad === 'pendiente_revision')).toBe(true);
  });

  it('sin expediente en la fuente (Zoho): avance aproximado y NO se afirma qué documentos faltan', () => {
    const sinExp = { ...kv2026004Demo, documentosDisponibles: false, documentos: [], esMock: false };
    const s = vistaDe({ proyecto: sinExp });
    expect(s.avance).toMatchObject({ porcentaje: 25, exacto: false });
    expect(s.documentos).toEqual([]);
    expect(s.siguientePaso.responsable).toBe('idc');
    expect(s.demo).toBe(false);
  });

  it('normaliza el folio', () => {
    expect(normalizarFolio('  kv-2026-004 ')).toBe('KV-2026-004');
  });
});
