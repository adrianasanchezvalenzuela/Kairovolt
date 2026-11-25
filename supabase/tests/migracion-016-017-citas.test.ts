import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql16 = readFileSync(resolve('supabase/migrations/20261125000016_aportacion_documental_y_visita.sql'), 'utf8');
const sql17 = readFileSync(resolve('supabase/migrations/20261125000017_citas_agenda_y_notificaciones.sql'), 'utf8');

describe('migraciones 016 y 017: aportación documental, checklist de visita y citas', () => {
  it('016 separa emisor de aportación, protege portal_visita_checklist con RLS y audita escrituras', () => {
    expect(sql16).toContain('add column if not exists emisor_documento');
    expect(sql16).toContain('add column if not exists categoria_portal');
    expect(sql16).toContain('add column if not exists requiere_entrega_fisica');
    expect(sql16).toContain('alter table public.portal_visita_checklist enable row level security');
    expect(sql16).toContain('revoke all on public.portal_visita_checklist from public, anon, authenticated, service_role');
    expect(sql16).toContain('create or replace function public.guardar_checklist_visita_portal');
    expect(sql16).toContain('set search_path = \'\'');
    expect(sql16).toContain('insert into public.auditoria_eventos');
  });

  it('017 incluye exclusión real de traslapes en Postgres, idempotencia, RLS y no publica agenda falsa por defecto', () => {
    expect(sql17).toContain('create extension if not exists btree_gist');
    expect(sql17).toContain('disponibilidad_publicada boolean not null default false');
    expect(sql17).toContain('constraint portal_citas_sin_traslape exclude using gist');
    expect(sql17).toContain('idempotency_key text unique');
    expect(sql17).toContain('portal_citas_activa_proyecto_tipo_idx');
    expect(sql17).toContain('alter table public.portal_citas enable row level security');
    expect(sql17).toContain('alter table public.portal_citas_historial enable row level security');
    expect(sql17).toContain('alter table public.portal_agenda_config enable row level security');
    expect(sql17).toContain('cita_confirmada');
    expect(sql17).toContain('cita_propuesta_horario');
    expect(sql17).not.toMatch(/insert into public\.portal_entregas_fisicas/i);
  });
});
