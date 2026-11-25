import { describe, expect, it, vi } from 'vitest';
import { leerCatalogoSupabase } from './catalogo';
import type { ClienteSupabase } from './supabase/cliente';

describe('repositorio backend del catálogo', () => {
  it('consulta solo registros activos cuando se solicita catálogo de operación', async () => {
    const rest = vi.fn().mockResolvedValue([]);
    await leerCatalogoSupabase({ rest } as unknown as ClienteSupabase);
    expect(rest).toHaveBeenCalledWith('GET', expect.stringContaining('&activo=eq.true'));
  });

  it('no convierte errores reales de Supabase en datos mock', async () => {
    const error = new Error('Supabase no disponible');
    const rest = vi.fn().mockRejectedValue(error);
    await expect(leerCatalogoSupabase({ rest } as unknown as ClienteSupabase)).rejects.toBe(error);
  });

  it('el catálogo administrativo también puede consultar filas inactivas para no perderlas del panel', async () => {
    const rest = vi.fn().mockResolvedValue([]);
    await leerCatalogoSupabase({ rest } as unknown as ClienteSupabase, false);
    expect(rest).toHaveBeenCalledWith('GET', expect.not.stringContaining('activo=eq.true'));
  });
});
