-- =============================================================================
-- Script de Configuración Completa para Supabase — Nexa
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase (como postgres / service_role).
--
-- Este script unifica todas las migraciones anteriores en un solo archivo:
--   - Crea extensiones necesarias
--   - Define tipos personalizados (app_role)
--   - Crea todas las tablas del sistema (con columnas, constraints, índices)
--   - Define funciones y triggers
--   - Configura Row Level Security (RLS) y políticas por rol
--   - Otorga permisos a roles de Supabase (anon, authenticated, service_role)
--   - Habilita Realtime para tablas clave
--
-- Es seguro ejecutarlo múltiples veces (idempotente) gracias a IF NOT EXISTS.
-- =============================================================================

-- =============================================================================
-- 1. CONFIGURACIÓN INICIAL
-- =============================================================================
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

-- =============================================================================
-- 2. EXTENSIONES
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_graphql"        WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"            WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"           WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault"     WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "unaccent"           WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"          WITH SCHEMA "extensions";

-- =============================================================================
-- 3. TIPOS PERSONALIZADOS
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE "public"."app_role" AS ENUM ('admin', 'operator', 'viewer');
    END IF;
END $$;

-- =============================================================================
-- 4. FUNCIONES
-- =============================================================================

-- 4.1. Limpiar pisos al cambiar/eliminar tarjetas
CREATE OR REPLACE FUNCTION "public"."clean_personnel_floors_on_card_change"()
RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
BEGIN
    IF (TG_OP = 'DELETE') OR (OLD.person_id IS NOT NULL AND (NEW.person_id IS NULL OR NEW.person_id <> OLD.person_id)) THEN
        IF NOT EXISTS (
            SELECT 1 FROM cards
            WHERE person_id = OLD.person_id
            AND type = OLD.type
            AND id <> OLD.id
        ) THEN
            IF OLD.type = 'P2000' THEN
                UPDATE personnel SET floors_p2000 = ARRAY[]::text[] WHERE id = OLD.person_id;
            ELSIF OLD.type = 'KONE' THEN
                UPDATE personnel SET floors_kone = ARRAY[]::text[] WHERE id = OLD.person_id;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- 4.2. Obtener métricas del dashboard (dashboard antiguo)
CREATE OR REPLACE FUNCTION "public"."get_dashboard_metrics"()
RETURNS json
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    total_count integer;
    status_counts json;
    card_coverage json;
    top_dependencies json;
    top_buildings json;
    data_quality json;
    operativos_count integer;
    con_p2000_count integer;
    con_kone_count integer;
BEGIN
    SELECT COUNT(*) INTO total_count FROM personnel;

    WITH person_ready_cards AS (
        SELECT p.id, p.status as db_status, COUNT(DISTINCT c.type) as ready_types
        FROM personnel p
        LEFT JOIN cards c ON c.person_id = p.id
            AND c.status = 'active'
            AND c.programming_status = 'done'
            AND c.responsiva_status IN ('signed', 'legacy')
        GROUP BY p.id, p.status
    ),
    computed_statuses AS (
        SELECT
            CASE
                WHEN db_status = 'active' AND ready_types >= 2 THEN 'activo'
                WHEN db_status = 'active' AND ready_types = 1 THEN 'parcial'
                WHEN db_status = 'active' AND ready_types = 0 THEN 'inactivo'
                WHEN db_status = 'blocked' THEN 'bloqueado'
                ELSE 'baja'
            END as final_status
        FROM person_ready_cards
    )
    SELECT json_build_object(
        'activo', COUNT(*) FILTER (WHERE final_status = 'activo'),
        'parcial', COUNT(*) FILTER (WHERE final_status = 'parcial'),
        'inactivo', COUNT(*) FILTER (WHERE final_status = 'inactivo'),
        'bloqueado', COUNT(*) FILTER (WHERE final_status = 'bloqueado'),
        'baja', COUNT(*) FILTER (WHERE final_status = 'baja')
    ) INTO status_counts FROM computed_statuses;

    SELECT COUNT(*) INTO operativos_count
    FROM (
        SELECT p.id
        FROM personnel p
        JOIN cards c ON c.person_id = p.id
            AND c.status = 'active'
            AND c.programming_status = 'done'
            AND c.responsiva_status IN ('signed', 'legacy')
        WHERE p.status = 'active'
        GROUP BY p.id
        HAVING COUNT(DISTINCT c.type) >= 1
    ) AS op;

    SELECT COUNT(DISTINCT person_id) INTO con_p2000_count FROM cards WHERE type = 'P2000' AND status = 'active' AND person_id IS NOT NULL;
    SELECT COUNT(DISTINCT person_id) INTO con_kone_count FROM cards WHERE type = 'KONE' AND status = 'active' AND person_id IS NOT NULL;

    SELECT json_build_object(
        'operativos', operativos_count,
        'conP2000', con_p2000_count,
        'sinP2000', GREATEST(0, operativos_count - con_p2000_count),
        'conKone', con_kone_count,
        'sinKone', GREATEST(0, operativos_count - con_kone_count)
    ) INTO card_coverage;

    SELECT json_agg(t) INTO top_dependencies FROM (
        SELECT d.name, COUNT(p.id) as total, COUNT(p.id) FILTER (WHERE p.status = 'active') as activos
        FROM dependencies d
        LEFT JOIN personnel p ON p.dependency_id = d.id
        GROUP BY d.name
        ORDER BY total DESC
        LIMIT 10
    ) t;

    SELECT json_agg(t) INTO top_buildings FROM (
        SELECT b.name, COUNT(p.id) as total
        FROM buildings b
        LEFT JOIN personnel p ON p.building_id = b.id
        GROUP BY b.name
        ORDER BY total DESC
        LIMIT 6
    ) t;

    SELECT json_build_object(
        'sinEmail', COUNT(*) FILTER (WHERE email IS NULL OR email = ''),
        'sinSchedule', COUNT(*) FILTER (WHERE schedule_id IS NULL),
        'sinPosition', COUNT(*) FILTER (WHERE position IS NULL OR position = ''),
        'sinArea', COUNT(*) FILTER (WHERE area IS NULL OR area = ''),
        'total', total_count
    ) INTO data_quality FROM personnel;

    RETURN json_build_object(
        'totalPersonnel', total_count,
        'statusCounts', status_counts,
        'cardCoverage', card_coverage,
        'topDependencies', COALESCE(top_dependencies, '[]'::json),
        'topBuildings', COALESCE(top_buildings, '[]'::json),
        'dataQuality', data_quality
    );
