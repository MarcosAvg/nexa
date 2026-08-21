create view "public"."personnel_with_status" with (security_invoker=true) AS  WITH person_ready_cards AS (
         SELECT p_1.id,
            count(DISTINCT amt.name) FILTER (WHERE ((amt.name = ANY (ARRAY['P2000'::text, 'KONE'::text])) AND (am.status = 'active'::text) AND (am.programming_status = 'done'::text) AND (am.responsiva_status = ANY (ARRAY['signed'::text, 'legacy'::text])))) AS core_ready_types,
            bool_or((amt.name = ANY (ARRAY['P2000'::text, 'KONE'::text]))) AS has_core_cards,
            bool_or(((amt.name = 'AccessPRO'::text) AND (am.status = 'active'::text))) AS has_active_accesspro
           FROM (public.personnel p_1
             LEFT JOIN public.access_media am ON ((am.person_id = p_1.id))
             LEFT JOIN public.access_media_types amt ON ((amt.id = am.media_type_id)))
          GROUP BY p_1.id
        )
 SELECT p.id,
    p.first_name,
    p.last_name,
    p.employee_no,
    p.email,
    p.area,
    p."position",
    p.dependency_id,
    p.building_id,
    p.floor,
    p.floors_p2000,
    p.floors_kone,
    p.schedule_id,
    p.entry_time,
    p.exit_time,
    p.special_accesses,
    p.status,
    p.photo_url,
    p.created_at,
    COALESCE(b.name, 'N/A'::text) AS building_name,
    COALESCE(d.name, 'N/A'::text) AS dependency_name,
    COALESCE(s.name, 'Sin Horario'::text) AS schedule_name,
        CASE
            WHEN ((p.status = 'active'::text) AND (prc.core_ready_types >= 2)) THEN 'Activo/a'::text
            WHEN ((p.status = 'active'::text) AND (prc.core_ready_types = 1)) THEN 'Parcial'::text
            WHEN ((p.status = 'active'::text) AND (prc.core_ready_types = 0) AND (COALESCE(prc.has_core_cards, false) = false) AND (COALESCE(prc.has_active_accesspro, false) = true)) THEN 'Activo/a'::text
            WHEN ((p.status = 'active'::text) AND (prc.core_ready_types = 0)) THEN 'Sin Acceso'::text
            WHEN (p.status = 'blocked'::text) THEN 'Bloqueado/a'::text
            ELSE 'Baja'::text
        END AS computed_status
   FROM ((((public.personnel p
     LEFT JOIN person_ready_cards prc ON ((prc.id = p.id)))
     LEFT JOIN public.buildings b ON ((b.id = p.building_id)))
     LEFT JOIN public.dependencies d ON ((d.id = p.dependency_id)))
     LEFT JOIN public.schedules s ON ((s.id = p.schedule_id)));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."personnel_with_status" to "authenticated", "postgres", "service_role";