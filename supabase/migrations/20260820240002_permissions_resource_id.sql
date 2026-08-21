-- Fase 2: los permisos referencian floors.id / special_accesses.id (referencias
-- estables) además de resource_key (etiqueta desnormalizada, que se elimina en
-- una fase posterior). Así renombrar un piso/acceso no deja permisos huérfanos.

BEGIN;

alter table public.access_assignment_permissions
  add column if not exists floor_id bigint,
  add column if not exists special_access_id bigint;

-- Backfill: piso -> floors.id (por building + label)
update public.access_assignment_permissions p
   set floor_id = f.id
  from public.floors f
 where p.resource_type = 'floor'
   and p.floor_id is null
   and f.building_id = p.building_id
   and f.label = p.resource_key;

-- Backfill: acceso especial -> special_accesses.id (por building + name)
update public.access_assignment_permissions p
   set special_access_id = s.id
  from public.special_accesses s
 where p.resource_type = 'special_access'
   and p.special_access_id is null
   and s.name = p.resource_key
   and (s.building_id = p.building_id or s.building_id is null);

alter table public.access_assignment_permissions
  add constraint access_assignment_permissions_floor_id_fkey
  foreign key (floor_id) references public.floors(id) on delete cascade;

alter table public.access_assignment_permissions
  add constraint access_assignment_permissions_special_access_id_fkey
  foreign key (special_access_id) references public.special_accesses(id) on delete cascade;

create index if not exists idx_access_assignment_permissions_floor_id
  on public.access_assignment_permissions using btree (floor_id);

create index if not exists idx_access_assignment_permissions_special_access_id
  on public.access_assignment_permissions using btree (special_access_id);

COMMIT;