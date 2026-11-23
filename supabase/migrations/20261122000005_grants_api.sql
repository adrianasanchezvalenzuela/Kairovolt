-- ============================================================
-- KAIROVOLT | MIGRACION 005
-- Permisos (GRANT) para los roles de la API de Supabase
--
-- Los proyectos nuevos de Supabase ya no dan permisos automaticos a
-- anon / authenticated / service_role sobre las tablas de "public".
-- Sin estos GRANT la API responde 42501 "permission denied for table ...",
-- aunque la clave sea correcta.
--
-- Principio: minimo privilegio. Los GRANT de "authenticated" reflejan las
-- politicas RLS de la migracion 003 (el GRANT da acceso a la tabla; RLS decide
-- que filas y que operaciones por rol). "anon" no recibe nada.
-- ============================================================

begin;

grant usage on schema public to service_role, authenticated;

-- ------------------------------------------------------------
-- service_role (backend): acceso total. Ya se salta RLS.
-- ------------------------------------------------------------
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tablas futuras creadas por migraciones (rol que ejecuta las migraciones).
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- ------------------------------------------------------------
-- authenticated (personal de IDC con sesion de Supabase Auth)
-- ------------------------------------------------------------
grant select, insert, update, delete on
    public.proyectos,
    public.sistemas_fotovoltaicos,
    public.documentos,
    public.documento_datos_declarados,
    public.requisitos_documentales,
    public.acuerdos_paer,
    public.perfiles
to authenticated;

-- Decisiones historicas: solo se agregan, no se editan ni se borran.
grant select, insert on
    public.resoluciones_documentales,
    public.aprobaciones_checklist_g2
to authenticated;

-- Auditoria: solo lectura; los eventos se escriben con registrar_evento_auditoria().
grant select on public.auditoria_eventos to authenticated;
grant select on public.v_paer_semanal to authenticated;

-- portal_accesos: sin permisos para authenticated (solo service_role).

-- ------------------------------------------------------------
-- anon: sin acceso a nada.
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

commit;