END;
$$;

-- 4.3. Obtener estadísticas rápidas del dashboard
CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"()
RETURNS json
LANGUAGE "sql" STABLE SECURITY DEFINER
AS $$
    SELECT json_build_object(
        'activePersonnel', (
            SELECT COUNT(DISTINCT p.id)
            FROM personnel p
            INNER JOIN cards c ON c.person_id = p.id
            WHERE p.status = 'active'
              AND c.status = 'active'
              AND c.programming_status = 'done'
              AND c.responsiva_status IN ('signed', 'legacy')
        ),
        'koneStock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'KONE'
              AND status = 'available'
              AND person_id IS NULL
        ),
        'p2000Stock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'P2000'
              AND status = 'available'
              AND person_id IS NULL
        )
    );
$$;

-- 4.4. Crear perfil automáticamente al registrarse un nuevo usuario
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS "trigger"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'viewer'
    );
    RETURN NEW;
END;
$$;

-- Vincular la función al evento de creación de usuario en auth.users
-- (Esto se configura desde la UI de Supabase Authentication > Triggers)
-- NOTA: Este DROP + CREATE se ejecuta solo si se requiere reinstalar.
-- DO $$
-- BEGIN
--     DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--     CREATE TRIGGER on_auth_user_created
--         AFTER INSERT ON auth.users
--         FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- END $$;

-- 4.5. Búsqueda difusa de personal
CREATE OR REPLACE FUNCTION "public"."search_personnel_fuzzy"(
    "p_last_name" "text",
    "p_first_name" "text",
    "p_limit" integer DEFAULT 20
)
RETURNS SETOF "public"."personnel"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  search_term_1 text;
  search_term_2 text;
BEGIN
  search_term_1 := lower(unaccent(trim(regexp_replace(p_last_name, '\s+', ' ', 'g'))));
  search_term_2 := lower(unaccent(trim(regexp_replace(p_first_name, '\s+', ' ', 'g'))));
  RETURN QUERY
  SELECT p.*
  FROM personnel p
  WHERE p.status != 'inactive'
    AND (
      (
        (lower(unaccent(p.last_name)) ILIKE '%' || search_term_1 || '%' AND lower(unaccent(p.first_name)) ILIKE '%' || search_term_2 || '%')
        OR
        (lower(unaccent(p.last_name)) ILIKE '%' || search_term_2 || '%' AND lower(unaccent(p.first_name)) ILIKE '%' || search_term_1 || '%')
      )
      OR
      (
        (search_term_1 = '' AND (lower(unaccent(p.last_name)) ILIKE '%' || search_term_2 || '%' OR lower(unaccent(p.first_name)) ILIKE '%' || search_term_2 || '%'))
        OR
        (search_term_2 = '' AND (lower(unaccent(p.last_name)) ILIKE '%' || search_term_1 || '%' OR lower(unaccent(p.first_name)) ILIKE '%' || search_term_1 || '%'))
      )
    )
  ORDER BY
    similarity(lower(unaccent(p.last_name || ' ' || p.first_name)), search_term_1 || ' ' || search_term_2) DESC,
    p.last_name ASC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- 5. TABLAS — Definiciones principales
