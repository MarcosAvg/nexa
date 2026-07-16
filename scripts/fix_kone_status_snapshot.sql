-- ============================================================
-- Corrección: recalcular kone_status_at_registration
-- usando signed_responsivas + tickets como fuente de verdad
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase (como postgres).
--
-- Lógica (en orden de precedencia):
--
--   CASO 1 → FALSE (tarjeta ya entregada al registrar)
--     Existía al menos una firma KONE en signed_responsivas
--     con created_at <= recorded_at.
--     La persona ya había recibido y firmado su tarjeta antes
--     (o exactamente cuando) se hizo el registro sin tarjeta.
--
--   CASO 2 → TRUE (tarjeta pendiente al registrar)
--     No había firma previa (CASO 1 no aplica), PERO existía un
--     ticket "Firma Responsiva" vinculado a una tarjeta KONE cuyo
--     created_at <= recorded_at.
--     La tarjeta estaba programada/asignada pero aún sin firma.
--     Incluye tickets actualmente activos Y los ya completados
--     (estos últimos detectables porque la firma llegó después
--     del registro — su created_at en signed_responsivas es
--     > recorded_at, por lo que CASO 1 no los captura).
--
--   CASO 3 → NULL (sin tarjeta KONE en ese momento)
--     Ni firma previa ni ticket previo. La persona no tenía
--     tarjeta KONE asignada cuando se hizo el registro.
--     Se deja NULL para distinguirlo de FALSE ("entregada").
--
--   Sin person_id → no se toca (registros manuales).
-- ============================================================

UPDATE public.cardless_registry cr
SET kone_status_at_registration =
    CASE
        -- CASO 1: ya tenía firma antes del registro → entregada
        WHEN EXISTS (
            SELECT 1
            FROM public.signed_responsivas sr
            WHERE sr.person_id = cr.person_id
              AND sr.card_type  = 'KONE'
              AND sr.created_at <= cr.recorded_at
        ) THEN FALSE

        -- CASO 2: no había firma pero sí ticket KONE previo → pendiente
        WHEN EXISTS (
            SELECT 1
            FROM public.tickets t
            JOIN public.cards c ON c.id::text = t.card_id::text
            WHERE t.person_id  = cr.person_id
              AND t.type        = 'Firma Responsiva'
              AND c.type        = 'KONE'
              AND t.created_at <= cr.recorded_at
        ) THEN TRUE

        -- CASO 2b: tarjeta KONE con responsiva_status = 'legacy' asignada
        --          antes del registro → se trata como entregada (firma pre-digital)
        WHEN EXISTS (
            SELECT 1
            FROM public.cards c
            WHERE c.person_id        = cr.person_id
              AND c.type             = 'KONE'
              AND c.responsiva_status = 'legacy'
        ) THEN FALSE

        -- CASO 3: ni firma ni ticket ni legacy → sin tarjeta KONE en ese momento
        ELSE NULL
    END
WHERE cr.person_id IS NOT NULL;

-- ============================================================
-- Verificación (ejecutar aparte para confirmar resultados)
-- ============================================================
-- SELECT
--     COUNT(*)                                                        AS total,
--     COUNT(*) FILTER (WHERE person_id IS NULL)                       AS sin_persona_vinculada,
--     COUNT(*) FILTER (WHERE kone_status_at_registration IS NULL)     AS sin_tarjeta_kone,
--     COUNT(*) FILTER (WHERE kone_status_at_registration = true)      AS pendiente_al_registrar,
--     COUNT(*) FILTER (WHERE kone_status_at_registration = false)     AS entregada_al_registrar
-- FROM public.cardless_registry;
