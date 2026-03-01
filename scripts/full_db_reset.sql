


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



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'operator',
    'viewer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_personnel_floors_on_card_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Si se eliminó una tarjeta o se cambió el person_id (desvinculación)
    IF (TG_OP = 'DELETE') OR (OLD.person_id IS NOT NULL AND (NEW.person_id IS NULL OR NEW.person_id <> OLD.person_id)) THEN

        -- Verificar si la persona aún tiene alguna tarjeta del mismo tipo
        IF NOT EXISTS (
            SELECT 1 FROM cards
            WHERE person_id = OLD.person_id
            AND type = OLD.type
            AND id <> OLD.id -- Excluir la que se está borrando o moviendo
        ) THEN
            -- Limpiar los pisos según el tipo
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


ALTER FUNCTION "public"."clean_personnel_floors_on_card_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_metrics"() RETURNS json
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
    -- Total Personal
    SELECT COUNT(*) INTO total_count FROM personnel;

    -- Status Counts (Basado en lógica de negocio de Nexa)
    -- Activo/a: status='active' AND min 2 ready cards
    -- Parcial: status='active' AND 1 ready card
    -- Sin Acceso: status='active' AND 0 ready cards
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
                WHEN db_status = 'active' AND ready_types = 0 THEN 'inactivo' -- Sin Acceso
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

    -- Card Coverage (Solo personal operativo: activo + parcial)
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

    -- Top Dependencies (Top 10)
    SELECT json_agg(t) INTO top_dependencies FROM (
        SELECT d.name, COUNT(p.id) as total, COUNT(p.id) FILTER (WHERE p.status = 'active') as activos
        FROM dependencies d
        LEFT JOIN personnel p ON p.dependency_id = d.id
        GROUP BY d.name
        ORDER BY total DESC
        LIMIT 10
    ) t;

    -- Top Buildings (Top 6)
    SELECT json_agg(t) INTO top_buildings FROM (
        SELECT b.name, COUNT(p.id) as total
        FROM buildings b
        LEFT JOIN personnel p ON p.building_id = b.id
        GROUP BY b.name
        ORDER BY total DESC
        LIMIT 6
    ) t;

    -- Data Quality
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


ALTER FUNCTION "public"."get_dashboard_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
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


ALTER FUNCTION "public"."get_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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


CREATE OR REPLACE FUNCTION "public"."search_personnel_fuzzy"("p_last_name" "text", "p_first_name" "text", "p_limit" integer DEFAULT 20) RETURNS SETOF "public"."personnel"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  search_term_1 text;
  search_term_2 text;