-- =============================================================================

-- 5.1. Catálogo de edificios
CREATE TABLE IF NOT EXISTS "public"."buildings" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "name" "text" NOT NULL,
    "floors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."buildings" OWNER TO "postgres";

-- 5.2. Catálogo de dependencias
CREATE TABLE IF NOT EXISTS "public"."dependencies" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "name" "text" NOT NULL
);
ALTER TABLE "public"."dependencies" OWNER TO "postgres";

-- 5.3. Catálogo de horarios
CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "name" "text" NOT NULL,
    "days" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "default_entry" time without time zone,
    "default_exit" time without time zone
);
ALTER TABLE "public"."schedules" OWNER TO "postgres";

-- 5.4. Catálogo de accesos especiales
CREATE TABLE IF NOT EXISTS "public"."special_accesses" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "name" "text" NOT NULL
);
ALTER TABLE "public"."special_accesses" OWNER TO "postgres";

-- 5.5. Personal
CREATE TABLE IF NOT EXISTS "public"."personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "employee_no" "text",
    "email" "text",
    "area" "text",
    "position" "text",
    "dependency_id" bigint,
    "building_id" bigint,
    "floor" "text",
    "floors_p2000" "text"[] DEFAULT '{}'::"text"[],
    "floors_kone" "text"[] DEFAULT '{}'::"text"[],
    "schedule_id" bigint,
    "entry_time" time without time zone,
    "exit_time" time without time zone,
    "special_accesses" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'active'::"text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."personnel" OWNER TO "postgres";

-- 5.6. Tarjetas (P2000, KONE)
CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "folio" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text",
    "responsiva_status" "text" DEFAULT 'unsigned'::"text",
    "programming_status" "text" DEFAULT 'pending'::"text",
    "person_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."cards" OWNER TO "postgres";

-- 5.7. Perfiles de usuario (vinculados a auth.users)
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "public"."app_role" DEFAULT 'viewer'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text"
);
ALTER TABLE "public"."profiles" OWNER TO "postgres";

-- 5.8. Responsivas firmadas
CREATE TABLE IF NOT EXISTS "public"."signed_responsivas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid",
    "folio" "text" NOT NULL,
    "card_type" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "signature" "text" NOT NULL,
    "legal_hash" "text",
    "legal_snapshot" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."signed_responsivas" OWNER TO "postgres";

-- 5.9. Tickets (altas, bajas, modificaciones, reportes, etc.)
CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "priority" "text" DEFAULT 'Media'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "person_id" "uuid",
    "card_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."tickets" OWNER TO "postgres";



-- 5.10. Historial de operaciones
CREATE TABLE IF NOT EXISTS "public"."history_logs" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "entity_name" "text",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "performed_by" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."history_logs" OWNER TO "postgres";



-- =============================================================================
-- 6. TABLAS ADICIONALES
-- =============================================================================

-- 6.1. Registro de personal sin tarjeta (cardless registry)
CREATE TABLE IF NOT EXISTS "public"."cardless_registry" (
    "id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "person_id" uuid,
    "first_name" "text",
    "last_name" "text",
    "employee_no" "text",
    "building_id" bigint,
    "dependency_id" bigint,
    "floor" "text",
    "reason" "text" NOT NULL,
    "comments" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "recorded_by" uuid,
    -- Columna agregada en migración: snapshot del estado KONE al registrar
    "kone_status_at_registration" boolean DEFAULT NULL
);
ALTER TABLE "public"."cardless_registry" OWNER TO "postgres";

COMMENT ON COLUMN public.cardless_registry.kone_status_at_registration IS
    'Snapshot: TRUE = tenía ticket KONE pendiente al registrarse, FALSE = ya firmada, NULL = sin tarjeta KONE';

-- 6.2. Enlaces (contactos administrativos con extensión)
CREATE TABLE IF NOT EXISTS "public"."enlaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "extension" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."enlaces" OWNER TO "postgres";

-- =============================================================================
-- 7. CONSTRAINTS — Claves primarias, únicas y foráneas
-- =============================================================================

