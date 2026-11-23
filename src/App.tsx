import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { FuenteDatosProvider } from '@/hooks/FuenteDatos';
import { Acceso } from '@/pages/Acceso';
import { PanelInterno } from '@/pages/PanelInterno';
import { ProyectoDetalle } from '@/pages/ProyectoDetalle';
import { PortalAcceso } from '@/pages/PortalAcceso';
import { PortalProyecto } from '@/pages/PortalProyecto';

export function App() {
  return (
    <FuenteDatosProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<PanelInterno />} />
          <Route path="acceso" element={<Acceso />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
        </Route>
        <Route path="portal" element={<PortalLayout />}>
          <Route index element={<PortalAcceso />} />
          <Route path=":folio" element={<PortalProyecto />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </FuenteDatosProvider>
  );
}
