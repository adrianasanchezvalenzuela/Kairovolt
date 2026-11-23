import type { EstadoCompuerta } from '../../src/domain/compuertas/compuerta';

/**
 * MAPEO KairóVolt ⇄ Zoho. Es el ÚNICO archivo que hay que editar para adaptar nombres de módulos y campos
 * (por ejemplo, cuando IDC use campos personalizados). Los valores son los `api_name` estándar de Zoho.
 * Los nombres estándar están tomados de la documentación de Zoho; verifícalos con
 * GET /api/admin/zoho/modulos y revisando el trato de prueba antes de depender de ellos.
 */

export interface EstadoTareaZoho {
  /** Nombres de estado de tarea en Zoho Projects que equivalen a este estado de compuerta (sin distinguir mayúsculas). */
  nombres: string[];
  /** ID del estado en Zoho Projects. null = se intenta aprender de otra tarea que ya tenga ese estado. */
  id: string | null;
}

export interface MapeoZoho {
  /** Zona horaria con la que se convierten las marcas de tiempo de Zoho (vienen en UTC) a fecha local. */
  zonaHoraria: string;
  folio: {
    /** api_name de un campo personalizado de CRM con el folio KV. null = se extrae del nombre del trato/proyecto. */
    campoCrm: string | null;
    /** Cómo se reconoce el folio al inicio del nombre ("KV-2026-004 - Interconexión FV 40 kW"). */
    patronEnNombre: RegExp;
  };
  crm: {
    deals: { modulo: string; campos: { nombre: string; etapa: string; cuenta: string; contacto: string; descripcion: string; fechaCierre: string } };
    accounts: { modulo: string; campos: { nombre: string; telefono: string; ciudad: string; estado: string } };
    contacts: { modulo: string; campos: { nombre: string; correo: string; telefono: string } };
    /** Notas del trato donde se registran las observaciones sincronizadas. */
    notas: { campos: { titulo: string; contenido: string } };
  };
  projects: {
    proyectos: { campos: { id: string; nombre: string; estado: string } };
    tareas: {
      campos: { id: string; nombre: string; estado: string; inicioPlan: string; finPlan: string; finReal: string };
      /** Una tarea representa una compuerta si su nombre empieza así ("G1 - Acopio ..."). */
      patronCompuerta: RegExp;
    };
    estadosCompuerta: Record<EstadoCompuerta, EstadoTareaZoho>;
    /** Cuerpo del PATCH que cambia el estado de una tarea. Ajustar si la API de Projects de tu cuenta difiere. */
    cuerpoCambioEstado: (idEstado: string) => Record<string, unknown>;
  };
}

export const MAPEO_ZOHO: MapeoZoho = {
  zonaHoraria: 'America/Hermosillo',
  folio: {
    campoCrm: null,
    patronEnNombre: /^(KV-\d{4}-\d{3,})/i,
  },
  crm: {
    deals: {
      modulo: 'Deals',
      campos: { nombre: 'Deal_Name', etapa: 'Stage', cuenta: 'Account_Name', contacto: 'Contact_Name', descripcion: 'Description', fechaCierre: 'Closing_Date' },
    },
    accounts: {
      modulo: 'Accounts',
      campos: { nombre: 'Account_Name', telefono: 'Phone', ciudad: 'Billing_City', estado: 'Billing_State' },
    },
    contacts: {
      modulo: 'Contacts',
      campos: { nombre: 'Full_Name', correo: 'Email', telefono: 'Phone' },
    },
    notas: { campos: { titulo: 'Note_Title', contenido: 'Note_Content' } },
  },
  projects: {
    proyectos: { campos: { id: 'id', nombre: 'name', estado: 'status' } },
    tareas: {
      campos: { id: 'id', nombre: 'name', estado: 'status', inicioPlan: 'start_date', finPlan: 'end_date', finReal: 'completed_on' },
      patronCompuerta: /^(G[0-3])\b/i,
    },
    estadosCompuerta: {
      // IDs de la cuenta Zoho de prueba (portal kairovolt), vistos en estadoZohoId de /api/admin/zoho/proyectos.
      pendiente: { nombres: ['Open', 'Not Started', 'To Do'], id: '2732681000000016068' },
      en_revision: { nombres: ['In Progress', 'In Review'], id: '2732681000000031001' },
      liberada: { nombres: ['Closed', 'Completed', 'Done'], id: '2732681000000016071' },
      bloqueada: { nombres: ['On Hold', 'Blocked'], id: null },
    },
    cuerpoCambioEstado: (idEstado) => ({ status: { id: idEstado } }),
  },
};
