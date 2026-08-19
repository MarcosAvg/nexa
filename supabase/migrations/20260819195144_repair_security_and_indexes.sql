-- Production repair: permissions, security context and missing FK indexes.
-- This migration does not alter or delete application data.

BEGIN;

-- Views exposed through PostgREST must evaluate table RLS as the caller.
ALTER VIEW public.cards_ordered SET (security_invoker = true);
ALTER VIEW public.personnel_with_status SET (security_invoker = true);

-- The client never needs anonymous access to the application schema.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Keep only the RPCs used by the authenticated application. Trigger-only
-- functions must not be callable through the Data API.
REVOKE EXECUTE ON FUNCTION public.clean_personnel_floors_on_card_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reorder_catalog(text, bigint[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_personnel_fuzzy(text, text, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_catalog(text, bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_personnel_fuzzy(text, text, integer) TO authenticated;

-- Pin function lookup paths. The trigger function already schema-qualifies its
-- table reference, so it can use the safest empty path.
ALTER FUNCTION public.clean_personnel_floors_on_card_change()
    SET search_path = public, extensions;
ALTER FUNCTION public.get_dashboard_metrics()
    SET search_path = public, extensions;
ALTER FUNCTION public.get_dashboard_stats()
    SET search_path = public, extensions;
ALTER FUNCTION public.handle_new_user()
    SET search_path = '';
ALTER FUNCTION public.reorder_catalog(text, bigint[])
    SET search_path = public, extensions;
ALTER FUNCTION public.search_personnel_fuzzy(text, text, integer)
    SECURITY INVOKER
    SET search_path = public, extensions;

-- Only administrators can remove signed legal documents.
DROP POLICY IF EXISTS "Allow authenticated users to delete responsivas"
    ON public.signed_responsivas;
CREATE POLICY "Admins delete responsivas"
    ON public.signed_responsivas
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.role = 'admin'::public.app_role
        )
    );

-- Viewers can read enlaces; only admins and operators can manage them.
DROP POLICY IF EXISTS "Enable all for authenticated users on enlaces"
    ON public.enlaces;
CREATE POLICY "Authenticated users view enlaces"
    ON public.enlaces
    FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "Admins and operators insert enlaces"
    ON public.enlaces
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.role IN ('admin'::public.app_role, 'operator'::public.app_role)
        )
    );
CREATE POLICY "Admins and operators update enlaces"
    ON public.enlaces
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.role IN ('admin'::public.app_role, 'operator'::public.app_role)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.role IN ('admin'::public.app_role, 'operator'::public.app_role)
        )
    );
CREATE POLICY "Admins and operators delete enlaces"
    ON public.enlaces
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.role IN ('admin'::public.app_role, 'operator'::public.app_role)
        )
    );

-- Cover the currently unindexed foreign keys reported by the performance
-- advisor. Existing indexes are preserved.
CREATE INDEX IF NOT EXISTS idx_cardless_registry_dependency_id
    ON public.cardless_registry (dependency_id);
CREATE INDEX IF NOT EXISTS idx_cardless_registry_recorded_by
    ON public.cardless_registry (recorded_by);
CREATE INDEX IF NOT EXISTS idx_history_logs_performed_by
    ON public.history_logs (performed_by);
CREATE INDEX IF NOT EXISTS idx_personnel_baja_by
    ON public.personnel (baja_by);
CREATE INDEX IF NOT EXISTS idx_personnel_schedule_id
    ON public.personnel (schedule_id);
CREATE INDEX IF NOT EXISTS idx_signed_responsivas_person_id
    ON public.signed_responsivas (person_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by
    ON public.tickets (created_by);

COMMIT;
