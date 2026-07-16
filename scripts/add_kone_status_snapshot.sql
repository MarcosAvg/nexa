-- ============================================================
-- Migración: snapshot del estado de tarjeta KONE al registrar
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase (como postgres).
--
-- Qué hace este script:
--   1. Agrega la columna kone_status_at_registration (boolean, nullable).
--   2. Rellena retroactivamente los registros existentes usando el
--      historial de tickets: si en la fecha del registro existía un
--      ticket "Firma Responsiva" pendiente de tipo KONE para esa
--      persona, se marca como TRUE (pendiente), de lo contrario FALSE.
--      Los registros sin person_id quedan en NULL.
--   3. Crea un índice para consultas futuras por este campo.
--   4. Limpia la función auxiliar temporal usada en el backfill.
-- ============================================================

-- 1. Agregar columna (idempotente)
ALTER TABLE public.cardless_registry
    ADD COLUMN IF NOT EXISTS kone_status_at_registration boolean DEFAULT NULL;

COMMENT ON COLUMN public.cardless_registry.kone_status_at_registration IS
    'Snapshot: TRUE si la persona tenía un ticket "Firma Responsiva" pendiente '
    'para una tarjeta KONE al momento de hacer este registro. '
    'NULL = registro manual sin person_id vinculado, o registro pre-migración sin datos suficientes.';

-- 2. Backfill retroactivo
--    Para cada registro que tenga person_id pero aún no tenga snapshot,
--    buscamos si en tickets existía, en el momento del registro (recorded_at),
--    algún ticket de "Firma Responsiva" en estado "pending" vinculado a una
--    tarjeta KONE para esa persona.
--
--    Como los tickets no tienen updated_at confiable para saber si estaban
--    pendientes EN ESA FECHA, usamos created_at del ticket:
--      - Si el ticket se creó ANTES o EN el momento del registro → contaba.
--      - Si se creó DESPUÉS → no existía aún cuando se hizo el registro.
--
--    Nota: esto es una aproximación razonable. Los registros pre-migración
--    quedarán con el mejor dato disponible. Los nuevos registros (post-migración)
--    tendrán el valor exacto capturado desde el frontend.

UPDATE public.cardless_registry cr
SET kone_status_at_registration = (
    EXISTS (
        SELECT 1
        FROM public.tickets t
        JOIN public.cards c ON c.id::text = t.card_id::text
        WHERE t.person_id  = cr.person_id
          AND t.type        = 'Firma Responsiva'
          AND t.status      = 'pending'
          AND c.type        = 'KONE'
          AND t.created_at <= cr.recorded_at   -- ticket existía al momento del registro
    )
)
WHERE cr.person_id IS NOT NULL
  AND cr.kone_status_at_registration IS NULL;

-- Para registros con person_id pero sin ningún ticket relacionado en el pasado,
-- el EXISTS devuelve FALSE, que es correcto (tarjeta ya entregada o sin tarjeta KONE).

-- 3. Índice para filtros/reportes futuros
CREATE INDEX IF NOT EXISTS idx_cardless_registry_kone_status
    ON public.cardless_registry (kone_status_at_registration)
    WHERE kone_status_at_registration IS NOT NULL;

-- ============================================================
-- Verificación rápida (opcional — puedes ejecutar aparte)
-- ============================================================
-- SELECT
--     COUNT(*)                                              AS total,
--     COUNT(*) FILTER (WHERE kone_status_at_registration IS NULL AND person_id IS NOT NULL) AS sin_snapshot_con_persona,
--     COUNT(*) FILTER (WHERE kone_status_at_registration IS NULL AND person_id IS NULL)     AS sin_persona,
--     COUNT(*) FILTER (WHERE kone_status_at_registration = true)                            AS pendiente_al_registrar,
--     COUNT(*) FILTER (WHERE kone_status_at_registration = false)                           AS entregada_al_registrar
-- FROM public.cardless_registry;
