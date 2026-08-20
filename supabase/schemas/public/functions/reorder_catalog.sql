create or replace function public.reorder_catalog (
  p_table text,
  p_ids   bigint[]
)
  returns void
  language plpgsql
  set search_path to 'public', 'extensions'
  AS $function$
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
$function$;

grant execute on function "public"."reorder_catalog"(text, bigint[]) to "authenticated", "postgres", "service_role";

revoke all on function "public"."reorder_catalog"(text, bigint[]) from public;
