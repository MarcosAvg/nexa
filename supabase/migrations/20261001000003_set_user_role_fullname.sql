-- Fix recursión en UPDATE de profiles + consolidar guardado en el RPC.
--
-- 1) `current_user_is_active()` pasa a plpgsql (las funciones SQL son
--    inlinables en la evaluación de policies; plpgsql no).
-- 2) `set_user_role` acepta `p_full_name` opcional para que el cliente no
--    emita UPDATEs directos sobre profiles (se elimina la firma de 2 args).

BEGIN;

drop function if exists public.set_user_role(uuid, public.app_role);

create or replace function public.set_user_role(
    target_id uuid,
    new_role public.app_role,
    p_full_name text default null
)
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
    set role = new_role,
        full_name = coalesce(p_full_name, public.profiles.full_name),
        updated_at = now()
    where id = target_id;
end;
$function$;

revoke all on function public.set_user_role(uuid, public.app_role, text) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role, text) to authenticated;

create or replace function public.current_user_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
    v_active boolean;
begin
    select p.is_active into v_active
    from public.profiles p
    where p.id = auth.uid();

    return coalesce(v_active, false);
end;
$function$;

grant execute on function public.current_user_is_active() to public;

COMMIT;
