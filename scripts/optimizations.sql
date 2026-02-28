-- ============================================================
-- NEXA: SCRIPT DE OPTIMIZACIÓN DE RENDIMIENTO (DASHBOARD & FILTERS)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. FUNCIÓN PARA MÉTRICAS DEL DASHBOARD (GET_DASHBOARD_METRICS)
-- Devuelve todos los conteos necesarios para el dashboard en una sola llamada de red.
-- Esto elimina la necesidad de descargar todos los registros al cliente.

CREATE OR REPLACE FUNCTION get_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION get_dashboard_metrics() TO authenticated;

-- 2. VISTA PARA FILTRADO POR ESTADO COMPUTADO
-- Esto permite filtrar "Activo", "Parcial" etc. desde el cliente usando `.eq('computed_status', 'Activo')`
-- sin descargar todos los registros.

CREATE OR REPLACE VIEW personnel_with_status AS
WITH person_ready_cards AS (
    SELECT p.id, COUNT(DISTINCT c.type) as ready_types
    FROM personnel p
    LEFT JOIN cards c ON c.person_id = p.id 
        AND c.status = 'active'
        AND c.programming_status = 'done'
        AND c.responsiva_status IN ('signed', 'legacy')
    GROUP BY p.id
)
SELECT 
    p.*,
    COALESCE(b.name, 'N/A') as building_name,
    COALESCE(d.name, 'N/A') as dependency_name,
    COALESCE(s.name, 'Sin Horario') as schedule_name,
    CASE 
        WHEN p.status = 'active' AND prc.ready_types >= 2 THEN 'Activo/a'
        WHEN p.status = 'active' AND prc.ready_types = 1 THEN 'Parcial'
        WHEN p.status = 'active' AND prc.ready_types = 0 THEN 'Sin Acceso'
        WHEN p.status = 'blocked' THEN 'Bloqueado/a'
        ELSE 'Baja'
    END as computed_status
FROM personnel p
LEFT JOIN person_ready_cards prc ON prc.id = p.id
LEFT JOIN buildings b ON b.id = p.building_id
LEFT JOIN dependencies d ON d.id = p.dependency_id
LEFT JOIN schedules s ON s.id = p.schedule_id;

-- Habilitar acceso a la vista (si tienes RLS en personnel, la vista suele heredar o requiere SELECT on view)
GRANT SELECT ON personnel_with_status TO authenticated;

-- COMENTARIO:
-- Una vez aplicada esta migración, el frontend podrá llamar a:
-- 1. `supabase.rpc('get_dashboard_metrics')` para ver el estado del sitio al instante.
-- 2. `supabase.from('personnel_with_status').select('*').eq('computed_status', 'Activo/a')` para filtrar eficientemente.
