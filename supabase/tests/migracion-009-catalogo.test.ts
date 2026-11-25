import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../migrations/20261124000009_catalogo_documental_canonico.sql', import.meta.url), 'utf8');

describe('migración 009: catálogo documental', () => {
  it('amplía la tabla existente con el contrato canónico compartido', () => {
    for (const column of ['tipo_documento', 'compuerta', 'canal', 'condiciones_aplicacion', 'requiere_vigencia', 'quien_aporta', 'instrucciones_cliente', 'campos_esperados', 'ejemplos_autorizados', 'generacion_automatica', 'validacion_idc']) {
      expect(sql).toContain(`add column if not exists ${column}`);
    }
  });

  it('conserva relaciones/códigos, no borra filas y deja las equivalencias para validar por IDC', () => {
    expect(sql).toMatch(/validacion_idc\s*=\s*'pendiente'/i);
    expect(sql).toMatch(/on conflict \(codigo\) do nothing/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.requisitos_documentales/i);
    expect(sql).not.toMatch(/drop\s+table\s+public\.requisitos_documentales/i);
  });

  it('deja ejemplos vacíos y la generación automática deshabilitada', () => {
    expect(sql).toMatch(/ejemplos_autorizados\s*,\s*generacion_automatica\s*,\s*validacion_idc/i);
    expect(sql).toMatch(/'\[\]'\s*,\s*'\[\]'\s*,\s*false\s*,\s*'pendiente'/i);
  });
});
