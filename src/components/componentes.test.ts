import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Hallazgo } from '@/domain/validacion/hallazgo';
import { DiscrepancyPanel } from './feature/DiscrepancyPanel';
import { DocumentPreview, tipoVistaPrevia, urlSegura } from './feature/DocumentPreview';
import { DocumentRow, DocumentTable } from './feature/DocumentRow';
import { clasificarArchivos } from './feature/DocumentUploader';
import { aValidacionVista } from './feature/HallazgosPanel';
import { ProjectCard } from './feature/ProjectCard';
import { ProjectTable } from './feature/ProjectTable';
import type { ProyectoVista } from './feature/ProyectoVista';
import { StageGateStepper } from './feature/StageGateStepper';
import { ValidationCard, type ValidacionVista } from './feature/ValidationCard';
import { Sidebar } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';
import { AlertPanel } from './ui/AlertPanel';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from './ui/Estados';
import { KPI } from './ui/KPI';
import { PageHeader } from './ui/PageHeader';
import { ProgressBar } from './ui/ProgressBar';
import { StatusBadge } from './ui/StatusBadge';
import { Timeline } from './ui/Timeline';

const html = (e: ReactElement) => renderToStaticMarkup(e);
const enRuta = (e: ReactElement, ruta = '/') => html(h(MemoryRouter, { initialEntries: [ruta] }, e));

describe('StatusBadge', () => {
  it('aplica el tono y la variante; el texto siempre está (el color no es la única señal)', () => {
    const s = html(h(StatusBadge, { tono: 'error', variante: 'solido', punto: true, children: 'Bloqueante' }));
    expect(s).toContain('kv-tono-error');
    expect(s).toContain('kv-badge--solido');
    expect(s).toContain('Bloqueante');
    expect(s).toContain('aria-hidden="true"'); // el punto es decorativo
  });
  it('por defecto es neutro y de contorno', () => {
    const s = html(h(StatusBadge, null, 'x'));
    expect(s).toContain('kv-tono-neutro');
    expect(s).not.toContain('kv-badge--suave');
  });
});

describe('KPI y ProgressBar', () => {
  it('un valor null se muestra como «—» con texto para lectores, nunca como 0', () => {
    const s = html(h(KPI, { etiqueta: 'PPC', valor: null }));
    expect(s).toContain('—');
    expect(s).toContain('Sin dato');
    expect(s).not.toContain('>0<');
  });
  it('muestra el valor y el detalle', () => {
    const s = html(h(KPI, { etiqueta: 'PAER', valor: '68%', detalle: 'meta >80%', tono: 'alerta', resaltarValor: true }));
    expect(s).toContain('68%');
    expect(s).toContain('meta &gt;80%');
    expect(s).toContain('kv-kpi__valor--tono');
  });
  it('la barra de progreso expone rol y valores accesibles y limita al 0–100 %', () => {
    const s = html(h(ProgressBar, { valor: 7, total: 12, etiqueta: 'Expediente' }));
    expect(s).toContain('role="progressbar"');
    expect(s).toContain('aria-valuenow="58"');
    expect(s).toContain('aria-label="Expediente"');
    expect(s).toContain('7/12');
    expect(html(h(ProgressBar, { valor: 99, total: 10, etiqueta: 'x' }))).toContain('aria-valuenow="100"');
    expect(html(h(ProgressBar, { valor: -3, total: 10, etiqueta: 'x' }))).toContain('aria-valuenow="0"');
  });
  it('total 0 es «Sin datos», no 0 %', () => {
    const s = html(h(ProgressBar, { valor: 0, total: 0, etiqueta: 'x' }));
    expect(s).toContain('Sin datos');
    expect(s).toContain('aria-valuetext="Sin datos"');
  });
});