DO $$
BEGIN
    -- 7.1. Buildings
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buildings_pkey') THEN
        ALTER TABLE ONLY "public"."buildings" ADD CONSTRAINT "buildings_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buildings_name_key') THEN
        ALTER TABLE ONLY "public"."buildings" ADD CONSTRAINT "buildings_name_key" UNIQUE ("name");
    END IF;

    -- 7.2. Dependencies
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependencies_pkey') THEN
        ALTER TABLE ONLY "public"."dependencies" ADD CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependencies_name_key') THEN
        ALTER TABLE ONLY "public"."dependencies" ADD CONSTRAINT "dependencies_name_key" UNIQUE ("name");
    END IF;

    -- 7.3. Schedules
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_pkey') THEN
        ALTER TABLE ONLY "public"."schedules" ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_name_key') THEN
        ALTER TABLE ONLY "public"."schedules" ADD CONSTRAINT "schedules_name_key" UNIQUE ("name");
    END IF;

    -- 7.4. Special accesses
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'special_accesses_pkey') THEN
        ALTER TABLE ONLY "public"."special_accesses" ADD CONSTRAINT "special_accesses_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'special_accesses_name_key') THEN
        ALTER TABLE ONLY "public"."special_accesses" ADD CONSTRAINT "special_accesses_name_key" UNIQUE ("name");
    END IF;

    -- 7.5. Personnel
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_pkey') THEN
        ALTER TABLE ONLY "public"."personnel" ADD CONSTRAINT "personnel_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_employee_no_key') THEN
        ALTER TABLE ONLY "public"."personnel" ADD CONSTRAINT "personnel_employee_no_key" UNIQUE ("employee_no");
    END IF;

    -- 7.6. Cards
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_pkey') THEN
        ALTER TABLE ONLY "public"."cards" ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_folio_type_key') THEN
        ALTER TABLE ONLY "public"."cards" ADD CONSTRAINT "cards_folio_type_key" UNIQUE ("folio", "type");
    END IF;

    -- 7.7. Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
        ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
        ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");
    END IF;

    -- 7.8. Signed responsivas
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signed_responsivas_pkey') THEN
        ALTER TABLE ONLY "public"."signed_responsivas" ADD CONSTRAINT "signed_responsivas_pkey" PRIMARY KEY ("id");
    END IF;

    -- 7.9. Tickets
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_pkey') THEN
        ALTER TABLE ONLY "public"."tickets" ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");
    END IF;

    -- 7.10. History logs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'history_logs_pkey') THEN
        ALTER TABLE ONLY "public"."history_logs" ADD CONSTRAINT "history_logs_pkey" PRIMARY KEY ("id");
    END IF;

    -- 7.11. Enlaces
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enlaces_pkey') THEN
        ALTER TABLE ONLY "public"."enlaces" ADD CONSTRAINT "enlaces_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enlaces_person_id_key') THEN
        ALTER TABLE ONLY "public"."enlaces" ADD CONSTRAINT "enlaces_person_id_key" UNIQUE ("person_id");
    END IF;

    -- 7.12. Foreign Keys — Personnel
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_building_id_fkey') THEN
        ALTER TABLE ONLY "public"."personnel" ADD CONSTRAINT "personnel_building_id_fkey"
            FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_dependency_id_fkey') THEN
        ALTER TABLE ONLY "public"."personnel" ADD CONSTRAINT "personnel_dependency_id_fkey"
            FOREIGN KEY ("dependency_id") REFERENCES "public"."dependencies"("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_schedule_id_fkey') THEN
        ALTER TABLE ONLY "public"."personnel" ADD CONSTRAINT "personnel_schedule_id_fkey"
            FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id");
    END IF;

    -- 7.13. Foreign Keys — Cards
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_person_id_fkey') THEN
        ALTER TABLE ONLY "public"."cards" ADD CONSTRAINT "cards_person_id_fkey"
            FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE SET NULL;
    END IF;

    -- 7.14. Foreign Keys — Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_id_fkey"
            FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    -- 7.15. Foreign Keys — Signed responsivas
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signed_responsivas_person_id_fkey') THEN
        ALTER TABLE ONLY "public"."signed_responsivas" ADD CONSTRAINT "signed_responsivas_person_id_fkey"
            FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE CASCADE;
    END IF;

    -- 7.16. Foreign Keys — Tickets
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_person_id_fkey') THEN
        ALTER TABLE ONLY "public"."tickets" ADD CONSTRAINT "tickets_person_id_fkey"
            FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_card_id_fkey') THEN
        ALTER TABLE ONLY "public"."tickets" ADD CONSTRAINT "tickets_card_id_fkey"
            FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_created_by_fkey') THEN
        ALTER TABLE ONLY "public"."tickets" ADD CONSTRAINT "tickets_created_by_fkey"
            FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");
    END IF;

    -- 7.17. Foreign Keys — History logs
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'history_logs_performed_by_fkey') THEN
        ALTER TABLE ONLY "public"."history_logs" ADD CONSTRAINT "history_logs_performed_by_fkey"
            FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");
    END IF;

    -- 7.18. Foreign Keys — Cardless registry
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardless_registry_person_id_fkey') THEN
        ALTER TABLE ONLY "public"."cardless_registry" ADD CONSTRAINT "cardless_registry_person_id_fkey"
            FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardless_registry_building_id_fkey') THEN
        ALTER TABLE ONLY "public"."cardless_registry" ADD CONSTRAINT "cardless_registry_building_id_fkey"
            FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardless_registry_dependency_id_fkey') THEN
        ALTER TABLE ONLY "public"."cardless_registry" ADD CONSTRAINT "cardless_registry_dependency_id_fkey"
            FOREIGN KEY ("dependency_id") REFERENCES "public"."dependencies"("id");
    END IF;

    -- Limpiar FK anterior a auth.users si existe y recrear hacia profiles
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardless_registry_recorded_by_fkey') THEN
        ALTER TABLE ONLY "public"."cardless_registry" DROP CONSTRAINT "cardless_registry_recorded_by_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cardless_registry_recorded_by_fkey') THEN
        ALTER TABLE ONLY "public"."cardless_registry" ADD CONSTRAINT "cardless_registry_recorded_by_fkey"
            FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
    END IF;

    -- 7.19. Foreign Keys — Enlaces
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enlaces_person_id_fkey') THEN
        ALTER TABLE ONLY "public"."enlaces" ADD CONSTRAINT "enlaces_person_id_fkey"
            FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================================================
