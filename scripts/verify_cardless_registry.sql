-- Verificación de cardless_registry (ejecutar en SQL Editor de Supabase)
-- Debe devolver: table_exists = true, rls_enabled = true,
-- recorded_by_refs_profiles = true, y grants > 0

SELECT
    to_regclass('public.cardless_registry') IS NOT NULL AS table_exists,
    COALESCE(
        (SELECT c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'cardless_registry'),
        false
    ) AS rls_enabled,
    EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN pg_namespace refnsp ON refnsp.oid = ref.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'cardless_registry'
          AND con.conname = 'cardless_registry_recorded_by_fkey'
          AND refnsp.nspname = 'public'
          AND ref.relname = 'profiles'
    ) AS recorded_by_refs_profiles,
    EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN pg_namespace refnsp ON refnsp.oid = ref.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'cardless_registry'
          AND con.conname = 'cardless_registry_recorded_by_fkey'
          AND refnsp.nspname = 'auth'
          AND ref.relname = 'users'
    ) AS recorded_by_still_refs_auth_users,
    (
        SELECT count(*)::int
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'cardless_registry'
    ) AS policy_count,
    has_table_privilege('authenticated', 'public.cardless_registry', 'SELECT') AS authenticated_can_select,
    has_table_privilege('authenticated', 'public.cardless_registry', 'INSERT') AS authenticated_can_insert;

-- Detalle de la FK recorded_by
SELECT
    con.conname AS constraint_name,
    refnsp.nspname || '.' || ref.relname AS references_table
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
JOIN pg_class ref ON ref.oid = con.confrelid
JOIN pg_namespace refnsp ON refnsp.oid = ref.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'cardless_registry'
  AND con.contype = 'f'
ORDER BY con.conname;