describe('AlertPanel y estados', () => {
  it('los errores se anuncian con role="alert"; el resto con role="status"', () => {
    expect(html(h(AlertPanel, { tono: 'error' }, 'x'))).toContain('role="alert"');
    expect(html(h(AlertPanel, { tono: 'info' }, 'x'))).toContain('role="status"');
    expect(html(h(AlertPanel, { tono: 'ok', onCerrar: () => undefined }, 'x'))).toContain('aria-label="Cerrar aviso"');
  });
  it('LoadingState anuncia la carga; ErrorState ofrece reintentar solo si se le pasa la acción', () => {
    expect(html(h(LoadingState, { etiqueta: 'Cargando proyectos…' }))).toMatch(/role="status".*Cargando proyectos/);
    const sin = html(h(ErrorState, { titulo: 'Falló' }));
    const con = html(h(ErrorState, { titulo: 'Falló', detalle: 'Zoho 503', onReintentar: () => undefined }));
    expect(sin).toContain('role="alert"');
    expect(sin).not.toContain('Reintentar');
    expect(con).toContain('Reintentar');
    expect(con).toContain('Zoho 503');
  });
  it('EmptyState muestra título, explicación y acción', () => {
    const s = html(h(EmptyState, { titulo: 'Sin documentos', descripcion: 'Aún no hay', acciones: h('button', null, 'Subir') }));
    expect(s).toContain('Sin documentos');
    expect(s).toContain('Aún no hay');
    expect(s).toContain('Subir');
  });
});

