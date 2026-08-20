create view "public"."cards_ordered" with (security_invoker=true) AS  SELECT id,
    folio,
    type,
    status,
    responsiva_status,
    programming_status,
    person_id,
    updated_at,
        CASE
            WHEN (folio ~ '^[0-9]+$'::text) THEN lpad(folio, 20, '0'::text)
            ELSE folio
        END AS folio_sort
   FROM public.cards;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."cards_ordered" to "authenticated", "postgres", "service_role";
