-- FIX: PostgREST no puede usar on_conflict con indices unicos PARCIALES, por lo
-- que el upsert de 'assignMedia' ({ onConflict: "access_media_id" }) devolvia 400
-- y rompia la asignacion de tarjetas (alta vinculada, reposicion, asignacion).
-- Se reemplaza el indice parcial por un unique index COMPLETO en access_media_id;
-- Postgres permite multiples NULLs en un unique index, asi que el comportamiento
-- para filas sin tarjeta se conserva.

BEGIN;

drop index if exists "public"."idx_access_assignments_access_media_id";

create unique index "idx_access_assignments_access_media_id"
  on "public"."access_assignments" ("access_media_id");

COMMIT;
