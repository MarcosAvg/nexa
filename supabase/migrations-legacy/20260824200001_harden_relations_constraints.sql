-- Prioridad 1: endurecer la integridad del modelo (relaciones medio-edificio).
-- 1) Unicidad global de access_media_types.key.
-- 2) FK document_templates.media_type_id -> access_media_types.
-- 3) FK access_assignments.access_media_id -> access_media.
-- 4) Consistencia de access_assignment_permissions con resource_type.
-- 5) Validación de app_settings (numéricos y rangos) a nivel de columna + RPC de escritura.

BEGIN;

-- 1. Unicidad global de la clave de medio.
create unique index if not exists access_media_types_key_unique on public.access_media_types using btree ("key");

-- 2. FK de la plantilla al tipo de medio concreto.
alter table public.document_templates
  drop constraint if exists document_templates_media_type_id_fkey;
alter table public.document_templates
  add constraint document_templates_media_type_id_fkey
  foreign key (media_type_id) references public.access_media_types("id") on delete set null;

-- 3. FK de la asignación al medio concreto.
alter table public.access_assignments
  drop constraint if exists access_assignments_access_media_id_fkey;
alter table public.access_assignments
  add constraint access_assignments_access_media_id_fkey
  foreign key (access_media_id) references public.access_media("id") on delete set null;

-- 4. Consistencia de resource_type con los ids.
alter table public.access_assignment_permissions
  drop constraint if exists access_assignment_permissions_resource_check;
alter table public.access_assignment_permissions
  add constraint access_assignment_permissions_resource_check
  check (
    (resource_type = 'floor' and floor_id is not null and special_access_id is null)
    or (resource_type = 'special_access' and special_access_id is not null and floor_id is null)
  );

COMMIT;