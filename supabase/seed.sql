-- ============================================================
-- KAIROVOLT | SEMILLA DE PROYECTOS
-- Solo referencias minimas para enlazar la app con Zoho.
-- No se cargan documentos ni fechas ficticias en expedientes reales.
-- ============================================================

insert into public.proyectos (
    folio,
    es_demo,
    uvie_antes_de_ingreso
)
values
(
    'KV-MOCK-0001',
    true,
    false
),
(
    -- CORRECCION KV: la semilla original ponia true con un argumento sobre fechas de
    -- un "caso real" (dictamen UVIE del 3 de noviembre, solicitud del 5) que no
    -- salio de los datos del proyecto. La regla depende de la Zona de Distribucion
    -- y esta por confirmar con IDC; se deja el valor por defecto (false).
    'KV-2026-004',
    false,
    false
)
on conflict (folio) do update set
    es_demo = excluded.es_demo,
    uvie_antes_de_ingreso = excluded.uvie_antes_de_ingreso;

select folio, es_demo, uvie_antes_de_ingreso, created_at
from public.proyectos
where folio in ('KV-MOCK-0001', 'KV-2026-004')
order by folio;
