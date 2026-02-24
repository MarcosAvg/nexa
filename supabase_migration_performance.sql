-- ============================================================
-- NEXA: Performance Optimization SQL Migration
-- Run this in your Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- 1. INDEXES — Speeds up searches, filters, and joins
-- ============================================================

-- Personnel: search by name / employee number
CREATE INDEX IF NOT EXISTS idx_personnel_first_name   ON personnel USING btree (first_name);
CREATE INDEX IF NOT EXISTS idx_personnel_last_name    ON personnel USING btree (last_name);
CREATE INDEX IF NOT EXISTS idx_personnel_employee_no  ON personnel USING btree (employee_no);

-- Personnel: filter by status
CREATE INDEX IF NOT EXISTS idx_personnel_status       ON personnel USING btree (status);

-- Personnel: filter by dependency (very common)
CREATE INDEX IF NOT EXISTS idx_personnel_dependency   ON personnel USING btree (dependency_id);

-- Cards: joins and status filters
CREATE INDEX IF NOT EXISTS idx_cards_person_id        ON cards USING btree (person_id);
CREATE INDEX IF NOT EXISTS idx_cards_status           ON cards USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cards_type             ON cards USING btree (type);
CREATE INDEX IF NOT EXISTS idx_cards_prog_status      ON cards USING btree (programming_status);
CREATE INDEX IF NOT EXISTS idx_cards_resp_status      ON cards USING btree (responsiva_status);

-- Compound index for the "ready card" filter used in dashboard stats
CREATE INDEX IF NOT EXISTS idx_cards_ready ON cards (person_id, status, programming_status, responsiva_status)
    WHERE status = 'active'
      AND programming_status = 'done'
      AND responsiva_status IN ('signed', 'legacy');

-- Tickets: filter by person / card / type
CREATE INDEX IF NOT EXISTS idx_tickets_person_id      ON tickets USING btree (person_id);
CREATE INDEX IF NOT EXISTS idx_tickets_card_id        ON tickets USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_tickets_type           ON tickets USING btree (type);
CREATE INDEX IF NOT EXISTS idx_tickets_status         ON tickets USING btree (status);

-- History: ORDER BY timestamp desc
CREATE INDEX IF NOT EXISTS idx_history_timestamp      ON history_logs USING btree (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_entity_id      ON history_logs USING btree (entity_id);


-- ============================================================
-- 2. DASHBOARD STATS RPC
-- Replaces 3+ round-trip paginated queries with a single call.
-- Called via: supabase.rpc('get_dashboard_stats')
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE sql
STABLE          -- marks it as read-only, allows Supabase to cache per-transaction
SECURITY DEFINER
AS $$
    SELECT json_build_object(
        -- Active personnel: status = active AND has at least one "ready" card
        'activePersonnel', (
            SELECT COUNT(DISTINCT p.id)
            FROM personnel p
            INNER JOIN cards c ON c.person_id = p.id
            WHERE p.status = 'active'
              AND c.status = 'active'
              AND c.programming_status = 'done'
              AND c.responsiva_status IN ('signed', 'legacy')
        ),
        -- Available KONE cards in stock
        'koneStock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'KONE'
              AND status = 'available'
              AND person_id IS NULL
        ),
        -- Available P2000 cards in stock
        'p2000Stock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'P2000'
              AND status = 'available'
              AND person_id IS NULL
        )
    );
$$;

-- Grant access to authenticated users (adjust if you use a different role)
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;


-- ============================================================
-- 3. OPTIONAL - Partial index for ilike searches
-- If you use pg_trgm, enable the extension and drop trigram indexes
-- for much faster ILIKE / full-text search on first/last name.
-- ============================================================

-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_personnel_first_name_trgm ON personnel USING gin (first_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_personnel_last_name_trgm  ON personnel USING gin (last_name  gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_personnel_employee_trgm   ON personnel USING gin (employee_no gin_trgm_ops);
--
-- NOTE: Enable pg_trgm in Supabase Dashboard → Database → Extensions → pg_trgm
--       before uncommenting the lines above.
