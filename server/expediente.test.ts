import { describe, expect, it, vi } from 'vitest';
import { componerExpediente } from './expediente';
import { crearRutasPortal } from './portal/rutas';
import { crearAccesosMemoria, crearRecepcionesMemoria, almacenDescarte, fuenteDemo } from './portal/memoria';
import { COOKIE_PORTAL, crearSesionesPortal } from './portal/sesion';
import { crearParticipantesSupabase } from './portal/participantes';
import { SupabaseError, type ClienteSupabase } from './supabase/cliente';
import { datosIniciales } from '../src/application/participantes';
import { proyectoReferenciaMock } from '../src/data/proyecto-referencia.mock';
import { firmarArchivo } from './archivos-expediente';
import { supabaseCfg } from './supabase/falso';

const folio = 'KV-2099-88001';
const otro = 'KV-2099-88002';

describe('expediente persistente', () => {
  it('usa el folio operativo y la versión vigente, conserva lo declarado y reconoce revisión pendiente', async () => {
    const d = { id: 'id-v2', nombre_archivo: 'prueba.pdf', mime_type: 'application/pdf', fecha_emision: null, fecha_vigencia: null,
      version: 2, created_at: '2026-11-01', requisitos_documentales: { tipo_documento: 'recibo_cfe' },
      documento_datos_declarados: [{ campo: 'consumo_kwh_mes', declarado: true, valor_texto: '00034.90' }] };
    const rest = vi.fn().mockResolvedValueOnce([{ documentos: [{ ...d, id: 'id-v1', version: 1 }, d], sistemas_fotovoltaicos: null }])
      .mockResolvedValueOnce([{ documento_id: 'croquis', estado: 'recibido' }]);
    const p = { ...proyectoReferenciaMock, folio };
    const v = await componerExpediente({ rest } as unknown as ClienteSupabase, p);
    expect(rest.mock.calls.every((c) => String(c[1]).includes(folio))).toBe(true);
    expect(v.documentos).toEqual([expect.objectContaining({ id: d.id, datos: [{ campo: 'consumo_kwh_mes', valor: '00034.90' }] })]);
    expect(v.compuertas).toBe(p.compuertas);
    expect(v.revisionDocumental).toEqual({ croquis: 'recibido' });
    rest.mockRejectedValueOnce(new Error('Supabase fuera de línea'));
    await expect(componerExpediente({ rest } as unknown as ClienteSupabase, p)).rejects.toThrow('Supabase fuera de línea');
  });

  it('pide firma privada por 60 segundos y codifica la ruta', async () => {
    const fetchFn = vi.fn().mockResolvedValue(Response.json({ signedURL: '/object/sign/expedientes/archivo?token=solo-prueba' }));
    const url = await firmarArchivo(supabaseCfg, fetchFn, folio + '/portal/uuid/archivo con espacio.pdf');
    expect(url).toBe(supabaseCfg.url + '/storage/v1/object/sign/expedientes/archivo?token=solo-prueba');
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('archivo%20con%20espacio.pdf'),
      expect.objectContaining({ body: '{"expiresIn":60}' }));
  });
});

describe('participantes del portal', () => {
  it('exige sesión, permiso y CSRF, y aplica el folio de la sesión al consultar y guardar', async () => {
    const accesos = crearAccesosMemoria(Date.now, false);
    const permisos = { ver_progreso: true, ver_documentos_autorizados: true, subir_documentos: false, editar_participantes: true };
    const { acceso } = await accesos.crear(folio, { permisos, dias: 1, creadoPor: null });
    const sesiones = crearSesionesPortal('prueba-sintetica');
    const cookie = COOKIE_PORTAL + '=' + sesiones.crear({ acceso: acceso.id, folio });
    const rest = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce({ version: 1 })
      .mockRejectedValueOnce(new SupabaseError('conflicto', 409, '40001'));
    const app = crearRutasPortal({
      accesos, fuente: fuenteDemo, recepciones: crearRecepcionesMemoria(Date.now), almacen: almacenDescarte, catalogo: async () => [],
      secreto: 'prueba-sintetica', persistencia: { accesos: 'memoria', archivos: 'no_se_guardan' },
      participantes: crearParticipantesSupabase({ rest } as unknown as ClienteSupabase),
    });
    expect((await app.request('/participantes')).status).toBe(401);
    const cruzada = COOKIE_PORTAL + '=' + sesiones.crear({ acceso: acceso.id, folio: otro });
    expect((await app.request('/participantes', { headers: { Cookie: cruzada } })).status).toBe(401);
    expect((await app.request('/participantes?folio=' + otro, { headers: { Cookie: cookie } })).status).toBe(200);
    expect(rest.mock.calls[0]?.[1]).toContain('proyectos.folio=eq.' + folio);
    const post = (csrf: string) => app.request('/participantes', {
      method: 'POST', headers: { Cookie: cookie, 'x-requested-with': csrf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio: otro, version: 0, datos: { ...datosIniciales, titular: 'Registro sintético' }, confirmado: false }),
    });
    expect((await post('')).status).toBe(403);
    expect((await post('kairovolt')).status).toBe(200);
    expect(rest.mock.calls[1]?.[2]).toMatchObject({ p_folio: folio, p_acceso: acceso.id, p_version: 0 });
    expect((await post('kairovolt')).status).toBe(409);
  });
});
