-- Uniformidad del historial: rechazos + normalizar acciones legadas + re-agrupar flujos por entidad.

-- ── D) Rechazos históricos: convertir TICKET COMPLETE pareados con PERSONNEL REJECT_* en TICKET REJECT
--    y eliminar la fila PERSONNEL redundante (opción A).
DO $$
DECLARE
    r RECORD;
    v_tipo text;
BEGIN
    FOR r IN
        WITH seq AS (
            SELECT id, performed_by, "timestamp", entity_type, action, entity_name,
                   lead(id)        OVER (PARTITION BY performed_by ORDER BY "timestamp", id) AS nxt_id,
                   lead(entity_type) OVER (PARTITION BY performed_by ORDER BY "timestamp", id) AS nxt_et,
                   lead(action)    OVER (PARTITION BY performed_by ORDER BY "timestamp", id) AS nxt_action,
                   lead("timestamp") OVER (PARTITION BY performed_by ORDER BY "timestamp", id) AS nxt_ts
            FROM history_logs
        )
        SELECT s.id AS ticket_id, s.nxt_id AS rej_id, s.nxt_action AS rej_action, s.entity_name
        FROM seq s
        WHERE s.entity_type = 'TICKET'
          AND s.action = 'COMPLETE'
          AND s.nxt_et = 'PERSONNEL'
          AND s.nxt_action IN ('REJECT_ALTA', 'REJECT_MODIFICATION', 'REJECT_TICKET')
          AND (s.nxt_ts - s."timestamp") <= interval '5 seconds'
    LOOP
        v_tipo := CASE r.rej_action
            WHEN 'REJECT_ALTA' THEN 'Alta de Persona'
            WHEN 'REJECT_MODIFICATION' THEN 'Modificación'
            ELSE 'Ticket'
        END;

        UPDATE history_logs
           SET action = 'REJECT',
               details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
                   'message', 'Ticket de ' || v_tipo || ' rechazado',
                   'ticketType', v_tipo
               )
         WHERE id = r.ticket_id;

        DELETE FROM history_logs WHERE id = r.rej_id;
    END LOOP;
END $$;

-- ── E) Normalizar acciones legadas ──
UPDATE history_logs SET action = 'COMPLETE' WHERE action = 'COMPLETE_TICKET';
UPDATE history_logs SET action = 'CANCEL'   WHERE action = 'BAJA';

-- ── F) Re-derivar flow_id con ancla por entidad (no por tiempo).
-- Regla: dos registros se unen si comparten entity_id o se vinculan por
-- related_card_id / related_person_id, DENTRO de una ventana de ~10s.
-- Entidades distintas sin vínculo nunca se fusionan.
-- Filas sin performed_by quedan con flow_id NULL.
DO $$
DECLARE
    r RECORD;
    cur_user uuid := NULL;
    cur_group uuid;
    member_ids text[] := ARRAY[]::text[];
    row_ids text[];
    last_ts timestamptz;
BEGIN
    UPDATE history_logs SET flow_id = NULL;

    FOR r IN
        SELECT id, performed_by, "timestamp", entity_id, details
        FROM history_logs
        ORDER BY performed_by, "timestamp", id
    LOOP
        IF r.performed_by IS NULL THEN
            CONTINUE;
        END IF;

        row_ids := ARRAY[]::text[];
        IF r.entity_id IS NOT NULL THEN row_ids := row_ids || r.entity_id::text; END IF;
        IF r.details ? 'related_card_id' THEN row_ids := row_ids || (r.details->>'related_card_id'); END IF;
        IF r.details ? 'related_person_id' THEN row_ids := row_ids || (r.details->>'related_person_id'); END IF;

        IF cur_user IS DISTINCT FROM r.performed_by OR cur_group IS NULL THEN
            cur_user := r.performed_by;
            cur_group := gen_random_uuid();
            member_ids := row_ids;
            last_ts := r."timestamp";
            UPDATE history_logs SET flow_id = cur_group WHERE id = r.id;
            CONTINUE;
        END IF;

        IF (r."timestamp" - last_ts) <= interval '10 seconds'
           AND cardinality(row_ids) > 0
           AND EXISTS (SELECT 1 FROM unnest(member_ids) m WHERE m = ANY(row_ids))
        THEN
            IF cardinality(row_ids) > 0 THEN
                member_ids := (SELECT array_agg(DISTINCT x) FROM unnest(member_ids || row_ids) x);
            END IF;
            last_ts := r."timestamp";
            UPDATE history_logs SET flow_id = cur_group WHERE id = r.id;
        ELSE
            cur_group := gen_random_uuid();
            member_ids := row_ids;
            last_ts := r."timestamp";
            UPDATE history_logs SET flow_id = cur_group WHERE id = r.id;
        END IF;
    END LOOP;
END $$;
