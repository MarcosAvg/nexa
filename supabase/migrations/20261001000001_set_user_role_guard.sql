-- Guard anti-lockout para cambio de roles.
--
-- `set_user_role` (SECURITY DEFINER): solo un admin puede cambiar roles y
-- nunca puede dejar al sistema sin administradores (bloquea degradar al
-- último admin). La app debe usar este RPC en lugar del UPDATE directo.

create or replace function public.set_user_role(target_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    caller_role public.app_role;
    target_is_admin boolean;
    admin_count int;
begin
    select p.role into caller_role
    from public.profiles p
    where p.id = auth.uid();

    if caller_role is distinct from 'admin' then
        raise exception 'Solo un administrador puede cambiar roles';
    end if;

    if new_role is distinct from 'admin' then
        select (p.role = 'admin') into target_is_admin
        from public.profiles p
        where p.id = target_id;

        if coalesce(target_is_admin, false) then
            select count(*) into admin_count
            from public.profiles
            where role = 'admin';

            if admin_count <= 1 then
                raise exception 'No se puede degradar al último administrador';
            end if;
        end if;
    end if;

    update public.profiles
    set role = new_role, updated_at = now()
    where id = target_id;
end;
$function$;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
