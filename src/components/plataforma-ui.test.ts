import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { analizarProyecto } from '@/application/analizar-proyecto';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { kv2026004Demo } from '@/data/kv-2026-004.demo';
import { PanelEvidencia } from './feature/PanelEvidencia';
import { StageGatePanel } from './feature/StageGatePanel';
import { ValidacionesProyecto } from './feature/ValidacionesProyecto';
import { ValidationCard } from './feature/ValidationCard';
import { Dialogo } from './ui/Dialogo';
import { Tabs } from './ui/Tabs';

const html = (e: ReactElement) => renderToStaticMarkup(h(MemoryRouter, null, e));
const analisis = analizarProyecto(kv2026004Demo, { hoy: '2026-11-23', requisitos: catalogoRequisitosBase });
const gate = (extra: Partial<Parameters<typeof StageGatePanel>[0]> = {}) =>
  html(h(StageGatePanel, { proyecto: kv2026004Demo, analisis, puedeLiberar: true, puedeGestionar: true, permiteSimular: false, destinoCambio: 'este navegador', onCambiar: async () => 'ok', ...extra }));

describe('Tabs', () => {
  it('rol tablist/tab/tabpanel, solo la pestaña activa entra en el orden de tabulación', () => {
    const s = html(h(Tabs, { tabs: [{ id: 'a', etiqueta: 'Resumen' }, { id: 'b', etiqueta: 'Documentos' }], activa: 'b', onCambiar: () => undefined, etiqueta: 'Secciones', children: 'contenido' }));
    expect(s).toContain('role="tablist"');
    expect(s).toContain('aria-label="Secciones"');
    expect(s.match(/role="tab"/g)).toHaveLength(2);
    expect(s.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(s.match(/tabindex="0"/g)).toHaveLength(1);
    expect(s.match(/tabindex="-1"/g)).toHaveLength(1);
    expect(s).toContain('role="tabpanel"');
    expect(s).toMatch(/aria-controls="([^"]+)"[^>]*>Documentos|>Documentos/);
  });
});

describe('Dialogo', () => {
  it('cerrado no renderiza su contenido; abierto muestra título, cuerpo y pie', () => {
    expect(html(h(Dialogo, { abierto: false, titulo: 'X', onCerrar: () => undefined, children: 'secreto' }))).not.toContain('secreto');
    const s = html(h(Dialogo, { abierto: true, titulo: 'Asignar', onCerrar: () => undefined, pie: 'PIE', posicion: 'derecha', children: 'cuerpo' }));
    expect(s).toContain('Asignar');
    expect(s).toContain('cuerpo');
    expect(s).toContain('PIE');
    expect(s).toContain('kv-dialogo--derecha');
    expect(s).toMatch(/aria-labelledby="[^"]+"/);
  });
});

describe('Stage-Gate con el caso KV-2026-004', () => {
  it('muestra G0–G3, el estado de la compuerta elegida y quién aprobó G0', () => {
    const s = gate({ compuertaInicial: 'G0' });
    for (const g of ['G0', 'G1', 'G2', 'G3']) expect(s).toContain(`>${g}<`);
    expect(s).toContain('Liberada');
    expect(s).toContain('Coordinación administrativa (demostrativo)');
    expect(s).toContain('2026-11-06');
    expect(s).toContain('Sin bloqueos');
  });
  it('G1: lista los bloqueantes (documentos faltantes) y los requisitos con su estado', () => {
    const s = gate({ compuertaInicial: 'G1' });
    expect(s).toContain('Bloqueantes');
    expect(s).toMatch(/Faltan \d+ documento\(s\) obligatorio\(s\) de G1/);
    expect(s).toContain('Carta poder');
    expect(s).toContain('Faltante');
    expect(s).toContain('Sin aprobación registrada');
  });
  it('G1: «Liberar» está deshabilitada con el motivo a la vista; no hay botón de liberar para una G0 ya liberada', () => {
    const s = gate({ compuertaInicial: 'G1' });
    expect(s).toMatch(/<button[^>]*disabled[^>]*>Liberar compuerta/);
    expect(s).toContain('aria-describedby="gate-m-liberada"');
    const g0 = gate({ compuertaInicial: 'G0' });
    expect(g0).toContain('ya está liberada');
    expect(g0).toContain('es definitiva');
  });
  it('G2: no se puede solicitar (G1 sin liberar + bloqueantes) ni liberar saltando la revisión', () => {
    const s = gate({ compuertaInicial: 'G2' });
    expect(s).toContain('G1 no está liberada');
    expect(s).toContain('bloqueante');
    expect(s).toMatch(/<button[^>]*disabled[^>]*>Solicitar revisión/);
    expect(s).toContain('primero debe estar en revisión');
  });
  it('sin permiso para gestionar, todos los botones de cambio quedan deshabilitados y se explica por qué', () => {
    const s = gate({ compuertaInicial: 'G1', puedeGestionar: false });
    expect(s).not.toMatch(/<button(?![^>]*disabled)[^>]*>(Solicitar revisión|Liberar compuerta|Bloquear|Regresar a pendiente)/);
    expect(s).toContain('Inicia sesión con un rol autorizado');
  });
});