-- 8. ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "idx_cards_folio"          ON "public"."cards" USING "btree" ("folio");
CREATE INDEX IF NOT EXISTS "idx_cards_person_id"      ON "public"."cards" USING "btree" ("person_id");
CREATE INDEX IF NOT EXISTS "idx_cards_prog_status"    ON "public"."cards" USING "btree" ("programming_status");
CREATE INDEX IF NOT EXISTS "idx_cards_resp_status"    ON "public"."cards" USING "btree" ("responsiva_status");
CREATE INDEX IF NOT EXISTS "idx_cards_status"         ON "public"."cards" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_cards_type"           ON "public"."cards" USING "btree" ("type");
CREATE INDEX IF NOT EXISTS "idx_cards_ready"          ON "public"."cards" USING "btree" ("person_id", "status", "programming_status", "responsiva_status")
    WHERE ("status" = 'active' AND "programming_status" = 'done' AND "responsiva_status" IN ('signed', 'legacy'));

CREATE INDEX IF NOT EXISTS "idx_personnel_building"   ON "public"."personnel" USING "btree" ("building_id");
CREATE INDEX IF NOT EXISTS "idx_personnel_dependency" ON "public"."personnel" USING "btree" ("dependency_id");
CREATE INDEX IF NOT EXISTS "idx_personnel_employee_no" ON "public"."personnel" USING "btree" ("employee_no");
CREATE INDEX IF NOT EXISTS "idx_personnel_first_name" ON "public"."personnel" USING "btree" ("first_name");
CREATE INDEX IF NOT EXISTS "idx_personnel_last_name"  ON "public"."personnel" USING "btree" ("last_name");
CREATE INDEX IF NOT EXISTS "idx_personnel_name"       ON "public"."personnel" USING "btree" ("first_name", "last_name");
CREATE INDEX IF NOT EXISTS "idx_personnel_status"     ON "public"."personnel" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_history_action"       ON "public"."history_logs" USING "btree" ("action");
CREATE INDEX IF NOT EXISTS "idx_history_entity"       ON "public"."history_logs" USING "btree" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_history_entity_id"    ON "public"."history_logs" USING "btree" ("entity_id");
CREATE INDEX IF NOT EXISTS "idx_history_timestamp"    ON "public"."history_logs" USING "btree" ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS "idx_tickets_assigned_to"  ON "public"."tickets" USING "btree" ((("payload" ->> 'assignedTo'::"text")));
CREATE INDEX IF NOT EXISTS "idx_tickets_card_id"      ON "public"."tickets" USING "btree" ("card_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_person_id"    ON "public"."tickets" USING "btree" ("person_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_status"       ON "public"."tickets" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_tickets_type"         ON "public"."tickets" USING "btree" ("type");

CREATE INDEX IF NOT EXISTS "idx_cardless_registry_person_id"    ON "public"."cardless_registry" USING "btree" ("person_id");
CREATE INDEX IF NOT EXISTS "idx_cardless_registry_recorded_at"  ON "public"."cardless_registry" USING "btree" ("recorded_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_cardless_registry_building_id"  ON "public"."cardless_registry" USING "btree" ("building_id");
CREATE INDEX IF NOT EXISTS "idx_cardless_registry_dependency_id" ON "public"."cardless_registry" USING "btree" ("dependency_id");
CREATE INDEX IF NOT EXISTS "idx_cardless_registry_reason"       ON "public"."cardless_registry" USING "btree" ("reason");
CREATE INDEX IF NOT EXISTS "idx_cardless_registry_kone_status"  ON "public"."cardless_registry" USING "btree" ("kone_status_at_registration")
    WHERE "kone_status_at_registration" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_enlaces_person_id"    ON "public"."enlaces" USING "btree" ("person_id");

-- =============================================================================
-- 9. VISTA — Personal con estatus computado
-- =============================================================================
CREATE OR REPLACE VIEW "public"."personnel_with_status" AS
WITH "person_ready_cards" AS (
    SELECT "p_1"."id",
        "count"(DISTINCT "c"."type") AS "ready_types"
    FROM ("public"."personnel" "p_1"
        LEFT JOIN "public"."cards" "c" ON (
            ("c"."person_id" = "p_1"."id")
            AND ("c"."status" = 'active'::"text")
            AND ("c"."programming_status" = 'done'::"text")
            AND ("c"."responsiva_status" = ANY (ARRAY['signed'::"text", 'legacy'::"text"]))
        ))
    GROUP BY "p_1"."id"
)
SELECT "p"."id",
    "p"."first_name",
    "p"."last_name",
    "p"."employee_no",
    "p"."email",
    "p"."area",
    "p"."position",
    "p"."dependency_id",
    "p"."building_id",
    "p"."floor",
    "p"."floors_p2000",
    "p"."floors_kone",
    "p"."schedule_id",
    "p"."entry_time",
    "p"."exit_time",
    "p"."special_accesses",
    "p"."status",
    "p"."photo_url",
    "p"."created_at",
    COALESCE("b"."name", 'N/A'::"text") AS "building_name",
    COALESCE("d"."name", 'N/A'::"text") AS "dependency_name",
    COALESCE("s"."name", 'Sin Horario'::"text") AS "schedule_name",
    CASE
        WHEN (("p"."status" = 'active'::"text") AND ("prc"."ready_types" >= 2)) THEN 'Activo/a'::"text"
        WHEN (("p"."status" = 'active'::"text") AND ("prc"."ready_types" = 1)) THEN 'Parcial'::"text"
        WHEN (("p"."status" = 'active'::"text") AND ("prc"."ready_types" = 0)) THEN 'Sin Acceso'::"text"
        WHEN ("p"."status" = 'blocked'::"text") THEN 'Bloqueado/a'::"text"
        ELSE 'Baja'::"text"
    END AS "computed_status"
FROM (((("public"."personnel" "p"
    LEFT JOIN "person_ready_cards" "prc" ON (("prc"."id" = "p"."id")))
    LEFT JOIN "public"."buildings" "b" ON (("b"."id" = "p"."building_id")))
    LEFT JOIN "public"."dependencies" "d" ON (("d"."id" = "p"."dependency_id")))
    LEFT JOIN "public"."schedules" "s" ON (("s"."id" = "p"."schedule_id")));

-- =============================================================================
-- 10. TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS "trigger_clean_floors_on_card_management" ON "public"."cards";
CREATE TRIGGER "trigger_clean_floors_on_card_management"
    AFTER DELETE OR UPDATE ON "public"."cards"
    FOR EACH ROW EXECUTE FUNCTION "public"."clean_personnel_floors_on_card_change"();

-- =============================================================================
-- 11. ROW LEVEL SECURITY (RLS) Y POLÍTICAS
-- =============================================================================

-- 11.1. Habilitar RLS en todas las tablas
ALTER TABLE "public"."buildings"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cards"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dependencies"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."history_logs"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."personnel"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."schedules"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."signed_responsivas"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."special_accesses"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tickets"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cardless_registry"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."enlaces"             ENABLE ROW LEVEL SECURITY;

-- 11.2. Políticas de SELECT (visibles para todos los usuarios autenticados)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buildings viewable by everyone') THEN
        CREATE POLICY "Buildings viewable by everyone" ON "public"."buildings"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cards viewable by everyone') THEN
        CREATE POLICY "Cards viewable by everyone" ON "public"."cards"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Dependencies viewable by everyone') THEN
        CREATE POLICY "Dependencies viewable by everyone" ON "public"."dependencies"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'History viewable by everyone') THEN
        CREATE POLICY "History viewable by everyone" ON "public"."history_logs"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Personnel viewable by everyone') THEN
        CREATE POLICY "Personnel viewable by everyone" ON "public"."personnel"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profiles viewable by everyone') THEN
        CREATE POLICY "Profiles viewable by everyone" ON "public"."profiles"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Schedules viewable by everyone') THEN
        CREATE POLICY "Schedules viewable by everyone" ON "public"."schedules"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Responsivas viewable') THEN
        CREATE POLICY "Responsivas viewable" ON "public"."signed_responsivas"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Special accesses viewable by everyone') THEN
        CREATE POLICY "Special accesses viewable by everyone" ON "public"."special_accesses"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tickets viewable by everyone') THEN
        CREATE POLICY "Tickets viewable by everyone" ON "public"."tickets"
            FOR SELECT USING ((SELECT "auth"."role"() = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for authenticated users on enlaces') THEN
        CREATE POLICY "Enable all for authenticated users on enlaces" ON "public"."enlaces"
            AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 11.3. Políticas de INSERT (solo admin/operator)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins insert buildings') THEN
        CREATE POLICY "Admins insert buildings" ON "public"."buildings"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins insert dependencies') THEN
        CREATE POLICY "Admins insert dependencies" ON "public"."dependencies"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins insert schedules') THEN
        CREATE POLICY "Admins insert schedules" ON "public"."schedules"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins insert special') THEN
        CREATE POLICY "Admins insert special" ON "public"."special_accesses"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators insert cards') THEN
        CREATE POLICY "Admins/Operators insert cards" ON "public"."cards"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators insert personnel') THEN
        CREATE POLICY "Admins/Operators insert personnel" ON "public"."personnel"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators insert history') THEN
        CREATE POLICY "Admins/Operators insert history" ON "public"."history_logs"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators insert responsivas') THEN
        CREATE POLICY "Admins/Operators insert responsivas" ON "public"."signed_responsivas"
            FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone insert tickets') THEN
        CREATE POLICY "Everyone insert tickets" ON "public"."tickets"
            FOR INSERT WITH CHECK (((SELECT "auth"."role"()) = 'authenticated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cardless registry insertable by operators') THEN
        CREATE POLICY "Cardless registry insertable by operators" ON "public"."cardless_registry"
            FOR INSERT TO authenticated
            WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
END $$;

-- 11.4. Políticas de UPDATE (solo admin/operator según corresponda)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins update buildings') THEN
        CREATE POLICY "Admins update buildings" ON "public"."buildings"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins update dependencies') THEN
        CREATE POLICY "Admins update dependencies" ON "public"."dependencies"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins update schedules') THEN
        CREATE POLICY "Admins update schedules" ON "public"."schedules"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins update special') THEN
        CREATE POLICY "Admins update special" ON "public"."special_accesses"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins update all profiles') THEN
        CREATE POLICY "Admins update all profiles" ON "public"."profiles"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles" "profiles_1"
                WHERE ("profiles_1"."id" = (SELECT "auth"."uid"()) AND "profiles_1"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators update cards') THEN
        CREATE POLICY "Admins/Operators update cards" ON "public"."cards"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators update personnel') THEN
        CREATE POLICY "Admins/Operators update personnel" ON "public"."personnel"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Operators update tickets') THEN
        CREATE POLICY "Operators update tickets" ON "public"."tickets"
            FOR UPDATE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))))
            WITH CHECK ((((SELECT "profiles"."role" FROM "public"."profiles"
                WHERE "profiles"."id" = (SELECT "auth"."uid"())) = 'admin') OR ("status" IS DISTINCT FROM 'completed')));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cardless registry updatable by operators') THEN
        CREATE POLICY "Cardless registry updatable by operators" ON "public"."cardless_registry"
            FOR UPDATE TO authenticated
            USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
END $$;

-- 11.5. Políticas de DELETE (solo admin/operator)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins delete buildings') THEN
        CREATE POLICY "Admins delete buildings" ON "public"."buildings"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins delete dependencies') THEN
        CREATE POLICY "Admins delete dependencies" ON "public"."dependencies"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins delete schedules') THEN
        CREATE POLICY "Admins delete schedules" ON "public"."schedules"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins delete special') THEN
        CREATE POLICY "Admins delete special" ON "public"."special_accesses"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins delete tickets') THEN
        CREATE POLICY "Admins delete tickets" ON "public"."tickets"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = 'admin'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators delete cards') THEN
        CREATE POLICY "Admins/Operators delete cards" ON "public"."cards"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins/Operators delete personnel') THEN
        CREATE POLICY "Admins/Operators delete personnel" ON "public"."personnel"
            FOR DELETE USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to delete responsivas') THEN
        CREATE POLICY "Allow authenticated users to delete responsivas" ON "public"."signed_responsivas"
            FOR DELETE TO "authenticated" USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cardless registry deletable by operators') THEN
        CREATE POLICY "Cardless registry deletable by operators" ON "public"."cardless_registry"
            FOR DELETE TO authenticated
            USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cardless registry viewable by operators') THEN
        CREATE POLICY "Cardless registry viewable by operators" ON "public"."cardless_registry"
            FOR SELECT TO authenticated
            USING ((EXISTS (SELECT 1 FROM "public"."profiles"
                WHERE ("profiles"."id" = (SELECT "auth"."uid"()) AND "profiles"."role" = ANY (ARRAY['admin', 'operator'])))));
    END IF;
END $$;

-- =============================================================================
-- 12. REALTIME — Publicación para cambios en tiempo real
-- =============================================================================
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

-- Agregar tablas a la publicación (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tickets') THEN
        ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."tickets";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cards') THEN
        ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."cards";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'history_logs') THEN
        ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."history_logs";
    END IF;
END $$;

-- =============================================================================
-- 13. PERMISOS — GRANTS
-- =============================================================================

-- 13.1. Schema usage
GRANT USAGE ON SCHEMA "public" TO "postgres", "anon", "authenticated", "service_role";

-- 13.2. Permisos para cardless_registry (grants específicos)
GRANT ALL ON TABLE "public"."cardless_registry" TO "anon", "authenticated", "service_role";
GRANT USAGE, SELECT ON SEQUENCE "public"."cardless_registry_id_seq" TO "anon", "authenticated", "service_role";

-- 13.3. Permisos para buildings
GRANT ALL ON TABLE "public"."buildings" TO "anon", "authenticated", "service_role";
GRANT ALL ON SEQUENCE "public"."buildings_id_seq" TO "anon", "authenticated", "service_role";

-- 13.4. Permisos para cards
GRANT ALL ON TABLE "public"."cards" TO "anon", "authenticated", "service_role";

-- 13.5. Permisos para dependencies
GRANT ALL ON TABLE "public"."dependencies" TO "anon", "authenticated", "service_role";
GRANT ALL ON SEQUENCE "public"."dependencies_id_seq" TO "anon", "authenticated", "service_role";

-- 13.6. Permisos para history_logs
GRANT ALL ON TABLE "public"."history_logs" TO "anon", "authenticated", "service_role";
GRANT ALL ON SEQUENCE "public"."history_logs_id_seq" TO "anon", "authenticated", "service_role";

-- 13.7. Permisos para schedules
GRANT ALL ON TABLE "public"."schedules" TO "anon", "authenticated", "service_role";
GRANT ALL ON SEQUENCE "public"."schedules_id_seq" TO "anon", "authenticated", "service_role";

-- 13.8. Permisos para personnel
GRANT ALL ON TABLE "public"."personnel" TO "anon", "authenticated", "service_role";

-- 13.9. Permisos para profiles
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";

-- 13.10. Permisos para signed_responsivas
GRANT ALL ON TABLE "public"."signed_responsivas" TO "anon", "authenticated", "service_role";

-- 13.11. Permisos para special_accesses
GRANT ALL ON TABLE "public"."special_accesses" TO "anon", "authenticated", "service_role";
GRANT ALL ON SEQUENCE "public"."special_accesses_id_seq" TO "anon", "authenticated", "service_role";

-- 13.12. Permisos para tickets
GRANT ALL ON TABLE "public"."tickets" TO "anon", "authenticated", "service_role";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "anon", "authenticated", "service_role";

-- 13.13. Permisos para la vista personnel_with_status
GRANT ALL ON TABLE "public"."personnel_with_status" TO "anon", "authenticated", "service_role";

-- 13.14. Permisos para funciones
GRANT ALL ON FUNCTION "public"."clean_personnel_floors_on_card_change"()      TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"()                       TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"()                         TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"()                             TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."search_personnel_fuzzy"("text", "text", int4)  TO "anon", "authenticated", "service_role";

-- 13.15. Permisos para funciones de pg_trgm
GRANT ALL ON FUNCTION "public"."similarity"("text", "text")                  TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text")             TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."show_trgm"("text")                           TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."unaccent"("text")                            TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text")           TO "anon", "authenticated", "service_role";

-- 13.16. Default privileges para nuevos objetos creados por postgres
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres", "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres", "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES     TO "postgres", "anon", "authenticated", "service_role";

-- =============================================================================
-- 14. VERIFICACIÓN — Consultas para confirmar que todo está correcto
-- =============================================================================
-- Ejecutar las siguientes consultas después del setup para verificar el estado:

-- SELECT '✅ Setup completado' AS mensaje;
--
-- -- Verificar extensiones
-- SELECT name, installed_version FROM pg_available_extensions WHERE installed_version IS NOT NULL ORDER BY name;
--
-- -- Verificar tablas
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
--
-- -- Verificar vistas
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name;
--
-- -- Verificar RLS
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity ORDER BY tablename;
--
-- -- Verificar políticas
-- SELECT tablename, policyname, permissive, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
--
-- -- Verificar tipo enum
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype;
--
-- -- Verificar funciones
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name;

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
