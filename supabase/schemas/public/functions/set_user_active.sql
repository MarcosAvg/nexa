create or replace function public.set_user_active(target_id uuid, active boolean)
returns void
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
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

revoke all on function "public"."set_user_active"(uuid, boolean) from public, anon;

grant execute on function "public"."set_user_active"(uuid, boolean) to "authenticated", "postgres", "service_role";
