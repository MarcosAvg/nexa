create or replace function public.sync_building_floors_to_catalog()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
    if TG_OP = 'DELETE' then
        delete from public.floors where building_id = OLD.id;
        return OLD;
    end if;

    delete from public.floors f
     where f.building_id = NEW.id
       and f.label <> all (select public.normalize_floor_label(x) from unnest(NEW.floors) as t(x))
       and not exists (
            select 1 from public.access_assignment_permissions p
            where p.resource_type = 'floor'
              and p.building_id = NEW.id
              and p.resource_key = f.label
       );

    insert into public.floors (building_id, label, sort_order)
    select NEW.id, public.normalize_floor_label(f.label),
           case
             when lower(public.normalize_floor_label(f.label)) in ('sótano', 'sotano') then -2
             when lower(public.normalize_floor_label(f.label)) = 'planta baja'         then -1
             when public.normalize_floor_label(f.label) ~ '^[0-9]+$'                   then public.normalize_floor_label(f.label)::int
             else 0
           end
    from unnest(NEW.floors) as f(label)
    where btrim(f.label) <> ''
    on conflict (building_id, label) do update
      set sort_order = excluded.sort_order;

    return NEW;
end;
$function$;

grant execute on function public.sync_building_floors_to_catalog() to postgres, service_role;

revoke all on function public.sync_building_floors_to_catalog() from public;

revoke execute on function public.sync_building_floors_to_catalog() from authenticated;

revoke execute on function public.sync_building_floors_to_catalog() from anon;