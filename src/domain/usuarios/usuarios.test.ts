import { describe, expect, it } from 'vitest';
import { generarContrasena, normalizarCorreo, validarContrasena } from './credenciales';
import { puede } from './permisos';
import { esRolUsuario, ROLES_USUARIO } from './rol';

describe('validarContrasena', () => {
  it('exige 12+ caracteres, letras y números', () => {
    expect(validarContrasena('corta1')).toMatch(/al menos 12/);
    expect(validarContrasena('sololetrasmuylarga')).toMatch(/letras y números/);
    expect(validarContrasena('123456789012')).toMatch(/letras y números/);
    expect(validarContrasena('x'.repeat(73) + '1')).toMatch(/72/);
    expect(validarContrasena('Una-clave-larga-2026')).toBeNull();
  });
});

describe('normalizarCorreo', () => {
  it('normaliza y rechaza lo que no parece un correo', () => {
    expect(normalizarCorreo('  Ana.Perez@IDC.mx ')).toBe('ana.perez@idc.mx');
    expect(normalizarCorreo('sin-arroba')).toBeNull();
    expect(normalizarCorreo('a b@c.mx')).toBeNull();
    expect(normalizarCorreo('a@b')).toBeNull();
  });
});

describe('generarContrasena', () => {
  const secuencial = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256);

  it('genera la longitud pedida y cumple la validación', () => {
    const c = generarContrasena(secuencial, 16);
    expect(c).toHaveLength(16);
    expect(validarContrasena(c)).toBeNull();
  });
  it('no usa caracteres ambiguos', () => {
    for (let s = 0; s < 50; s++) {
      const c = generarContrasena((n) => Uint8Array.from({ length: n }, (_, i) => (i * (s + 3) + s) % 256), 20);
      expect(c).not.toMatch(/[0OIl1]/);
    }
  });
  it('garantiza letras y números aunque la fuente solo produzca letras (y no se cuelga)', () => {
    const soloLetras = (n: number) => new Uint8Array(n).fill(2);
    const c = generarContrasena(soloLetras, 14);
    expect(c).toHaveLength(14);
    expect(validarContrasena(c)).toBeNull();
  });
  it('falla de forma explícita si la fuente no entrega bytes utilizables', () => {
    expect(() => generarContrasena((n) => new Uint8Array(n).fill(255), 12)).toThrow(/fuente aleatoria/);
  });
});

describe('roles', () => {
  it('son los 5 del esquema de Supabase', () => {
    expect(ROLES_USUARIO.map((r) => r.valor)).toEqual(['admin', 'coordinacion_admin', 'proyectista', 'supervisor_campo', 'consulta']);
    expect(esRolUsuario('admin')).toBe(true);
    expect(esRolUsuario('root')).toBe(false);
  });
});

describe('permisos', () => {
  it('todos los roles ven datos; solo admin gestiona usuarios y descubre Zoho', () => {
    for (const r of ROLES_USUARIO) expect(puede(r.valor, 'ver_datos')).toBe(true);
    expect(ROLES_USUARIO.filter((r) => puede(r.valor, 'gestionar_usuarios')).map((r) => r.valor)).toEqual(['admin']);
    expect(ROLES_USUARIO.filter((r) => puede(r.valor, 'descubrir_zoho')).map((r) => r.valor)).toEqual(['admin']);
  });
  it('escribir en Zoho: admin, coordinación y proyectista; no supervisor ni consulta', () => {
    expect(ROLES_USUARIO.filter((r) => puede(r.valor, 'sincronizar_zoho')).map((r) => r.valor)).toEqual(['admin', 'coordinacion_admin', 'proyectista']);
  });
  it('sin rol no se puede nada', () => {
    expect(puede(null, 'ver_datos')).toBe(false);
    expect(puede(undefined, 'sincronizar_zoho')).toBe(false);
  });
});
