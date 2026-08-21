-- Lock down the sync trigger function: it must not be callable through the
-- PostgREST API. Default privileges grant EXECUTE to authenticated, so revoke
-- explicitly for authenticated and anon.

BEGIN;

revoke execute on function public.sync_access_media_from_card() from authenticated;

revoke execute on function public.sync_access_media_from_card() from anon;

COMMIT;