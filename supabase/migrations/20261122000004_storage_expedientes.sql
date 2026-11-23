-- ============================================================
-- KAIROVOLT | MIGRACION 004
-- Bucket privado "expedientes" y politicas de Storage
--
-- Ruta de los objetos: <folio>/<documento-uuid>/<archivo>
-- Ejemplo: KV-2026-004/3f2c.../solicitud.pdf
--
-- El portal del cliente NO recibe permisos sobre storage.objects:
-- el backend valida el token y emite una URL firmada de corta duracion.
-- No usar getPublicUrl() ni hacer publico el bucket.
-- ============================================================

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'expedientes',
    'expedientes',
    false,
    20971520,
    array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
on conflict (id) do update set
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: personal activo de IDC.
create policy expedientes_select_staff
on storage.objects
for select
to authenticated
using (
    bucket_id = 'expedientes'
    and public.is_active_staff()
    and exists (
        select 1
        from public.proyectos p
        where p.folio = (storage.foldername(name))[1]
    )
);

-- Carga: personal que participa en la integracion documental.
create policy expedientes_insert_editors
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'expedientes'
    and public.has_any_role(
        array[
            'admin',
            'coordinacion_admin',
            'proyectista',
            'supervisor_campo'
        ]
    )
    and exists (
        select 1
        from public.proyectos p
        where p.folio = (storage.foldername(name))[1]
    )
);

-- Actualizacion de objetos: solo administracion.
-- Para nuevas versiones, preferir una ruta nueva.
create policy expedientes_update_admin
on storage.objects
for update
to authenticated
using (
    bucket_id = 'expedientes'
    and public.has_any_role(array['admin'])
)
with check (
    bucket_id = 'expedientes'
    and public.has_any_role(array['admin'])
);

-- Eliminacion: solo administracion.
create policy expedientes_delete_admin
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'expedientes'
    and public.has_any_role(array['admin'])
);