describe('ConfirmationModal', () => {
  it('es un <dialog> con título enlazado y botón de peligro cuando la acción es destructiva', () => {
    const s = html(h(ConfirmationModal, { abierto: true, titulo: 'Desactivar usuario', tono: 'error', confirmarTexto: 'Desactivar', onConfirmar: () => undefined, onCancelar: () => undefined }, 'Perderá el acceso'));
    expect(s).toContain('<dialog');
    expect(s).toMatch(/aria-labelledby="[^"]+"/);
    expect(s).toContain('Desactivar usuario');
    expect(s).toContain('kv-btn--peligro');
    expect(s).toContain('Cancelar');
  });
  it('ocupado bloquea los botones', () => {
    const s = html(h(ConfirmationModal, { abierto: true, titulo: 't', ocupado: true, onConfirmar: () => undefined, onCancelar: () => undefined }));
    expect(s.match(/disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Timeline', () => {
  const eventos = [{ id: 'b', titulo: 'B', fecha: '2026-11-20' }, { id: 'a', titulo: 'A', fecha: '2026-11-02' }, { id: 'c', titulo: 'C', fecha: '2026-12-01' }];
  const orden = (s: string) => ['A', 'B', 'C'].map((x) => s.indexOf(`>${x}<`));
  it('respeta el orden dado por defecto', () => {
    const [a, b, c] = orden(html(h(Timeline, { eventos, etiqueta: 'L' })));
    expect(b).toBeLessThan(a!);
    expect(a).toBeLessThan(c!);
  });
  it('ordena por fecha cuando se pide y usa <time>', () => {
    const s = html(h(Timeline, { eventos, etiqueta: 'L', orden: 'antiguo-primero' }));
    const [a, b, c] = orden(s);
    expect(a).toBeLessThan(b!);
    expect(b).toBeLessThan(c!);
    expect(s).toContain('<time');
    const inverso = orden(html(h(Timeline, { eventos, etiqueta: 'L', orden: 'reciente-primero' })));
    expect(inverso[2]).toBeLessThan(inverso[0]!);
  });
});

describe('StageGateStepper', () => {
  const pasos = [
    { id: 'G0', titulo: 'Alta', tono: 'ok' as const, estado: 'Liberada', progreso: '4/4 documentos' },
    { id: 'G1', titulo: 'Acopio', tono: 'alerta' as const, estado: 'En revisión' },
  ];
  it('con onSeleccionar son botones y el elegido lleva aria-current="step"', () => {
    const s = html(h(StageGateStepper, { pasos, etiqueta: 'Compuertas', seleccionadoId: 'G1', onSeleccionar: () => undefined }));
    expect(s.match(/<button/g)).toHaveLength(2);
    expect(s.match(/aria-current="step"/g)).toHaveLength(1);
    expect(s).toContain('aria-label="Compuertas"');
    expect(s).toContain('En revisión');
  });
  it('sin onSeleccionar es solo informativo: no hay botones', () => {
    expect(html(h(StageGateStepper, { pasos, etiqueta: 'Compuertas' }))).not.toContain('<button');
  });
});

describe('ValidationCard y DiscrepancyPanel', () => {
  const bloqueante: ValidacionVista = {
    id: 'v1', titulo: 'Potencia distinta', resultado: 'no_cumple', severidad: 'bloqueante', requiereAprobacionHumana: true,
    evidencias: [{ documento: 'Memoria', valor: '40 kW' }, { documento: 'Unifilar', valor: null }], accionRecomendada: 'Pedir confirmación',
  };
  const mayor: ValidacionVista = { id: 'v2', titulo: 'Vigencia por vencer', resultado: 'no_cumple', severidad: 'mayor', etiquetaSeveridad: 'Advertencia' };
  const cumple: ValidacionVista = { id: 'v3', titulo: 'Todo bien', resultado: 'cumple', severidad: 'informativa' };

  it('un bloqueante que no cumple se abre solo, muestra cada documento con su valor y no decide cuál es el correcto', () => {
    const s = html(h(ValidationCard, { validacion: bloqueante }));
    expect(s).not.toMatch(/<details[^>]* open/);
    expect(s).toContain('Memoria');
    expect(s).toContain('40 kW');
    expect(s).toContain('no declarado');
    expect(s).toContain('Requiere decisión de una persona');
    expect(s).toContain('Pedir confirmación');
  });
  it('un resultado menor o que cumple va cerrado; la etiqueta de severidad puede personalizarse', () => {
    expect(html(h(ValidationCard, { validacion: mayor }))).not.toMatch(/<details[^>]* open/);
    expect(html(h(ValidationCard, { validacion: mayor }))).toContain('Advertencia');
    const ok = html(h(ValidationCard, { validacion: cumple }));
    expect(ok).toContain('Cumple');
    expect(ok).not.toMatch(/<details[^>]* open/);
  });
  it('el panel pone primero lo que bloquea, resume por severidad y oculta lo que cumple', () => {
    const s = html(h(DiscrepancyPanel, { validaciones: [cumple, mayor, bloqueante], nombresSeveridad: { mayor: ['advertencia', 'advertencias'] } }));
    expect(s.indexOf('Potencia distinta')).toBeLessThan(s.indexOf('Vigencia por vencer'));
    expect(s).toContain('1 bloqueante');
    expect(s).toContain('1 advertencia');
    expect(s).not.toContain('Todo bien');
    expect(html(h(DiscrepancyPanel, { validaciones: [cumple], incluirCumplidas: true }))).toContain('Todo bien');
  });
  it('sin hallazgos muestra un estado vacío, no una lista vacía', () => {
    expect(html(h(DiscrepancyPanel, { validaciones: [] }))).toContain('Sin hallazgos');
  });
  it('el adaptador del dominio conserva el contenido y no agrega decisiones', () => {
    const hallazgo: Hallazgo = {
      id: 'h1', categoria: 'discrepancia', severidad: 'advertencia', titulo: 'Tensión', detalle: 'Dos valores distintos',
      evidencias: [{ documentoId: 'd1', documentoNombre: 'Solicitud', valor: '220 V' }],
    };
    expect(aValidacionVista(hallazgo)).toMatchObject({ resultado: 'no_cumple', severidad: 'mayor', etiquetaSeveridad: 'Advertencia', evidencias: [{ documento: 'Solicitud', valor: '220 V' }] });
    expect(aValidacionVista({ ...hallazgo, categoria: 'campo_incompleto', severidad: 'bloqueante', evidencias: [] })).toMatchObject({ resultado: 'no_evaluable', severidad: 'bloqueante' });
  });
});

describe('documentos', () => {
  const f = (name: string, type: string, size: number) => ({ name, type, size });

  it('clasificarArchivos aplica tipo, tamaño y archivo vacío, y explica el motivo', () => {
    const r = clasificarArchivos(
      [f('a.pdf', 'application/pdf', 1000), f('b.png', 'image/png', 500), f('c.exe', 'application/x-msdownload', 100), f('d.pdf', 'application/pdf', 20 * 1024 * 1024), f('e.pdf', 'application/pdf', 0)],
      { aceptar: ['.pdf', 'image/*'], maxBytes: 10 * 1024 * 1024 },
    );
    expect(r.aceptados.map((a) => a.name)).toEqual(['a.pdf', 'b.png']);
    expect(r.rechazados.map((x) => x.nombre)).toEqual(['c.exe', 'd.pdf', 'e.pdf']);
    expect(r.rechazados[0]?.motivo).toContain('tipo no permitido');
    expect(r.rechazados[1]?.motivo).toContain('10 MB');
    expect(r.rechazados[2]?.motivo).toContain('vacío');
  });
  it('sin restricciones acepta cualquier archivo con contenido', () => {
    expect(clasificarArchivos([f('x.bin', '', 1)]).aceptados).toHaveLength(1);
  });
  it('la extensión se compara sin distinguir mayúsculas', () => {
    expect(clasificarArchivos([f('ACTA.PDF', '', 10)], { aceptar: ['.pdf'] }).aceptados).toHaveLength(1);
  });

  it('tipoVistaPrevia decide por MIME y, si falta, por extensión', () => {
    expect(tipoVistaPrevia('application/pdf', 'x')).toBe('pdf');
    expect(tipoVistaPrevia(null, 'Acta.PDF')).toBe('pdf');
    expect(tipoVistaPrevia('image/png', 'x')).toBe('imagen');
    expect(tipoVistaPrevia(undefined, 'foto.JPG')).toBe('imagen');
    expect(tipoVistaPrevia('application/zip', 'a.zip')).toBe('ninguno');
  });
  it('urlSegura solo deja pasar http(s), blob: y rutas propias', () => {
    expect(urlSegura('https://x.mx/a.pdf')).toBe('https://x.mx/a.pdf');
    expect(urlSegura('/api/doc/1')).toBe('/api/doc/1');
    expect(urlSegura('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
    for (const mala of ['javascript:alert(1)', 'data:text/html,<script>1</script>', '//evil.com/x', 'file:///etc/passwd', 'ftp://x', '', null, undefined]) expect(urlSegura(mala)).toBeNull();
  });
  it('DocumentPreview: sin url no inventa una vista; una url peligrosa se ignora; un PDF va en iframe', () => {
    expect(html(h(DocumentPreview, { nombre: 'a.pdf', url: null }))).toContain('Sin archivo disponible');
    const peligrosa = html(h(DocumentPreview, { nombre: 'a.pdf', url: 'javascript:alert(1)' }));
    expect(peligrosa).toContain('Sin archivo disponible');
    expect(peligrosa).not.toContain('javascript:');
    const pdf = html(h(DocumentPreview, { nombre: 'a.pdf', url: 'https://x.mx/a.pdf' }));
    expect(pdf).toContain('<iframe');
    expect(pdf).toContain('rel="noopener noreferrer"');
    expect(html(h(DocumentPreview, { nombre: 'f.png', url: 'https://x.mx/f.png' }))).toContain('<img');
  });
  it('DocumentRow / DocumentTable: encabezados de columna, fila con estado y fila vacía', () => {
    const s = html(h(DocumentTable, { etiqueta: 'Checklist G0', conAcciones: true, vacio: 'Sin requisitos', children: h(DocumentRow, { nombre: 'Acta', estado: { texto: 'Recibido', tono: 'ok' }, acciones: h('button', null, 'Ver') }) }));
    expect(s).toContain('aria-label="Checklist G0"');
    expect(s).toContain('scope="col"');
    expect(s).toContain('scope="row"');
    expect(s).toContain('Recibido');
    expect(s).toContain('Sin requisitos');
  });
});

describe('proyectos', () => {
  const base: ProyectoVista = { id: 'a', folio: 'KV-2026-001', nombre: 'FV 40 kW', cliente: 'Acme', ubicacion: 'Hermosillo, Sonora', to: '/proyectos/a', avance: { recibidos: 7, total: 12 }, observaciones: { abiertas: 3, vencidas: 1 } };
  it('ProjectCard enlaza al proyecto, muestra el avance y las observaciones vencidas', () => {
    const s = enRuta(h(ProjectCard, { proyecto: base }));
    expect(s).toContain('href="/proyectos/a"');
    expect(s).toContain('7/12 obligatorios');
    expect(s).toContain('1 vencidas');
    expect(s).toContain('KV-2026-001');
  });
  it('un expediente que la fuente no trae dice «no disponible», no 0 %', () => {
    const s = enRuta(h(ProjectCard, { proyecto: { ...base, avance: null } }));
    expect(s).toContain('Expediente no disponible');
    expect(s).not.toContain('progressbar');
    expect(enRuta(h(ProjectTable, { proyectos: [{ ...base, avance: null }] }))).toContain('No disponible');
  });
  it('ProjectTable lista los proyectos con encabezados accesibles y, vacío, explica por qué', () => {
    const s = enRuta(h(ProjectTable, { proyectos: [base] }));
    expect(s).toContain('scope="col"');
    expect(s).toContain('href="/proyectos/a"');
    expect(enRuta(h(ProjectTable, { proyectos: [] }))).toContain('No hay proyectos');
  });
});

describe('layout', () => {
  it('Sidebar: navegación con nombre, ítem activo con aria-current y panel cerrado/abierto', () => {
    const secciones = [{ titulo: 'Operación', items: [{ to: '/', etiqueta: 'Proyectos', exacto: true }, { to: '/usuarios', etiqueta: 'Usuarios' }] }];
    const cerrado = enRuta(h(Sidebar, { marca: 'KairóVolt', secciones }));
    expect(cerrado).toContain('aria-label="Navegación principal"');
    expect(cerrado).toMatch(/href="\/"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/"/);
    expect(cerrado).not.toMatch(/href="\/usuarios"[^>]*aria-current/);
    expect(cerrado).not.toContain('kv-sidebar--abierto');
    expect(enRuta(h(Sidebar, { marca: 'KairóVolt', secciones, abierto: true, onCerrar: () => undefined }))).toContain('kv-sidebar--abierto');
  });
  it('Topbar: el botón de menú solo existe si se da onMenu y expone su estado', () => {
    expect(enRuta(h(Topbar, null, 'x'))).not.toContain('Abrir menú');
    const s = enRuta(h(Topbar, { onMenu: () => undefined, menuAbierto: true, marca: { texto: 'KairóVolt', to: '/' } }, 'x'));
    expect(s).toContain('aria-expanded="true"');
    expect(s).toContain('aria-controls="kv-sidebar"');
  });
  it('PageHeader: migas con la última como página actual y acciones', () => {
    const s = enRuta(h(PageHeader, { titulo: 'FV 40 kW', migas: [{ etiqueta: 'Proyectos', to: '/' }, { etiqueta: 'KV-1' }], acciones: h('button', null, 'Editar') }));
    expect(s).toContain('<h1>FV 40 kW</h1>');
    expect(s).toContain('aria-label="Ruta de navegación"');
    expect(s.match(/aria-current="page"/g)).toHaveLength(1);
    expect(s).toContain('Editar');
  });
});
