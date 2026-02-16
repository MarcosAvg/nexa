-- ==============================================================================
-- RESET AND SEED SCRIPT (DATA ONLY)
-- Reference: scripts/full_db_reset.sql
-- ==============================================================================
-- This script performs a hard reset of the APP DATA (Personnel, Cards, Catalogs).
-- It does NOT drop tables or tablespaces, only truncates data.
-- ==============================================================================

-- 1. CLEAN DATA (TRUNCATE with CASCADE)
TRUNCATE TABLE signed_responsivas RESTART IDENTITY CASCADE;
TRUNCATE TABLE history_logs RESTART IDENTITY CASCADE; -- Optional: Clear history to start fresh
TRUNCATE TABLE tickets RESTART IDENTITY CASCADE;
TRUNCATE TABLE cards RESTART IDENTITY CASCADE;
TRUNCATE TABLE personnel RESTART IDENTITY CASCADE;
TRUNCATE TABLE schedules RESTART IDENTITY CASCADE;
TRUNCATE TABLE special_accesses RESTART IDENTITY CASCADE;
TRUNCATE TABLE dependencies RESTART IDENTITY CASCADE;
TRUNCATE TABLE buildings RESTART IDENTITY CASCADE;

-- 2. SEED CATALOGS (From full_db_reset.sql)

-- Buildings
INSERT INTO buildings (name, floors) VALUES 
('Torre Administrativa', '{"S1","S2","PB","P1","P2","P3","P4","P5"}'),
('Palacio de Gobierno', '{"PB","P1","P2"}');

-- Dependencies
INSERT INTO dependencies (name) VALUES 
('Secretaría de Finanzas'), 
('Secretaría de Educación'), 
('Dirección de Tecnologías');

-- Special Accesses
INSERT INTO special_accesses (name) VALUES 
('Comedores'), 
('Estacionamiento VIP'), 
('Archivo General');

-- Schedules
INSERT INTO schedules (name, days, default_entry, default_exit) VALUES 
('Administrativo', '{"Lunes","Martes","Miércoles","Jueves","Viernes"}', '08:00:00', '16:00:00'),
('Seguridad 24/7', '{"Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"}', '00:00:00', '23:59:59');

-- 3. SEED PERSONNEL
-- Generating 15 dummy employees linked to the above catalogs
INSERT INTO personnel (
    first_name, last_name, employee_no, email, 
    position, area, 
    dependency_id, building_id, 
    floor, schedule_id, 
    special_accesses, status,
    floors_p2000, floors_kone -- Assuming these exist based on app code, even if not in reference SQL
)
SELECT 
    n.first_name, 
    n.last_name, 
    'EMP-' || (1000 + row_number() OVER ())::text, -- Sequential IDs
    lower(n.first_name || '.' || n.last_name || '@nexa.com'),
    case (row_number() OVER () % 4) 
        when 0 then 'Director' 
        when 1 then 'Analista' 
        when 2 then 'Coordinador' 
        else 'Asistente' 
    end as position,
    'General' as area,
    (SELECT id FROM dependencies ORDER BY random() LIMIT 1),
    (SELECT id FROM buildings ORDER BY random() LIMIT 1),
    'P' || floor(random()*5 + 1)::text as floor,
    (SELECT id FROM schedules ORDER BY random() LIMIT 1),
    ARRAY[(SELECT name FROM special_accesses ORDER BY random() LIMIT 1)] as special_accesses,
    'active' as status,
    ARRAY['P1','P2'] as floors_p2000,
    ARRAY['P3','P4'] as floors_kone
FROM (
    VALUES 
    ('Roberto', 'Mendez'), ('Claudia', 'Silva'), ('Fernando', 'Vega'),
    ('Patricia', 'Rios'), ('Hector', 'Castillo'), ('Laura', 'Paz'),
    ('Diego', 'Luna'), ('Sofia', 'Vargas'), ('Manuel', 'Cruz'),
    ('Elena', 'Navarro'), ('Javier', 'Ortega'), ('Carmen', 'Salas'),
    ('Ricardo', 'Mejia'), ('Adriana', 'Cortes'), ('Gustavo', 'Lara')
) AS n(first_name, last_name);

-- 4. SEED CARDS
-- 10 Associated Cards (KONE & P2000 mixed)
INSERT INTO cards (folio, type, status, person_id, programming_status, responsiva_status)
SELECT 
    CASE WHEN (row_number() over () % 2) = 0 THEN 'P2000-' ELSE 'KONE-' END || (20000 + row_number() over ())::text,
    CASE WHEN (row_number() over () % 2) = 0 THEN 'P2000' ELSE 'KONE' END,
    'active',
    p.id,
    'done',
    'signed'
FROM personnel p
LIMIT 10;

-- 5 Unassigned Available Cards
INSERT INTO cards (folio, type, status, person_id, programming_status, responsiva_status) VALUES
('KONE-FREE-001', 'KONE', 'available', NULL, NULL, NULL),
('KONE-FREE-002', 'KONE', 'available', NULL, NULL, NULL),
('P2000-FREE-001', 'P2000', 'available', NULL, NULL, NULL),
('P2000-FREE-002', 'P2000', 'available', NULL, NULL, NULL),
('P2000-BLOCKED', 'P2000', 'blocked', NULL, NULL, NULL);

-- 5. SEED HISTORY LOGS
-- Adding some sample activity logs with proactive snapshots
INSERT INTO history_logs (entity_type, entity_id, entity_name, action, details)
VALUES 
('PERSONNEL', (SELECT id FROM personnel LIMIT 1), (SELECT first_name || ' ' || last_name FROM personnel LIMIT 1), 'CREATE', '{"message": "Registro inicial de personal"}'),
('CARD', (SELECT id FROM cards LIMIT 1), (SELECT 'Tarjeta: ' || folio || ' (' || type || ')' FROM cards LIMIT 1), 'CREATE', '{"message": "Alta de tarjeta física"}'),
('CARD', (SELECT id FROM cards LIMIT 1), (SELECT 'Tarjeta: ' || folio || ' (' || type || ')' FROM cards LIMIT 1), 'UPDATE_STATUS', '{"message": "Activación de tarjeta"}');

-- Verification
SELECT 
    (SELECT count(*) FROM personnel) as personnel_count,
    (SELECT count(*) FROM cards) as cards_count,
    (SELECT count(*) FROM buildings) as buildings_count;

