create or replace function public.set_user_role(target_id uuid, new_role public.app_role)
returns void
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
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

revoke all on function "public"."set_user_role"(uuid, "public"."app_role") from public, anon;

grant execute on function "public"."set_user_role"(uuid, "public"."app_role") to "authenticated", "postgres", "service_role";
