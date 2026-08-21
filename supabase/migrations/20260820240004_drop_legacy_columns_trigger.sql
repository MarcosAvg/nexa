-- Fase 3b: elimina el último trigger de sincronización y las columnas legacy
-- de pisos/accesos, y normaliza access_assignments.legacy_card_id -> access_media_id.

BEGIN;

-- 1. Backfill: mapear cards.id (legacy) -> access_media.id en las asignaciones.
update public.access_assignments aa
   set legacy_card_id = am.id
  from public.access_media am
 where am.legacy_card_id = aa.legacy_card_id;

-- 2. Renombrar la columna a su significado real (referencia al medio de acceso).
alter table public.access_assignments rename column legacy_card_id to access_media_id;

drop index if exists idx_access_assignments_legacy_card_id;
create unique index idx_access_assignments_access_media_id
  on public.access_assignments (access_media_id) where (access_media_id is not null);

-- 3. Eliminar el trigger y la función de sincronización de permisos (ya se
--    escribe directo vía savePersonAccess).
drop trigger if exists trigger_sync_personnel_access on public.personnel;
drop function if exists public.sync_personnel_access_to_assignments();

-- 4. Eliminar columnas legacy de personal (pisos/accesos denormalizados).
alter table public.personnel
  drop column if exists floors_p2000,
  drop column if exists floors_kone,
  drop column if exists special_accesses;

-- 5. Eliminar columnas de mapeo legacy ya sin uso.
alter table public.access_media drop column if exists legacy_card_id;
alter table public.signed_documents drop column if exists legacy_responsiva_id;

COMMIT;