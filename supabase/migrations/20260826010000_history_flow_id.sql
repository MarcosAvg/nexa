-- Historial: agrupar acciones de un mismo flujo (flow_id).

-- 1) Estructura
alter table "public"."history_logs" add column "flow_id" uuid;
create index idx_history_flow_id on public.history_logs using btree (flow_id);

-- 2) Backfill: agrupar registros existentes en flujos.
--    Regla: mismo usuario (performed_by) + proximidad temporal.
--    Una brecha > 10s corta un flujo; cada grupo recibe un flow_id único.
--    Las filas con performed_by NULL quedan sin agrupar (flow_id NULL).

WITH marks AS (
    SELECT id, performed_by, "timestamp",
           CASE
               WHEN performed_by IS NULL THEN NULL
               WHEN lag("timestamp") OVER (PARTITION BY performed_by ORDER BY "timestamp", id) IS NULL THEN 1
               WHEN extract(epoch FROM ("timestamp" - lag("timestamp") OVER (PARTITION BY performed_by ORDER BY "timestamp", id))) > 10 THEN 1
               ELSE 0
           END AS brk
    FROM history_logs
),
groups AS (
    SELECT id, performed_by,
           SUM(COALESCE(brk, 0)) OVER (PARTITION BY performed_by ORDER BY "timestamp", id) AS grp
    FROM marks
    WHERE performed_by IS NOT NULL
),
group_ids AS (
    SELECT performed_by, grp, gen_random_uuid() AS flow_id
    FROM groups
    GROUP BY performed_by, grp
)
UPDATE history_logs h
SET flow_id = gi.flow_id
FROM groups g
JOIN group_ids gi ON gi.performed_by = g.performed_by AND gi.grp = g.grp
WHERE h.id = g.id;
