-- Fase 2: Integridad en BD.
-- CHECK de estados válidos + FKs que faltaban + regla active↔available de access_media.

BEGIN;

-- Estados válidos de access_media
alter table public.access_media
  add constraint access_media_status_check check (status in ('active','available','blocked','inactive'));

alter table public.access_media
  add constraint access_media_programming_status_check check (programming_status in ('pending','done'));

alter table public.access_media
  add constraint access_media_responsiva_status_check check (responsiva_status in ('unsigned','signed','legacy'));

-- Regla de coherencia: una tarjeta activa SIEMPRE tiene persona; disponible NO tiene persona.
alter table public.access_media
  add constraint access_media_status_person_check check (
    (status = 'active' and person_id is not null)
    or (status <> 'active')
  );

alter table public.access_media
  add constraint access_media_available_person_check check (
    (status = 'available' and person_id is null)
    or (status <> 'available')
  );

-- Estados válidos en access_assignments
alter table public.access_assignments
  add constraint access_assignments_status_check check (status in ('active','inactive','revoked'));

-- Estados válidos en tickets
alter table public.tickets
  add constraint tickets_priority_check check (priority is null or priority in ('alta','media','baja'));

alter table public.tickets
  add constraint tickets_status_check check (status in ('pending','in_progress','completed','closed','open','cancelled'));

-- Estados válidos en personnel
alter table public.personnel
  add constraint personnel_status_check check (status in ('active','blocked','inactive','baja'));

-- FK que faltaba: access_assignment_permissions.building_id → buildings
alter table public.access_assignment_permissions
  drop constraint if exists access_assignment_permissions_building_fkey;

alter table public.access_assignment_permissions
  add constraint access_assignment_permissions_building_fkey
  foreign key (building_id) references public.buildings(id) on delete set null;

COMMIT;
