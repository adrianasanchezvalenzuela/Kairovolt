import { randomUUID } from 'node:crypto';
import type { DependenciasSincronizacion } from '../../src/application/integracion/sincronizar-proyecto';
import type { ClienteSupabase } from '../supabase/cliente';
import type { ClienteZoho } from '../zoho/cliente';
import { crearCrmAdapter } from '../zoho/crm-adapter';
import { crearProjectsAdapter } from '../zoho/projects-adapter';
import { crearWorkDriveAdapter } from '../zoho/workdrive-adapter';
import { crearAdaptadoresDemo } from './demo';
import { crearReferenciasMemoria, crearRegistroMemoria } from './memoria';
import { crearReferenciasSupabase, crearRegistroSupabase } from './supabase';

export interface Integracion {
  /** `real` = habla con Zoho; `demo` = solo memoria, NO conectado. */
  modo: 'real' | 'demo';
  /** Texto para mostrar tal cual en pantalla. */
  etiqueta: string;
  persistencia: 'supabase' | 'memoria';
  servicios: { crm: boolean; projects: boolean; workdrive: boolean };
  deps: DependenciasSincronizacion;
}

export interface OpcionesFabrica {
  cli: ClienteZoho | null;
  sb: ClienteSupabase | null;
  workdriveRootId: string | null;
  ahora?: () => string;
  nuevoId?: () => string;
}

/**
 * Elige los adaptadores. Con credenciales de Zoho: reales (OAuth). Sin ellas: DEMO (memoria), con la etiqueta «DEMO — NO CONECTADO»;
 * nunca se finge una conexión. El registro y las referencias van a Supabase si está configurado; si no, a memoria (se pierden al reiniciar).
 */
export function crearIntegracion(o: OpcionesFabrica): Integracion {
  const persistencia = o.sb ? 'supabase' : 'memoria';
  const registro = o.sb ? crearRegistroSupabase(o.sb) : crearRegistroMemoria();
  const referencias = o.sb ? crearReferenciasSupabase(o.sb) : crearReferenciasMemoria();
  const comunes = { registro, referencias, ahora: o.ahora ?? (() => new Date().toISOString()), nuevoId: o.nuevoId ?? randomUUID };

  if (!o.cli) {
    const demo = crearAdaptadoresDemo();
    return {
      modo: 'demo', etiqueta: 'DEMO — NO CONECTADO A ZOHO (no se escribe nada en Zoho)', persistencia, servicios: { crm: false, projects: false, workdrive: false },
      deps: { crm: demo.crm, proyectos: demo.proyectos, archivos: demo.archivos, ...comunes },
    };
  }
  return {
    modo: 'real', etiqueta: 'CONECTADO A ZOHO', persistencia,
    servicios: { crm: true, projects: o.cli.portalId !== null, workdrive: o.workdriveRootId !== null },
    deps: { crm: crearCrmAdapter(o.cli), proyectos: crearProjectsAdapter(o.cli), archivos: crearWorkDriveAdapter(o.cli, o.workdriveRootId), ...comunes },
  };
}