BEGIN
  -- Normalizar términos: quitar acentos, pasar a minúsculas y limpiar espacios
  search_term_1 := lower(unaccent(trim(regexp_replace(p_last_name, '\s+', ' ', 'g'))));
  search_term_2 := lower(unaccent(trim(regexp_replace(p_first_name, '\s+', ' ', 'g'))));
  RETURN QUERY
  SELECT p.*
  FROM personnel p
  WHERE p.status != 'inactive'
    AND (
      -- Opción 1: Apellido match term1 Y Nombre match term2 (o parcial)
      (
        (lower(unaccent(p.last_name)) ILIKE '%' || search_term_1 || '%' AND lower(unaccent(p.first_name)) ILIKE '%' || search_term_2 || '%')
        OR
        (lower(unaccent(p.last_name)) ILIKE '%' || search_term_2 || '%' AND lower(unaccent(p.first_name)) ILIKE '%' || search_term_1 || '%')
      )
      OR
      -- Opción 2: Si un término está vacío, buscar el otro en ambos campos
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


ALTER FUNCTION "public"."search_personnel_fuzzy"("p_last_name" "text", "p_first_name" "text", "p_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buildings" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "floors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buildings" OWNER TO "postgres";


ALTER TABLE "public"."buildings" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."buildings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


CREATE TABLE IF NOT EXISTS "public"."dependencies" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."dependencies" OWNER TO "postgres";


ALTER TABLE "public"."dependencies" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dependencies_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."history_logs" (
    "id" bigint NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "entity_name" "text",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "performed_by" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."history_logs" OWNER TO "postgres";


ALTER TABLE "public"."history_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."history_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "days" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "default_entry" time without time zone,
    "default_exit" time without time zone
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."personnel_with_status" AS
 WITH "person_ready_cards" AS (
         SELECT "p_1"."id",
            "count"(DISTINCT "c"."type") AS "ready_types"
           FROM ("public"."personnel" "p_1"
             LEFT JOIN "public"."cards" "c" ON ((("c"."person_id" = "p_1"."id") AND ("c"."status" = 'active'::"text") AND ("c"."programming_status" = 'done'::"text") AND ("c"."responsiva_status" = ANY (ARRAY['signed'::"text", 'legacy'::"text"])))))
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


ALTER VIEW "public"."personnel_with_status" OWNER TO "postgres";


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


ALTER TABLE "public"."schedules" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."schedules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


CREATE TABLE IF NOT EXISTS "public"."special_accesses" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."special_accesses" OWNER TO "postgres";


ALTER TABLE "public"."special_accesses" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."special_accesses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" bigint NOT NULL,
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


ALTER TABLE "public"."tickets" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tickets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."buildings"
    ADD CONSTRAINT "buildings_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."buildings"
    ADD CONSTRAINT "buildings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_folio_type_key" UNIQUE ("folio", "type");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dependencies"
    ADD CONSTRAINT "dependencies_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."dependencies"
    ADD CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."history_logs"
    ADD CONSTRAINT "history_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_employee_no_key" UNIQUE ("employee_no");



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signed_responsivas"
    ADD CONSTRAINT "signed_responsivas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."special_accesses"
    ADD CONSTRAINT "special_accesses_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."special_accesses"
    ADD CONSTRAINT "special_accesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_cards_folio" ON "public"."cards" USING "btree" ("folio");



CREATE INDEX "idx_cards_person_id" ON "public"."cards" USING "btree" ("person_id");



CREATE INDEX "idx_cards_prog_status" ON "public"."cards" USING "btree" ("programming_status");



CREATE INDEX "idx_cards_ready" ON "public"."cards" USING "btree" ("person_id", "status", "programming_status", "responsiva_status") WHERE (("status" = 'active'::"text") AND ("programming_status" = 'done'::"text") AND ("responsiva_status" = ANY (ARRAY['signed'::"text", 'legacy'::"text"])));



CREATE INDEX "idx_cards_resp_status" ON "public"."cards" USING "btree" ("responsiva_status");



CREATE INDEX "idx_cards_status" ON "public"."cards" USING "btree" ("status");



CREATE INDEX "idx_cards_type" ON "public"."cards" USING "btree" ("type");



CREATE INDEX "idx_history_action" ON "public"."history_logs" USING "btree" ("action");



CREATE INDEX "idx_history_entity" ON "public"."history_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_history_entity_id" ON "public"."history_logs" USING "btree" ("entity_id");



CREATE INDEX "idx_history_timestamp" ON "public"."history_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_personnel_building" ON "public"."personnel" USING "btree" ("building_id");



CREATE INDEX "idx_personnel_dependency" ON "public"."personnel" USING "btree" ("dependency_id");



CREATE INDEX "idx_personnel_employee_no" ON "public"."personnel" USING "btree" ("employee_no");



CREATE INDEX "idx_personnel_first_name" ON "public"."personnel" USING "btree" ("first_name");



CREATE INDEX "idx_personnel_last_name" ON "public"."personnel" USING "btree" ("last_name");



CREATE INDEX "idx_personnel_name" ON "public"."personnel" USING "btree" ("first_name", "last_name");



CREATE INDEX "idx_personnel_status" ON "public"."personnel" USING "btree" ("status");



CREATE INDEX "idx_tickets_assigned_to" ON "public"."tickets" USING "btree" ((("payload" ->> 'assignedTo'::"text")));



CREATE INDEX "idx_tickets_card_id" ON "public"."tickets" USING "btree" ("card_id");



CREATE INDEX "idx_tickets_person_id" ON "public"."tickets" USING "btree" ("person_id");



CREATE INDEX "idx_tickets_status" ON "public"."tickets" USING "btree" ("status");



CREATE INDEX "idx_tickets_type" ON "public"."tickets" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "trigger_clean_floors_on_card_management" AFTER DELETE OR UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."clean_personnel_floors_on_card_change"();



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."history_logs"
    ADD CONSTRAINT "history_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id");



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_dependency_id_fkey" FOREIGN KEY ("dependency_id") REFERENCES "public"."dependencies"("id");



ALTER TABLE ONLY "public"."personnel"
    ADD CONSTRAINT "personnel_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signed_responsivas"
    ADD CONSTRAINT "signed_responsivas_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."personnel"("id") ON DELETE CASCADE;



CREATE POLICY "Admins delete buildings" ON "public"."buildings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins delete dependencies" ON "public"."dependencies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins delete schedules" ON "public"."schedules" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins delete special" ON "public"."special_accesses" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins delete tickets" ON "public"."tickets" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins insert buildings" ON "public"."buildings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins insert dependencies" ON "public"."dependencies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins insert schedules" ON "public"."schedules" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins insert special" ON "public"."special_accesses" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins update all profiles" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles_1"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins update buildings" ON "public"."buildings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins update dependencies" ON "public"."dependencies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins update schedules" ON "public"."schedules" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins update special" ON "public"."special_accesses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins/Operators delete cards" ON "public"."cards" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators delete personnel" ON "public"."personnel" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators insert cards" ON "public"."cards" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators insert history" ON "public"."history_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators insert personnel" ON "public"."personnel" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators insert responsivas" ON "public"."signed_responsivas" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators update cards" ON "public"."cards" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Operators update personnel" ON "public"."personnel" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"]))))));



CREATE POLICY "Allow authenticated users to delete responsivas" ON "public"."signed_responsivas" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Buildings viewable by everyone" ON "public"."buildings" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Cards viewable by everyone" ON "public"."cards" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Dependencies viewable by everyone" ON "public"."dependencies" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Everyone insert tickets" ON "public"."tickets" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "History viewable by everyone" ON "public"."history_logs" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Operators update tickets" ON "public"."tickets" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'operator'::"public"."app_role"])))))) WITH CHECK (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."app_role") OR ("status" IS DISTINCT FROM 'completed'::"text")));



CREATE POLICY "Personnel viewable by everyone" ON "public"."personnel" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Profiles viewable by everyone" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Responsivas viewable" ON "public"."signed_responsivas" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Schedules viewable by everyone" ON "public"."schedules" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Special accesses viewable by everyone" ON "public"."special_accesses" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Tickets viewable by everyone" ON "public"."tickets" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."buildings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."history_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personnel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signed_responsivas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."special_accesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."clean_personnel_floors_on_card_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_personnel_floors_on_card_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_personnel_floors_on_card_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."personnel" TO "anon";
GRANT ALL ON TABLE "public"."personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."personnel" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_personnel_fuzzy"("p_last_name" "text", "p_first_name" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_personnel_fuzzy"("p_last_name" "text", "p_first_name" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_personnel_fuzzy"("p_last_name" "text", "p_first_name" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."buildings" TO "anon";
GRANT ALL ON TABLE "public"."buildings" TO "authenticated";
GRANT ALL ON TABLE "public"."buildings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."buildings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."buildings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."buildings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."dependencies" TO "anon";
GRANT ALL ON TABLE "public"."dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."dependencies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dependencies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dependencies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dependencies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."history_logs" TO "anon";
GRANT ALL ON TABLE "public"."history_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."history_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."history_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."history_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."history_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."personnel_with_status" TO "anon";
GRANT ALL ON TABLE "public"."personnel_with_status" TO "authenticated";
GRANT ALL ON TABLE "public"."personnel_with_status" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."schedules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."schedules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."schedules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."signed_responsivas" TO "anon";
GRANT ALL ON TABLE "public"."signed_responsivas" TO "authenticated";
GRANT ALL ON TABLE "public"."signed_responsivas" TO "service_role";



GRANT ALL ON TABLE "public"."special_accesses" TO "anon";
GRANT ALL ON TABLE "public"."special_accesses" TO "authenticated";
GRANT ALL ON TABLE "public"."special_accesses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."special_accesses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."special_accesses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."special_accesses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































