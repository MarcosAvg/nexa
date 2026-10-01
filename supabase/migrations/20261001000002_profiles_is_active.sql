-- Desactivación de usuarios + enforcement a nivel de BD.
--
-- 1) `profiles.is_active` (default true).
-- 2) `set_user_role` ahora cuenta solo admins ACTIVOS.
-- 3) `set_user_active` (SECURITY DEFINER, solo admins, no deja sin admins activos).
-- 4) `current_user_is_active()` + UNA policy RESTRICTIVE por tabla: los
--    usuarios inactivos no leen ni escriben nada (las policies permisivas
--    existentes quedan intactas).

BEGIN;

alter table public.profiles
  add column if not exists "is_active" boolean not null default true;

create or replace function public.set_user_role(target_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    caller_role public.app_role;
    target_is_active_admin boolean;
    active_admin_count int;
begin
    select p.role into caller_role
    from public.profiles p
    where p.id = auth.uid();

    if caller_role is distinct from 'admin' then
        raise exception 'Solo un administrador puede cambiar roles';
    end if;

    if new_role is distinct from 'admin' then
        select (p.role = 'admin' and p.is_active) into target_is_active_admin
        from public.profiles p
        where p.id = target_id;

        if coalesce(target_is_active_admin, false) then
            select count(*) into active_admin_count
            from public.profiles
            where role = 'admin' and is_active;

            if active_admin_count <= 1 then
                raise exception 'No se puede degradar al último administrador';
            end if;
        end if;
    end if;

    update public.profiles
    set role = new_role, updated_at = now()
    where id = target_id;
end;
$function$;

create or replace function public.set_user_active(target_id uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    caller_role public.app_role;
    active_admin_count int;
begin
    select p.role into caller_role
    from public.profiles p
    where p.id = auth.uid();

    if caller_role is distinct from 'admin' then
        raise exception 'Solo un administrador puede cambiar el estado de usuarios';
    end if;

    if not active then
        perform 1
        from public.profiles
        where id = target_id and role = 'admin' and is_active;

        if found then
            select count(*) into active_admin_count
            from public.profiles
            where role = 'admin' and is_active;

            if active_admin_count <= 1 then
                raise exception 'No se puede desactivar al último administrador activo';
            end if;
        end if;
    end if;

    update public.profiles
    set is_active = active, updated_at = now()
    where id = target_id;
end;
$function$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select p.is_active from public.profiles p where p.id = auth.uid()), false)
$$;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
revoke all on function public.set_user_active(uuid, boolean) from public, anon;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
-- El helper se evalúa dentro de policies RLS (incluido rol anon):
-- debe ser ejecutable por todos para denegar limpio en vez de error.
grant execute on function public.current_user_is_active() to public;

create policy "Active users only" on "public"."access_assignment_permissions" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."access_assignments" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."access_media" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."access_media_type_buildings" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."access_media_types" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."app_settings" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."buildings" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."cardless_registry" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."dependencies" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."document_templates" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."enlaces" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."floors" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."history_logs" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."personnel" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."profiles" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."schedules" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."signed_documents" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."special_accesses" as restrictive for all to public using (public.current_user_is_active());
create policy "Active users only" on "public"."tickets" as restrictive for all to public using (public.current_user_is_active());

COMMIT;
