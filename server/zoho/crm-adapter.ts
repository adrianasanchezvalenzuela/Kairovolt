import type { PuertoCrm, ReferenciaExterna, ResultadoAsegurar } from '../../src/application/integracion/puertos';
import { ZohoError } from './auth';
import { seg, type ClienteZoho } from './cliente';
import { lista, registro, texto } from './lectura';
import { MAPEO_ZOHO as M, type MapeoZoho } from './mapeo';
import { marcaReferencia, ZohoMapper } from './mapper';

const campos = (c: Record<string, string>): string => Object.values(c).map(encodeURIComponent).join(',');
const sinCampoPropio = 'El folio ya va al inicio del nombre del trato; no hay campo propio configurado (mapeo.folio.campoCrm).';

/** ZohoCRMAdapter: implementa el puerto `PuertoCrm` contra Zoho CRM v6. Los tratos de CRM son los «proyectos» comerciales. */
export function crearCrmAdapter(cli: ClienteZoho, mapeo: MapeoZoho = M): PuertoCrm {
  const d = mapeo.crm.deals;
  const campoFolio = mapeo.folio.campoCrm;

  async function listar(modulo: string, cps: Record<string, string>, extra: string[] = []) {
    const todos = [...Object.values(cps), ...extra].map(encodeURIComponent).join(',');
    const data = registro(await cli.crm('GET', `/crm/v6/${modulo}?fields=${todos}&per_page=200`));
    return lista(data.data);
  }

  const consultarOportunidades = async () =>
    (await listar(d.modulo, d.campos, campoFolio ? [campoFolio] : [])).map((r) => ZohoMapper.oportunidad(r, mapeo));

  return {
    consultarClientes: async () => (await listar(mapeo.crm.accounts.modulo, mapeo.crm.accounts.campos)).map((r) => ZohoMapper.cliente(r, mapeo)),
    consultarContactos: async () => (await listar(mapeo.crm.contacts.modulo, { ...mapeo.crm.contacts.campos, cuenta: 'Account_Name' })).map((r) => ZohoMapper.contacto(r, mapeo)),
    consultarOportunidades,

    async upsertProyecto(p, o): Promise<ResultadoAsegurar> {
      const existente = (await consultarOportunidades()).find((x) => x.folio === p.folio.toUpperCase());
      if (existente) return { id: existente.id, accion: 'sin_cambios', detalle: 'El trato ya existe: no se modifican los datos comerciales.' };

      const peticion = ZohoMapper.cuerpoUpsertDeal(p, mapeo);
      if (!peticion) {
        throw new ZohoError(`No existe un trato con el folio ${p.folio} y la creación de tratos desde KairóVolt no está habilitada (mapeo.crm.deals.crear.etapaInicial).`, undefined, 'validacion');
      }
      if (o.simular) return { id: '(trato nuevo)', accion: 'simulado', detalle: `Se crearía el trato «${p.folio}» (duplicados verificados por ${peticion.verificarDuplicados.join(', ')}).` };

      // El upsert por identificador externo es idempotente: repetirlo tras un corte de red no duplica el trato.
      const res = registro(await cli.crm('POST', `/crm/v6/${d.modulo}/upsert`, { data: [peticion.cuerpo], duplicate_check_fields: peticion.verificarDuplicados }, { idempotente: true }));
      const fila = registro(lista(res.data)[0]);
      const id = texto(registro(fila.details).id);
      if (fila.status !== 'success' || !id) throw new ZohoError('Zoho CRM no confirmó el upsert del trato.', undefined, 'desconocido');
      return { id, accion: fila.action === 'insert' ? 'creado' : 'actualizado' };
    },

    async sincronizarFolio(tratoId, folio, o): Promise<ResultadoAsegurar> {
      if (!campoFolio) return { id: tratoId, accion: 'sin_cambios', detalle: sinCampoPropio };
      const actual = registro(lista(registro(await cli.crm('GET', `/crm/v6/${d.modulo}/${seg(tratoId)}?fields=${encodeURIComponent(campoFolio)}`)).data)[0]);
      if (texto(actual[campoFolio])?.toUpperCase() === folio.toUpperCase()) return { id: tratoId, accion: 'sin_cambios' };
      if (o.simular) return { id: tratoId, accion: 'simulado', detalle: `Se escribiría el folio en ${campoFolio}.` };
      await cli.crm('PUT', `/crm/v6/${d.modulo}/${seg(tratoId)}`, { data: [{ [campoFolio]: folio }] });
      return { id: tratoId, accion: 'actualizado' };
    },

    async registrarReferencia(tratoId, ref: ReferenciaExterna, o): Promise<ResultadoAsegurar> {
      const nc = mapeo.crm.notas.campos;
      const ruta = `/crm/v6/${d.modulo}/${seg(tratoId)}/Notes`;
      const marca = marcaReferencia(ref);
      const existentes = registro(await cli.crm('GET', `${ruta}?fields=${campos({ c: nc.contenido })}&per_page=200`));
      if (lista(existentes.data).some((n) => (texto(n[nc.contenido]) ?? '').includes(marca))) return { id: tratoId, accion: 'sin_cambios', detalle: 'La referencia ya estaba anotada.' };
      if (o.simular) return { id: tratoId, accion: 'simulado', detalle: `Se anotaría ${marca}.` };
      const res = registro(await cli.crm('POST', ruta, { data: [ZohoMapper.notaReferencia(ref, mapeo)] }));
      if (registro(lista(res.data)[0]).status !== 'success') throw new ZohoError('Zoho CRM no confirmó la creación de la nota de referencia.', undefined, 'desconocido');
      return { id: tratoId, accion: 'creado' };
    },
  };
}
