begin;

create table public.portal_contactos_aviso (
    folio text primary key references public.proyectos(folio),
    correo text not null check (length(correo) <= 254),
    version uuid not null default gen_random_uuid(),
    token_hash text unique check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
    vence_en timestamptz not null,
    verificado_en timestamptz,
    actualizado_en timestamptz not null default now()
);

create table public.portal_cola_correo (
    id uuid primary key default gen_random_uuid(),
    folio text not null references public.proyectos(folio),
    contacto_version uuid not null,
    evento_id bigint unique references public.portal_eventos_documentales(id),
    token text,
    estado text not null default 'pendiente'
        check (estado in ('pendiente','procesando','enviado','fallido')),
    intentos integer not null default 0,
    disponible_en timestamptz not null default now(),
    vence_en timestamptz not null default (now() + interval '18 hours'),
    ultimo_resultado text,
    creado_en timestamptz not null default now()
);
create index portal_cola_correo_pendiente on public.portal_cola_correo(estado,disponible_en);

create table public.portal_intentos_correo (
    id bigint generated always as identity primary key,
    correo_id uuid not null references public.portal_cola_correo(id),
    intento integer not null,
    resultado text not null,
    fecha timestamptz not null default now(),
    unique (correo_id, intento)
);

alter table public.portal_contactos_aviso enable row level security;
alter table public.portal_cola_correo enable row level security;
alter table public.portal_intentos_correo enable row level security;
revoke all on public.portal_contactos_aviso, public.portal_cola_correo, public.portal_intentos_correo
    from public, anon, authenticated, service_role;

create function public.autorizar_correo_portal(p_folio text, p_correo text, p_hash text, p_token text, p_actor uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
    v_version uuid := gen_random_uuid();
begin
    perform 1 from public.proyectos where folio = p_folio and not es_demo for update;
    if not found then return false; end if;

    if exists (select from public.portal_contactos_aviso where folio = p_folio
        and actualizado_en > now() - interval '5 minutes') then
        raise exception using errcode = '40001', message = 'Ya se solicitó una verificación recientemente';
    end if;
    insert into public.portal_contactos_aviso(folio, correo, version, token_hash, vence_en)
    values (p_folio, p_correo, v_version, p_hash, now() + interval '1 hour')
    on conflict (folio) do update set correo = excluded.correo, version = excluded.version,
        token_hash = excluded.token_hash, vence_en = excluded.vence_en, actualizado_en = now(), verificado_en = null;
    insert into public.portal_cola_correo(folio,contacto_version,token,vence_en)
    values (p_folio, v_version, p_token, now() + interval '1 hour');
    insert into public.auditoria_eventos(actor_user_id,origen,entidad,folio,accion,detalles)
    values (p_actor, 'app', 'portal_contacto_aviso', p_folio, 'solicitud_verificacion', '{}');
    return true;
end;
$$;

create function public.verificar_correo_portal(p_hash text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_folio text;
begin
    update public.portal_contactos_aviso set verificado_en = now(), token_hash = null
    where token_hash = p_hash and vence_en > now() and verificado_en is null returning folio into v_folio;
    if not found then return false; end if;
    insert into public.auditoria_eventos(origen,entidad,folio,accion,detalles)
    values ('portal','portal_contacto_aviso',v_folio,'correo_verificado','{}');
    return true;
end;
$$;

create function public.encolar_aviso_documental() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
    if new.tipo in ('recibido','prevalidado','rechazado','entregado','validado_fisico','aceptado') then
        insert into public.portal_cola_correo(folio, contacto_version, evento_id)
        select c.folio, c.version, new.id from public.portal_contactos_aviso c
        where c.folio = new.folio and c.verificado_en is not null
        on conflict (evento_id) do nothing;
    end if;
    return new;
end;
$$;
create trigger encolar_aviso_documental after insert on public.portal_eventos_documentales
for each row execute function public.encolar_aviso_documental();

create function public.tomar_correo_portal()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
    v public.portal_cola_correo;
    v_correo text;
begin
    update public.portal_cola_correo q set estado = 'fallido', token = null, ultimo_resultado = 'caducado'
    where q.estado in ('pendiente','procesando') and q.disponible_en <= now()
      and (q.vence_en <= now() or q.intentos >= 4 or not exists (
        select 1 from public.portal_contactos_aviso c where c.folio = q.folio and c.version = q.contacto_version
          and ((q.evento_id is null and c.verificado_en is null) or (q.evento_id is not null and c.verificado_en is not null))
      ));
    select q.* into v from public.portal_cola_correo q join public.portal_contactos_aviso c
      on c.folio = q.folio and c.version = q.contacto_version
    where q.estado in ('pendiente','procesando') and q.disponible_en <= now()
        and q.vence_en > now() and q.intentos < 4
        and ((q.evento_id is null and c.verificado_en is null) or (q.evento_id is not null and c.verificado_en is not null))
    order by q.disponible_en, q.id limit 1 for update of q skip locked;
    if not found then return null; end if;
    select correo into v_correo from public.portal_contactos_aviso where folio = v.folio and version = v.contacto_version;
    if not found then return null; end if;
    update public.portal_cola_correo set estado = 'procesando', intentos = intentos + 1,
        disponible_en = now() + interval '2 minutes' where id = v.id;
    return jsonb_build_object('id', v.id, 'intento', v.intentos + 1, 'correo', v_correo,
        'token', v.token, 'tipo', (select tipo from public.portal_eventos_documentales where id = v.evento_id));
end;
$$;

create function public.resolver_correo_portal(p_id uuid,p_intento integer,p_resultado text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
    if p_resultado not in ('aceptado','temporal','rechazado') then return; end if;
    update public.portal_cola_correo
    set estado = case when p_resultado = 'aceptado' then 'enviado'
        when p_resultado = 'temporal' and intentos < 4 then 'pendiente' else 'fallido' end,
        disponible_en = now() + make_interval(mins => 5 * intentos),
        ultimo_resultado = p_resultado,
        token = case when p_resultado = 'temporal' and intentos < 4 then token else null end
    where id = p_id and estado = 'procesando' and intentos = p_intento;
    if found then
        insert into public.portal_intentos_correo(correo_id,intento,resultado)
        values (p_id,p_intento,p_resultado) on conflict (correo_id,intento) do nothing;
    end if;
end;
$$;

revoke all on function public.encolar_aviso_documental() from public, anon, authenticated, service_role;
revoke all on function public.autorizar_correo_portal(text,text,text,text,uuid),
    public.verificar_correo_portal(text), public.tomar_correo_portal(), public.resolver_correo_portal(uuid,integer,text)
    from public, anon, authenticated;
grant execute on function public.autorizar_correo_portal(text,text,text,text,uuid),
    public.verificar_correo_portal(text), public.tomar_correo_portal(), public.resolver_correo_portal(uuid,integer,text) to service_role;

commit;