describe('Validaciones del proyecto', () => {
  const props = { proyecto: kv2026004Demo, analisis, permisos: { gestionarValidaciones: true, aprobarExcepciones: true }, usuario: 'Ana', hoy: '2026-11-23', acciones: { registrarObservacion: async () => null, asignarResponsable: async () => undefined, resolver: async () => undefined } };
  it('muestra documentos comparados con sus valores, severidad y la acción de abrir evidencia; avisa dónde se guardan las decisiones', () => {
    const s = html(h(ValidacionesProyecto, props));
    expect(s).toContain('Solicitud de interconexión (copia 1)');
    expect(s).toContain('MT');
    expect(s).toContain('BT');
    expect(s).toContain('Bloqueante');
    expect(s).toContain('Abrir evidencia');
    expect(s).toContain('en este navegador');
    expect(s).toContain('Requiere decisión de una persona');
  });
  it('ofrece registrar observación; sin permiso lo deshabilita y lo explica', () => {
    expect(html(h(ValidacionesProyecto, props))).toContain('Registrar observación');
    const sin = html(h(ValidacionesProyecto, { ...props, permisos: { gestionarValidaciones: false, aprobarExcepciones: false }, usuario: null }));
    expect(sin).toMatch(/<button[^>]*disabled[^>]*>Registrar observación/);
    expect(sin).toContain('Inicia sesión con un rol autorizado');
  });
  it('un expediente no disponible no inventa resultados', () => {
    const sinExp = { ...kv2026004Demo, documentosDisponibles: false, documentos: [] };
    const s = html(h(ValidacionesProyecto, { ...props, proyecto: sinExp, analisis: analizarProyecto(sinExp, { hoy: '2026-11-23', requisitos: catalogoRequisitosBase }) }));
    expect(s).toContain('Validaciones no disponibles');
    expect(s).not.toContain('Bloqueante');
  });
});

describe('ValidationCard: evidencia', () => {
  const v = { id: 'x', titulo: 'T', resultado: 'no_cumple' as const, severidad: 'bloqueante' as const, evidencias: [{ documentoId: 'd1', documento: 'Solicitud', valor: 'MT' }, { documento: 'Configuración técnica del proyecto', valor: '74' }] };
  it('solo los documentos abribles llevan el botón «Abrir evidencia»', () => {
    const s = html(h(ValidationCard, { validacion: v, onAbrirEvidencia: () => undefined }));
    expect(s.match(/Abrir evidencia/g)).toHaveLength(1);
    expect(html(h(ValidationCard, { validacion: v }))).not.toContain('Abrir evidencia');
  });
});

describe('PanelEvidencia', () => {
  it('muestra los datos declarados y avisa que no hay archivo (no inventa una vista)', () => {
    const d = kv2026004Demo.documentos.find((x) => x.id === 'd4')!;
    const s = html(h(PanelEvidencia, { documento: d, onCerrar: () => undefined }));
    expect(s).toContain('Recibo CFE');
    expect(s).toContain('2026-10-31');
    expect(s).toContain('697.52');
    expect(s).toContain('Sin archivo disponible');
  });
  it('sin documento no muestra nada', () => {
    expect(html(h(PanelEvidencia, { documento: null, onCerrar: () => undefined }))).not.toContain('Datos declarados');
  });
});
