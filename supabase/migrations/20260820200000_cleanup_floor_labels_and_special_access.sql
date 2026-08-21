-- Data cleanup of legacy floor labels + special-access handling.
--
-- Normalizes personnel floors to each person's legacy building catalog
-- (buildings.floors), which is what the UI still consumes:
--   * PB / Planta baja            -> Planta Baja
--   * Sotano / SOTANO             -> Sotano
--   * "1"                         -> Planta Baja
--   * "13.14"                     -> 13, 14
--   * "General"                   -> all floors of the person's building
--   * "N1/N2/N3 ..." (other building) -> removed (person keeps their card)
--   * "Estacionamiento" (floor)   -> removed and granted as special access
-- After the updates the per-building floors catalog is pruned of labels no
-- longer referenced by any permission nor present in buildings.floors.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: expand/normalize a floor array against a building's canonical list.
--   * 'General'         -> all floors of the building
--   * '13.14'           -> 13 and 14
--   * '1'               -> Planta Baja
--   * 'Estacionamiento' -> dropped (handled as a special access separately)
--   * 'N<digit>...'     -> dropped (belongs to another building)
--   * everything else   -> normalize_floor_label()
-- Preserves first-occurrence order and de-duplicates.
-- ---------------------------------------------------------------------------
create or replace function public.fix_floor_set(p_floors text[], p_all_floors text[])
returns text[]
language sql
immutable
as $function$
select coalesce(array_agg(z.f order by z.ord), '{}'::text[])
from (
    select y.f, min(x.ord) as ord
    from unnest(coalesce(p_floors, '{}'::text[])) with ordinality as x(f, ord)
    cross join lateral unnest(case
        when btrim(x.f) = 'General'         then p_all_floors
        when btrim(x.f) = '13.14'           then array['13', '14']
        when btrim(x.f) = '1'               then array['Planta Baja']
        when btrim(x.f) = 'Estacionamiento' then array[]::text[]
        else array[public.normalize_floor_label(x.f)]
    end) as y(f)
    where btrim(y.f) <> ''
      and not (y.f ~ '^N[0-9]')
    group by y.f
) z;
$function$;

-- ---------------------------------------------------------------------------
-- 1. Normalize floors for every person against their building's legacy catalog
-- ---------------------------------------------------------------------------
update public.personnel p
   set floors_p2000 = public.fix_floor_set(p.floors_p2000, b.all_floors),
       floors_kone  = public.fix_floor_set(p.floors_kone, b.all_floors)
  from (
    select b.id,
           array_agg(distinct public.normalize_floor_label(label) order by public.normalize_floor_label(label)) as all_floors
      from public.buildings b
      cross join lateral unnest(b.floors) as f(label)
     where btrim(label) <> ''
     group by b.id
  ) b
 where b.id = p.building_id;

-- ---------------------------------------------------------------------------
-- 2. "Estacionamiento" used as a floor is really a special access
-- ---------------------------------------------------------------------------
update public.personnel p
   set special_accesses = (
        select array_agg(distinct s)
          from unnest(coalesce(p.special_accesses, '{}'::text[]) || array['Estacionamiento']) as t(s)
       )
 where 'Estacionamiento' = any(p.floors_p2000)
    or 'Estacionamiento' = any(p.floors_kone);

-- ---------------------------------------------------------------------------
-- 3. Drop the temporary helper
-- ---------------------------------------------------------------------------
drop function public.fix_floor_set(text[], text[]);

-- ---------------------------------------------------------------------------
-- 4. Prune the per-building floors catalog of labels no longer in use
--    (mirrors sync_building_floors_to_catalog: drop labels that are neither in
--    buildings.floors nor referenced by a remaining floor permission)
-- ---------------------------------------------------------------------------
delete from public.floors f
 where not exists (
        select 1
          from public.buildings b
         where b.id = f.building_id
           and f.label = any (
                 select public.normalize_floor_label(x)
                   from unnest(b.floors) as t(x)
           )
       )
   and not exists (
        select 1
          from public.access_assignment_permissions p
         where p.resource_type = 'floor'
           and p.building_id = f.building_id
           and p.resource_key = f.label
       );

COMMIT;