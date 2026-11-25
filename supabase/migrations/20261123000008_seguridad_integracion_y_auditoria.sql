-- KAIROVOLT | MIGRACION 008
-- Restringe la lectura de referencias de integracion y endurece la auditoria.
-- El backend usa service_role para insertar eventos directamente; la RPC de
-- cliente no tiene consumidores en esta aplicacion y se revoca.

begin;

-- La bitacora y las referencias solo son visibles para personal activo.
drop policy if exists sincronizaciones_select on public.sincronizaciones;
create policy sincronizaciones_select_staff
on public.sincronizaciones
for select
to authenticated
using (public.is_active_staff());

drop policy if exists referencias_externas_select on public.referencias_externas;
create policy referencias_externas_select_staff
on public.referencias_externas
for select
to authenticated
using (public.is_active_staff());

revoke all on public.sincronizaciones, public.referencias_externas from anon;
grant select on public.sincronizaciones, public.referencias_externas to authenticated;

-- La auditoria es de solo lectura para el personal. El backend conserva INSERT
-- mediante service_role; no necesita UPDATE, DELETE ni TRUNCATE.
revoke all on public.auditoria_eventos from public, anon, authenticated, service_role;
grant select on public.auditoria_eventos to authenticated;
grant select, insert on public.auditoria_eventos to service_role;

revoke all on function public.registrar_evento_auditoria(text, uuid, text, text, jsonb)
from public, anon, authenticated, service_role;

create or replace function public.prevent_audit_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'La auditoria es append-only: no se permite TRUNCATE';
end;
$$;

revoke all on function public.prevent_audit_truncate() from public, anon, authenticated, service_role;

drop trigger if exists auditoria_no_truncate on public.auditoria_eventos;
create trigger auditoria_no_truncate
before truncate on public.auditoria_eventos
for each statement execute function public.prevent_audit_truncate();

comment on table public.auditoria_eventos is
    'Append-only para roles de aplicacion. service_role solo inserta; un propietario/superusuario de PostgreSQL puede alterar el esquema o deshabilitar triggers, por lo que esta tabla no es inmutable frente a administradores de la base.';

commit;
