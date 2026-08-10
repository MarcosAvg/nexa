-- =============================================================
-- UPDATE CATALOG ORDER — Orden personalizado de catálogos
-- Añade la columna sort_order a los 4 catálogos para que el orden
-- definido por el administrador se refleje en todas las listas
-- desplegables del sistema. Re-ejecutar en el SQL Editor de Supabase.
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================

-- 1/3. Columna sort_order en cada catálogo
ALTER TABLE "public"."buildings"        ADD COLUMN IF NOT EXISTS "sort_order" bigint;
ALTER TABLE "public"."dependencies"     ADD COLUMN IF NOT EXISTS "sort_order" bigint;
ALTER TABLE "public"."schedules"        ADD COLUMN IF NOT EXISTS "sort_order" bigint;
ALTER TABLE "public"."special_accesses" ADD COLUMN IF NOT EXISTS "sort_order" bigint;

-- 2/3. Backfill: conservar el orden actual (por id)
UPDATE "public"."buildings"        SET "sort_order" = "id" WHERE "sort_order" IS NULL;
UPDATE "public"."dependencies"     SET "sort_order" = "id" WHERE "sort_order" IS NULL;
UPDATE "public"."schedules"        SET "sort_order" = "id" WHERE "sort_order" IS NULL;
UPDATE "public"."special_accesses" SET "sort_order" = "id" WHERE "sort_order" IS NULL;

-- 3/3. RPC para reordenar un catálogo completo en una sola llamada
CREATE OR REPLACE FUNCTION "public"."reorder_catalog"(
    "p_table" text,
    "p_ids" bigint[]
)
RETURNS void
LANGUAGE "plpgsql"
AS $$
DECLARE
    i integer;
    n integer;
BEGIN
    IF "p_table" NOT IN ('buildings', 'dependencies', 'schedules', 'special_accesses') THEN
        RAISE EXCEPTION 'Tabla de catálogo no permitida: %', "p_table";
    END IF;

    n := array_length("p_ids", 1);
    IF n IS NULL OR n = 0 THEN
        RETURN;
    END IF;

    FOR i IN 1 .. n LOOP
        EXECUTE format('UPDATE public.%I SET sort_order = $1 WHERE id = $2', "p_table")
            USING i, "p_ids"[i];
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."reorder_catalog"(text, bigint[]) TO "authenticated";
