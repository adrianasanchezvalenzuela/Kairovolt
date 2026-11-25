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
import { Configuracion } from '@/pages/Configuracion';
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
import { PortalDocumentos } from '@/pages/portal/PortalDocumentos';
import { PortalHistorial } from '@/pages/portal/PortalHistorial';
import { PortalInicio } from '@/pages/portal/PortalInicio';
import { PortalMisDatos } from '@/pages/portal/PortalMisDatos';

/** Galería de componentes: solo en desarrollo (no entra al build de producción). */
const Componentes = import.meta.env.DEV ? lazy(() => import('@/pages/Componentes').then((m) => ({ default: m.Componentes }))) : null;

export function App() {
  return (
    <FuenteDatosProvider>
    <BrowserRouter>
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
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="acceso" element={<Acceso />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="cuenta" element={<Cuenta />} />
          {Componentes && <Route path="componentes" element={<Suspense fallback={null}><Componentes /></Suspense>} />}
          <Route path="restablecer" element={<Restablecer />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
        </Route>
        <Route path="portal" element={<PortalProveedor />}>
          <Route index element={<PortalAcceso />} />
          <Route element={<PortalLayout />}>
            <Route path="inicio" element={<PortalInicio />} />
            <Route path="mis-datos" element={<PortalMisDatos />} />
            <Route path="documentos" element={<PortalDocumentos />} />
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
