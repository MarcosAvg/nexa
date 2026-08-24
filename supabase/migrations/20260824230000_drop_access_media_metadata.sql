-- Limpieza: eliminar columna obsoleta metadata de access_media.
-- Guardaba legacy_type/legacy_folio (ya no se escriben ni se leen). El campo
-- jsonb no se usa en ningún flujo; los feeds usan access_media_types(key/name).

BEGIN;

alter table public.access_media drop column if exists metadata;

COMMIT;