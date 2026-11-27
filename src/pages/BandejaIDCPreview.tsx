import { useState } from 'react';
import { BrowserRouter, Link } from 'react-router-dom';
import { BandejaIDCContenidoDemo, type RecepcionIDC } from '@/pages/BandejaIDC';
import { Sidebar, type SeccionNav } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { StatusBadge } from '@/components/ui/StatusBadge';

const RECEPCIONES_DEMO: readonly RecepcionIDC[] = [
  {
    id: 'demo-recepcion-001', folio: 'KV-DEMO-001', recibo: 'REC-DEMO-005', documento_id: 'recibo_cfe',
    documento_nombre: 'Recibo CFE', archivo_nombre: 'recibo_cfe_ejemplo.pdf', mime: 'application/pdf', estado: 'recibido',
    creado_en: '2026-11-26T17:20:00-07:00', motivo_rechazo: null, sustituye_recepcion_id: 'demo-recepcion-000',
  },
  {
    id: 'demo-recepcion-000', folio: 'KV-DEMO-001', recibo: 'REC-DEMO-004', documento_id: 'recibo_cfe',
    documento_nombre: 'Recibo CFE', archivo_nombre: 'recibo_cfe_anterior_ejemplo.pdf', mime: 'application/pdf', estado: 'rechazado',
    creado_en: '2026-11-24T12:10:00-07:00', motivo_rechazo: 'Ejemplo ficticio: la imagen requiere mayor nitidez.', sustituye_recepcion_id: null,
  },
  {
    id: 'demo-recepcion-002', folio: 'KV-DEMO-002', recibo: 'REC-DEMO-006', documento_id: 'identificacion_oficial',
    documento_nombre: 'Identificación oficial', archivo_nombre: 'identificacion_ejemplo.pdf', mime: 'application/pdf', estado: 'en_revision',
    creado_en: '2026-11-26T15:05:00-07:00', motivo_rechazo: null, sustituye_recepcion_id: null,
  },
  {
    id: 'demo-recepcion-003', folio: 'KV-DEMO-003', recibo: 'REC-DEMO-007', documento_id: 'diagrama_unifilar',
    documento_nombre: 'Diagrama unifilar', archivo_nombre: 'diagrama_unifilar_ejemplo.pdf', mime: 'application/pdf', estado: 'aceptado',
    creado_en: '2026-11-25T09:40:00-07:00', motivo_rechazo: null, sustituye_recepcion_id: null,
  },
  {
    id: 'demo-recepcion-004', folio: 'KV-DEMO-004', recibo: 'REC-DEMO-008', documento_id: 'constancia_situacion_fiscal',
    documento_nombre: 'Constancia de situación fiscal', archivo_nombre: 'constancia_ejemplo.pdf', mime: 'application/pdf', estado: 'recibido',
    creado_en: '2026-11-27T08:15:00-07:00', motivo_rechazo: null, sustituye_recepcion_id: null,
  },
];

const SECCIONES_DEMO: SeccionNav[] = [
  { titulo: 'Operación', items: [{ to: '/panel', etiqueta: 'Panel', icono: '▧', exacto: true }, { to: '/proyectos', etiqueta: 'Proyectos', icono: '▤' }] },
  { titulo: 'Control', items: [
    { to: '/documentos', etiqueta: 'Documentos', icono: '▭' }, { to: '/validaciones', etiqueta: 'Validaciones', icono: '✓' },
    { to: '/bandeja/demo', etiqueta: 'Bandeja IDC', icono: '▤' }, { to: '/cronograma', etiqueta: 'Cronograma', icono: '▦' },
    { to: '/seguimiento-cfe', etiqueta: 'Seguimiento CFE', icono: '⚡' }, { to: '/indicadores', etiqueta: 'Indicadores', icono: '%' },
  ] },
  { titulo: 'Sistema', items: [{ to: '/integraciones', etiqueta: 'Integraciones', icono: '⇄' }, { to: '/configuracion', etiqueta: 'Configuración', icono: '⚙' }] },
];

/** Reusa la Bandeja real con registros locales ficticios. No monta el proveedor de sesión de la aplicación. */
export function BandejaIDCPreview() {
  if (!import.meta.env.DEV) return null;
  return <BrowserRouter><MarcoDemostracion /></BrowserRouter>;
}

function MarcoDemostracion() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  return <div className="kv-shell">
    <Sidebar inicio="/bandeja/demo" marca="KairóVolt" subtitulo="Panel interno IDC · demo" secciones={SECCIONES_DEMO} abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} pie="Vista local de demostración" />
    <div className="kv-shell__principal">
      <Topbar marca={{ texto: 'KairóVolt', to: '/bandeja/demo' }} onMenu={() => setMenuAbierto((abierto) => !abierto)} menuAbierto={menuAbierto}>
        <StatusBadge tono="alerta" variante="suave" punto>DEMO · datos ficticios</StatusBadge>
        <Link className="kv-btn kv-btn--secundario kv-btn--sm" to="/panel">Salir de la demostración</Link>
      </Topbar>
      <main id="contenido" className="kv-shell__contenido kv-shell__contenido--refinado" tabIndex={-1}>
        <BandejaIDCContenidoDemo recepciones={RECEPCIONES_DEMO} />
      </main>
    </div>
  </div>;
}
