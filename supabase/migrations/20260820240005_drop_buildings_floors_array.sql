-- Fase 4: elimina el array denormalizado buildings.floors. La tabla floors es
-- la fuente canónica de pisos por edificio.

BEGIN;

alter table public.buildings drop column if exists floors;

COMMIT;