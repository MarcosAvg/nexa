create or replace function public.search_personnel_fuzzy (
  p_last_name  text,
  p_first_name text,
  p_limit      integer default 20
)
  returns SETOF public.personnel
  language plpgsql
  set search_path to 'public', 'extensions'
  AS $function$
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
$function$;

grant execute on function "public"."search_personnel_fuzzy"(text, text, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."search_personnel_fuzzy"(text, text, integer) from public;
