import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../migrations/20261123000008_seguridad_integracion_y_auditoria.sql', import.meta.url), 'utf8');

describe('migración 008: regresiones estáticas de seguridad', () => {
  it('restringe las políticas de integración a personal activo', () => {
    expect(sql).toMatch(/create policy sincronizaciones_select_staff[\s\S]*?using\s*\(public\.is_active_staff\(\)\)/i);
    expect(sql).toMatch(/create policy referencias_externas_select_staff[\s\S]*?using\s*\(public\.is_active_staff\(\)\)/i);
    expect(sql).toMatch(/revoke all on public\.sincronizaciones, public\.referencias_externas from anon/i);
  });

  it('revoca la RPC para roles de aplicación y mantiene INSERT exclusivo del backend', () => {
    expect(sql).toMatch(/revoke all on function public\.registrar_evento_auditoria[\s\S]*?from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/revoke all on public\.auditoria_eventos from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant select, insert on public\.auditoria_eventos to service_role/i);
  });

  it('protege TRUNCATE con privilegio y trigger, documentando el límite de propietarios', () => {
    expect(sql).toMatch(/create trigger auditoria_no_truncate\s+before truncate on public\.auditoria_eventos/i);
    expect(sql).toMatch(/no se permite TRUNCATE/i);
    expect(sql).toMatch(/propietario\/superusuario/i);
  });
});
