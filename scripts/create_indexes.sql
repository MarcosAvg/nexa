-- ÍNDICES DE RENDIMIENTO PARA NEXA
-- Ejecutar este script en el SQL Editor de Supabase para optimizar consultas en tablas grandes (4000+ registros).

-- ==========================================
-- 1. TABLA PERSONNEL (Personal)
-- ==========================================

-- Acelera la búsqueda por nombre completo (usado en selectores y barra de búsqueda)
CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel (first_name, last_name); 

-- Acelera la búsqueda por número de empleado exacto
CREATE INDEX IF NOT EXISTS idx_personnel_employee_no ON personnel (employee_no);

-- Acelera el filtrado por estado (ej. mostrar solo activos en la carga inicial)
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel (status);

-- Acelera los joins con dependencias y edificios
CREATE INDEX IF NOT EXISTS idx_personnel_dependency ON personnel (dependency_id);
CREATE INDEX IF NOT EXISTS idx_personnel_building ON personnel (building_id);


-- ==========================================
-- 2. TABLA HISTORY_LOGS (Historial)
-- ==========================================

-- CRÍTICO: Acelera el ordenamiento cronológico (ORDER BY timestamp DESC)
-- Evita que la base de datos tenga que ordenar toda la tabla en memoria cada vez.
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history_logs (timestamp DESC);

-- Acelera el filtrado por entidad (ej. "Ver historial de esta tarjeta" o "de este usuario")
CREATE INDEX IF NOT EXISTS idx_history_entity ON history_logs (entity_type, entity_id);

-- Acelera el filtrado por acción específica
CREATE INDEX IF NOT EXISTS idx_history_action ON history_logs (action);


-- ==========================================
-- 3. TABLA CARDS (Tarjetas)
-- ==========================================

-- Acelera la búsqueda por folio (muy común)
CREATE INDEX IF NOT EXISTS idx_cards_folio ON cards (folio);

-- Acelera la carga de tarjetas asignadas a una persona (Clave foránea)
CREATE INDEX IF NOT EXISTS idx_cards_person_id ON cards (person_id);

-- Acelera el filtrado por estado de la tarjeta
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards (status);


-- ==========================================
-- 4. TABLA TICKETS
-- ==========================================

-- Acelera la vista de tickets pendientes/activos
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

-- Acelera ver los tickets asociados a una persona
CREATE INDEX IF NOT EXISTS idx_tickets_person_id ON tickets (person_id);

-- Acelera ver los tickets asignados a un usuario del sistema (Dashboard)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets ((payload->>'assignedTo'));
-- ÍNDICES DE RENDIMIENTO PARA NEXA
-- Ejecutar este script en el SQL Editor de Supabase para optimizar consultas en tablas grandes (4000+ registros).

-- ==========================================
-- 1. TABLA PERSONNEL (Personal)
-- ==========================================

-- Acelera la búsqueda por nombre completo (usado en selectores y barra de búsqueda)
CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel (first_name, last_name); 

-- Acelera la búsqueda por número de empleado exacto
CREATE INDEX IF NOT EXISTS idx_personnel_employee_no ON personnel (employee_no);

-- Acelera el filtrado por estado (ej. mostrar solo activos en la carga inicial)
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel (status);

-- Acelera los joins con dependencias y edificios
CREATE INDEX IF NOT EXISTS idx_personnel_dependency ON personnel (dependency_id);
CREATE INDEX IF NOT EXISTS idx_personnel_building ON personnel (building_id);


-- ==========================================
-- 2. TABLA HISTORY_LOGS (Historial)
-- ==========================================

-- CRÍTICO: Acelera el ordenamiento cronológico (ORDER BY timestamp DESC)
-- Evita que la base de datos tenga que ordenar toda la tabla en memoria cada vez.
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history_logs (timestamp DESC);

-- Acelera el filtrado por entidad (ej. "Ver historial de esta tarjeta" o "de este usuario")
CREATE INDEX IF NOT EXISTS idx_history_entity ON history_logs (entity_type, entity_id);

-- Acelera el filtrado por acción específica
CREATE INDEX IF NOT EXISTS idx_history_action ON history_logs (action);


-- ==========================================
-- 3. TABLA CARDS (Tarjetas)
-- ==========================================

-- Acelera la búsqueda por folio (muy común)
CREATE INDEX IF NOT EXISTS idx_cards_folio ON cards (folio);

-- Acelera la carga de tarjetas asignadas a una persona (Clave foránea)
CREATE INDEX IF NOT EXISTS idx_cards_person_id ON cards (person_id);

-- Acelera el filtrado por estado de la tarjeta
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards (status);


-- ==========================================
-- 4. TABLA TICKETS
-- ==========================================

-- Acelera la vista de tickets pendientes/activos
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

-- Acelera ver los tickets asociados a una persona
CREATE INDEX IF NOT EXISTS idx_tickets_person_id ON tickets (person_id);

-- Acelera ver los tickets asignados a un usuario del sistema (Dashboard)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets ((payload->>'assignedTo'));
