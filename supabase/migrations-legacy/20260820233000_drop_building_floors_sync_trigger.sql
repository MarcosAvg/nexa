-- Elimina la sincronización automática buildings.floors -> floors.
-- A partir de este cambio, la app escribe la tabla floors directamente
-- (doble escritura temporal en catalogs.ts saveBuilding) y el array
-- buildings.floors deja de depender de un trigger.

BEGIN;

drop trigger if exists trigger_sync_building_floors on public.buildings;
drop function if exists public.sync_building_floors_to_catalog();

-- El trigger eliminado también limpiaba las filas de floors al borrar un
-- edificio. Se replica ese comportamiento con ON DELETE CASCADE.
alter table public.floors drop constraint if exists floors_building_id_fkey;
alter table public.floors add constraint floors_building_id_fkey
  foreign key (building_id) references public.buildings(id) on delete cascade;

COMMIT;