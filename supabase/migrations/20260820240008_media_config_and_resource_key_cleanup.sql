-- Pasos 3 y 5: limpieza del catálogo de medios y del modelo de permisos.
-- 1) access_media_types: se conservan requires_responsiva (alerta de registro
--    sin tarjeta) y requires_programming (ticket de programación condicional);
--    el resto de columnas sin consumo se eliminan.
-- 2) access_assignment_permissions: resource_key (etiqueta textual) deja de
--    existir — la referencia es floor_id / special_access_id; el label se
--    obtiene por join con floors / special_accesses.

BEGIN;

alter table public.access_media_types
  drop column if exists category,
  drop column if exists identifier_label,
  drop column if exists requires_identifier,
  drop column if exists supports_replacement;

drop index if exists idx_access_assignment_permissions_unique;
create unique index idx_access_assignment_permissions_floor
  on public.access_assignment_permissions (assignment_id, floor_id)
  where resource_type = 'floor' and floor_id is not null;
create unique index idx_access_assignment_permissions_special
  on public.access_assignment_permissions (assignment_id, special_access_id)
  where resource_type = 'special_access' and special_access_id is not null;

alter table public.access_assignment_permissions drop column if exists resource_key;

COMMIT;