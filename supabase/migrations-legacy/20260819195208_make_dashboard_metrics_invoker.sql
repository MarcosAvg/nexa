-- Dashboard metrics only read tables that authenticated users can already
-- read. Run them as the caller instead of bypassing RLS.

BEGIN;

ALTER FUNCTION public.get_dashboard_metrics()
    SECURITY INVOKER
    SET search_path = public, extensions;

ALTER FUNCTION public.get_dashboard_stats()
    SECURITY INVOKER
    SET search_path = public, extensions;

COMMIT;
