import { describe, expect, it } from 'vitest';
import { proyectoReferenciaMock } from '@/data/proyecto-referencia.mock';
import { catalogoRequisitosBase } from '@/data/catalogo-requisitos.mock';
import { portalClienteMock } from '@/infrastructure/portal-cliente.mock';
import { construirVistaPortal, normalizarFolio } from './portal-cliente';

const hoy = '2026-11-22';
const vista = construirVistaPortal(proyectoReferenciaMock, catalogoRequisitosBase, hoy);

describe('construirVistaPortal', () => {
  it('no filtra información interna', () => {
    const json = JSON.stringify(vista);
    expect(json).not.toMatch(/CS3\.2|CS6\.2|6921|697\.52/); // valores discrepantes
    expect(json).not.toMatch(/Ingeniería IDC|Proyectista|Supervisor de campo|Coordinación administrativa/); // responsables
    expect(json).not.toMatch(/hallazgo|observacion|paer|ppc|discrepancia/i);
    expect(Object.keys(vista).sort()).toEqual(
      ['avance', 'compuertas', 'esMock', 'folio', 'nombre', 'pendientesCliente', 'proximosHitos', 'ubicacion'],
    );
  });

  it('lista solo pendientes que aporta el cliente', () => {
    const titulos = vista.pendientesCliente.map((p) => p.titulo);
    expect(titulos).toContain('Identificación oficial vigente del propietario o representante');
    expect(titulos).not.toContain('Diagrama unifilar (SFV-01)'); // lo aporta IDC
    expect(titulos).not.toContain('Acta constitutiva / acreditación de propiedad o posesión'); // condicional
  });

  it('reporta documentos del cliente vencidos', () => {
    expect(vista.pendientesCliente).toContainEqual(expect.objectContaining({ titulo: 'Recibo CFE', motivo: 'vencido' }));
  });

  it('los hitos excluyen actividades completadas y van ordenados', () => {
    expect(vista.proximosHitos.every((h) => h.estado !== ('completada' as string))).toBe(true);
    const fechas = vista.proximosHitos.map((h) => h.finPlan);
    expect(fechas).toEqual([...fechas].sort());
    expect(vista.proximosHitos.map((h) => h.id)).not.toContain('a1');
  });
});

describe('portalClienteMock', () => {
  it('normaliza el folio y devuelve null si no existe', async () => {
    expect(normalizarFolio('  kv-mock-0001 ')).toBe('KV-MOCK-0001');
    expect((await portalClienteMock.consultar(' kv-mock-0001 ', hoy))?.folio).toBe('KV-MOCK-0001');
    expect(await portalClienteMock.consultar('KV-NO-EXISTE', hoy)).toBeNull();
  });
});
