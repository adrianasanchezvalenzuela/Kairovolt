import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { FuenteDatosProvider } from '@/hooks/FuenteDatos';
import { Acceso } from '@/pages/Acceso';
import { BandejaIDC } from '@/pages/BandejaIDC';
import { Cuenta } from '@/pages/Cuenta';
import { Restablecer } from '@/pages/Restablecer';
import { Usuarios } from '@/pages/Usuarios';
import { Cronograma } from '@/pages/Cronograma';
import { Dashboard } from '@/pages/Dashboard';
import { Documentos } from '@/pages/Documentos';
import { Indicadores } from '@/pages/Indicadores';
import { Integraciones } from '@/pages/Integraciones';
import { Proyectos } from '@/pages/Proyectos';
import { SeguimientoCfe } from '@/pages/SeguimientoCfe';
import { Validaciones } from '@/pages/Validaciones';
import { ProyectoDetalle } from '@/pages/ProyectoDetalle';
import { PortalProveedor } from '@/hooks/PortalContexto';
import { PortalAcceso } from '@/pages/portal/PortalAcceso';
import { PortalAvisos } from '@/pages/portal/PortalAvisos';
import { PortalHistorial } from '@/pages/portal/PortalHistorial';
import { PortalInicio } from '@/pages/portal/PortalInicio';
import { PortalMisDatos } from '@/pages/portal/PortalMisDatos';
import { PortalVerificarCorreo } from '@/pages/portal/PortalVerificarCorreo';
import { CargaPortal } from '@/components/portal/DisenoPortal';
import { MarcoProto } from '@/prototipo/ui';
import { Portada } from '@/prototipo/Portada';
import { Correos } from '@/prototipo/Correos';
import { Avisos, Cita, Documentos as DocsProto, Historial, Inicio } from '@/prototipo/Cliente';
import { Agenda, Expediente, Mesa } from '@/prototipo/Idc';

const PortalDocumentos = lazy(() => import('@/pages/portal/PortalDocumentos').then((m) => ({ default: m.PortalDocumentos })));
const PortalVisita = lazy(() => import('@/pages/portal/PortalVisita').then((m) => ({ default: m.PortalVisita })));
const Configuracion = lazy(() => import('@/pages/Configuracion').then((m) => ({ default: m.Configuracion })));
const PortalDemos = import.meta.env.DEV ? lazy(() => import('@/pages/portal/PortalDemos').then((m) => ({ default: m.PortalDemos }))) : null;
const IdcDemo = import.meta.env.DEV ? lazy(() => import('@/pages/IdcDemo').then((m) => ({ default: m.IdcDemo }))) : null;
const PortalRevisionDemo = import.meta.env.DEV ? lazy(() => import('@/pages/portal/PortalRevisionDemo').then((m) => ({ default: m.PortalRevisionDemo }))) : null;

/** Galería de componentes: solo en desarrollo (no entra al build de producción). */
const Componentes = import.meta.env.DEV ? lazy(() => import('@/pages/Componentes').then((m) => ({ default: m.Componentes }))) : null;

export function App() {
  const demoLocal = import.meta.env.DEV && (window.location.pathname.startsWith('/demo/portal') || window.location.pathname.startsWith('/demo/idc'));
  return (
    <FuenteDatosProvider>
    <BrowserRouter basename={demoLocal ? '/demo' : '/'}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="proyectos" element={<Proyectos />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="validaciones" element={<Validaciones />} />
          <Route path="bandeja" element={<BandejaIDC />} />
          <Route path="cronograma" element={<Cronograma />} />
          <Route path="seguimiento-cfe" element={<SeguimientoCfe />} />
          <Route path="indicadores" element={<Indicadores />} />
          <Route path="integraciones" element={<Integraciones />} />
          <Route path="configuracion" element={<Suspense fallback={<CargaPortal etiqueta="Abriendo configuración…" />}><Configuracion /></Suspense>} />
          <Route path="acceso" element={<Acceso />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="cuenta" element={<Cuenta />} />
          {Componentes && <Route path="componentes" element={<Suspense fallback={null}><Componentes /></Suspense>} />}
          <Route path="restablecer" element={<Restablecer />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
        </Route>
        {IdcDemo && <Route path="idc/:folio?" element={<Suspense fallback={null}><IdcDemo /></Suspense>} />}
        {/* Prototipo visual: datos ficticios y estado local, aislado de Supabase y Zoho. */}
        <Route path="prototipo">
          <Route index element={<Portada />} />
          <Route path="correos" element={<Correos />} />
          <Route path="cliente" element={<MarcoProto lado="cliente" />}>
            <Route index element={<Inicio />} />
            <Route path="documentos" element={<DocsProto />} />
            <Route path="cita" element={<Cita />} />
            <Route path="avisos" element={<Avisos />} />
            <Route path="historial" element={<Historial />} />
          </Route>
          <Route path="idc" element={<MarcoProto lado="idc" />}>
            <Route index element={<Mesa />} />
            <Route path="expediente" element={<Expediente />} />
            <Route path="agenda" element={<Agenda />} />
          </Route>
        </Route>
        <Route path="portal" element={<PortalProveedor />}>
          <Route index element={<PortalAcceso />} />
          <Route path="verificar-correo" element={<PortalVerificarCorreo />} />
          {PortalDemos && <Route path="demos" element={<Suspense fallback={null}><PortalDemos /></Suspense>} />}
          <Route element={<PortalLayout />}>
            <Route path="inicio" element={<PortalInicio />} />
            <Route path="visita" element={<Suspense fallback={<CargaPortal etiqueta="Preparando tu visita…" />}><PortalVisita /></Suspense>} />
            <Route path="cita" element={<Suspense fallback={<CargaPortal etiqueta="Preparando tu visita…" />}><PortalVisita /></Suspense>} />
            {PortalRevisionDemo && <Route path="revision-demo" element={<Suspense fallback={<CargaPortal etiqueta="Abriendo revisión de prueba…" />}><PortalRevisionDemo /></Suspense>} />}
            <Route path="mis-datos" element={<PortalMisDatos />} />
            <Route path="documentos" element={<Suspense fallback={<CargaPortal etiqueta="Abriendo tus documentos…" />}><PortalDocumentos /></Suspense>} />
            <Route path="avisos" element={<PortalAvisos />} />
            <Route path="historial" element={<PortalHistorial />} />
          </Route>
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </FuenteDatosProvider>
  );
}
