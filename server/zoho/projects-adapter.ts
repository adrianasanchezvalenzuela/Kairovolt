import type { DependenciaTarea, PuertoGestionProyectos, ResultadoAsegurar } from '../../src/application/integracion/puertos';
import { ZohoError } from './auth';
import { seg, type ClienteZoho } from './cliente';
import { registro, texto } from './lectura';
import { MAPEO_ZOHO as M, type MapeoZoho } from './mapeo';
import { ZohoMapper } from './mapper';

const FORMA_INESPERADA = 'Zoho Projects no devolvió el id del objeto creado.';

/** ZohoProjectsAdapter: implementa `PuertoGestionProyectos` contra Zoho Projects v3. Cada proyecto se identifica por su folio (inicio del nombre). */
export function crearProjectsAdapter(cli: ClienteZoho, mapeo: MapeoZoho = M): PuertoGestionProyectos {
  const base = (): string => {
    if (!cli.portalId) throw new ZohoError('Falta ZOHO_PROJECTS_PORTAL_ID.', undefined, 'validacion');
    return `/api/v3/portal/${seg(cli.portalId)}`;
  };
  const ruta = (proyectoId: string, resto = '') => `${base()}/projects/${seg(proyectoId)}${resto}`;
  const tareasDe = async (proyectoId: string) => ZohoMapper.listaProjects(await cli.projects('GET', `${ruta(proyectoId, '/tasks')}?index=1&range=100`), 'tasks');

  const tareaExistente = async (proyectoId: string, clave: string) => {
    const raw = (await tareasDe(proyectoId)).find((t) => ZohoMapper.estadoTarea(t, mapeo).clave === clave);
    return raw ? { raw, estado: ZohoMapper.estadoTarea(raw, mapeo) } : null;
  };

  return {
    soportaDependencias: mapeo.projects.escritura.dependenciasHabilitadas,

    async asegurarProyecto(p, o): Promise<ResultadoAsegurar> {
      const proyectos = ZohoMapper.listaProjects(await cli.projects('GET', `${base()}/projects?index=1&range=100`), 'projects');
      const campo = mapeo.projects.proyectos.campos;
      const hallado = proyectos.find((r) => (mapeo.folio.patronEnNombre.exec(texto(r[campo.nombre]) ?? '')?.[1] ?? '').toUpperCase() === p.folio.toUpperCase());
      if (hallado) return { id: texto(hallado[campo.id]) ?? '', accion: 'sin_cambios', detalle: 'El proyecto ya existe: se reutiliza.' };
      if (o.simular) return { id: '(proyecto nuevo)', accion: 'simulado', detalle: `Se crearía el proyecto «${p.folio}».` };
      const id = ZohoMapper.idCreado(await cli.projects('POST', `${base()}/projects`, ZohoMapper.cuerpoProyecto(p)), 'projects');
      if (!id) throw new ZohoError(FORMA_INESPERADA, undefined, 'desconocido');
      return { id, accion: 'creado' };
    },

    async asegurarListaTareas(proyectoId, nombre, o): Promise<ResultadoAsegurar> {
      const listas = ZohoMapper.listaProjects(await cli.projects('GET', `${ruta(proyectoId, '/tasklists')}?index=1&range=100`), 'tasklists');
      const hallada = listas.find((l) => (texto(l.name) ?? '').toLowerCase() === nombre.toLowerCase());
      if (hallada) return { id: texto(hallada.id) ?? '', accion: 'sin_cambios' };
      if (o.simular) return { id: '(lista nueva)', accion: 'simulado', detalle: `Se crearía la lista «${nombre}».` };
      const id = ZohoMapper.idCreado(await cli.projects('POST', ruta(proyectoId, '/tasklists'), ZohoMapper.cuerpoLista(nombre)), 'tasklists');
      if (!id) throw new ZohoError(FORMA_INESPERADA, undefined, 'desconocido');
      return { id, accion: 'creado' };
    },

    async asegurarTarea(proyectoId, listaId, _folio, t, o): Promise<ResultadoAsegurar> {
      const existente = await tareaExistente(proyectoId, t.clave);
      if (!existente) {
        if (o.simular) return { id: '(tarea nueva)', accion: 'simulado', detalle: `Se crearía la tarea de ${t.clave}.` };
        const id = ZohoMapper.idCreado(await cli.projects('POST', ruta(proyectoId, '/tasks'), ZohoMapper.cuerpoTarea(t, listaId, mapeo)), 'tasks');
        if (!id) throw new ZohoError(FORMA_INESPERADA, undefined, 'desconocido');
        return { id, accion: 'creado' };
      }
      // Existe: solo se sincronizan las fechas que KairóVolt define y que cambiaron. El estado de la tarea no se toca.
      const cambio = (t.inicioPlan !== null && t.inicioPlan !== existente.estado.inicioPlan) || (t.finPlan !== null && t.finPlan !== existente.estado.finPlan);
      if (!cambio) return { id: existente.estado.id, accion: 'sin_cambios' };
      if (o.simular) return { id: existente.estado.id, accion: 'simulado', detalle: 'Se actualizarían las fechas de la tarea.' };
      await cli.projects('PATCH', ruta(proyectoId, `/tasks/${seg(existente.estado.id)}`), ZohoMapper.parcheFechas(t, mapeo));
      return { id: existente.estado.id, accion: 'actualizado' };
    },

    async asignarResponsable(proyectoId, tareaId, correo, o): Promise<ResultadoAsegurar> {
      const usuarios = ZohoMapper.listaProjects(await cli.projects('GET', `${base()}/users?index=1&range=200`), 'users');
      const usuario = usuarios.find((u) => (texto(u.email) ?? '').toLowerCase() === correo.toLowerCase());
      const zpuid = texto(usuario?.zpuid) ?? texto(usuario?.id);
      if (!zpuid) throw new ZohoError('No hay un usuario con ese correo en el portal de Zoho Projects.', undefined, 'validacion');
      const tarea = registro((await tareasDe(proyectoId)).find((t) => texto(t.id) === tareaId));
      const actual = registro(tarea.owners_and_work).owners;
      if (Array.isArray(actual) && actual.some((u) => texto(registro(u).zpuid) === zpuid)) return { id: tareaId, accion: 'sin_cambios' };
      if (o.simular) return { id: tareaId, accion: 'simulado', detalle: 'Se asignaría el responsable.' };
      await cli.projects('PATCH', ruta(proyectoId, `/tasks/${seg(tareaId)}`), ZohoMapper.cuerpoResponsable(zpuid));
      return { id: tareaId, accion: 'actualizado' };
    },

    async consultarEstados(proyectoId) {
      return (await tareasDe(proyectoId)).map((t) => ZohoMapper.estadoTarea(t, mapeo));
    },

    async administrarDependencias(proyectoId, dependencias: DependenciaTarea[], o): Promise<ResultadoAsegurar> {
      if (!mapeo.projects.escritura.dependenciasHabilitadas) return { id: proyectoId, accion: 'sin_cambios', detalle: 'Dependencias no habilitadas (mapeo.projects.escritura.dependenciasHabilitadas).' };
      if (o.simular) return { id: proyectoId, accion: 'simulado', detalle: `Se enlazarían ${dependencias.length} dependencia(s).` };
      for (const d of dependencias) await cli.projects('PATCH', ruta(proyectoId, `/tasks/${seg(d.tareaId)}`), ZohoMapper.cuerpoDependencia(d.predecesoraId));
      return { id: proyectoId, accion: 'actualizado' };
    },
  };
}
