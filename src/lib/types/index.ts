
export interface Enlace {
    id: string;
    person_id: string;
    extension: string;
    created_at: string;
    building?: string;
    floor?: string;
    personnel?: Person;
}

export interface Person {
    id: string;
    first_name: string;
    last_name: string;
    employee_no: string;
    // Estado en base de datos
    status_raw: string;
    // Estado mostrado (calculado)
    status: string;
    name: string; // Calculado: first_name + last_name
    building: string;
    dependency: string;
    schedule: {
        days: string;
        entry: string;
        exit: string;
    } | null;
    cards: Card[];
    /** Pisos asignados agrupados por clave de tipo de medio (ej. `{ p2000: [...] }`). */
    floorsByMedia: Record<string, string[]>;
    specialAccesses: string[];
    email?: string | null;
    area?: string;
    position?: string;
    floor?: string;
    photo_url?: string | null;
}

export interface Card {
    id: string;
    folio: string;
    type: string;
    status: string;
    person_id: string | null;
    programming_status: string | null;
    responsiva_status: string | null;
    has_floors?: boolean;
    // Propiedades calculadas/combinadas
    personName?: string;
    personStatus?: string;
    personnel?: {
        first_name: string;
        last_name: string;
        status?: string;
    };
}

export interface Ticket {
    id: number;
    title: string;
    description: string;
    type: "Programación" | "Firma Responsiva" | "Cobro" | "Bloqueo" | "Otro" | string;
    priority: "Alta" | "Media" | "Baja" | string;
    status: "Pendiente" | "En Proceso" | "Completado" | "pending" | "completed";
    created_at: string;
    person_id: string | null;
    access_media_id: string | null;
    payload: any;

    // Propiedades de join (retornadas por Supabase en queries con select anidado)
    cards?: { id: string; folio: string; type: string };

    // Propiedades calculadas/combinadas
    personName?: string;
    cardType?: string;
    cardFolio?: string;
    personnel?: {
        first_name: string;
        last_name: string;
        status?: string;
        created_at?: string;
        dependency_id?: string;
    };

    // Propiedades enriquecidas por ticketService
    movementType?: string;
    assignmentDate?: string;
}

export interface UserProfile {
    id: string;
    role: 'admin' | 'operator' | 'viewer';
    full_name: string;
    email: string;
    avatar_url?: string;
}

export interface CatalogItem {
    id: string; // or number depending on DB
    name: string;
    /** Posición personalizada para las listas desplegables. */
    sort_order?: number;
    [key: string]: any;
}

export interface DashboardMetrics {
    totalPersonnel: number;
    statusCounts: {
        activo: number;
        parcial: number;
        inactivo: number;
        bloqueado: number;
        baja: number;
    };
    cardCoverage: {
        conP2000: number;
        sinP2000: number;
        conKone: number;
        sinKone: number;
        operativos: number;
    };
    topDependencies: { name: string; total: number; activos: number }[];
    topBuildings: { name: string; total: number }[];
    dataQuality: {
        sinEmail: number;
        sinSchedule: number;
        sinPosition: number;
        sinArea: number;
        total: number;
    };
}

/** A single log entry from the history_logs table */
export interface HistoryLog {
    id: number;
    timestamp: string;
    entity_type: string;
    entity_id: string | null;
    entity_name: string | null;
    action: string;
    details: Record<string, unknown>;
    performed_by: string | null;
}

export interface CardlessRegistry {
    id: number;
    person_id: string | null;
    first_name: string | null;
    last_name: string | null;
    employee_no: string | null;
    building_id: number | null;
    dependency_id: number | null;
    floor: string | null;
    reason: string;
    comments: string | null;
    recorded_at: string;
    recorded_by: string;
    /**
     * Snapshot of whether the person had a pending KONE "Firma Responsiva"
     * ticket at the moment this record was created. Null means the record
     * pre-dates this feature (backfilled by migration).
     */
    kone_status_at_registration: boolean | null;
    // Propiedades calculadas/combinadas
    personName?: string;
    buildingName?: string;
    dependencyName?: string;
    recordedByName?: string;
    /** @deprecated Use kone_status_at_registration for historical accuracy */
    pendingKoneResponsiva?: boolean;
}

export interface AccessMediaType {
    id: string;
    key: string;
    name: string;
    category: string;
    identifier_label: string;
    requires_identifier: boolean;
    requires_programming: boolean;
    requires_responsiva: boolean;
    supports_replacement: boolean;
    has_floors: boolean;
    active: boolean;
    sort_order: number | null;
    created_at: string;
}

export interface AccessMedia {
    id: string;
    media_type_id: string;
    identifier: string | null;
    status: string;
    person_id: string | null;
    programming_status: string;
    responsiva_status: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    // Propiedades de join
    access_media_types?: AccessMediaType;
    personnel?: {
        first_name: string;
        last_name: string;
        status?: string;
    };
    // Propiedades calculadas/combinadas
    personName?: string;
    personStatus?: string;
}

export interface AccessAssignment {
    id: string;
    person_id: string;
    media_type_id: string;
    access_media_id: string | null;
    assigned_at: string;
    revoked_at: string | null;
    status: string;
}

export interface AccessAssignmentPermission {
    id: number;
    assignment_id: string;
    resource_type: string;
    resource_key: string;
    permission: string;
    building_id?: number | null;
    floor_id?: number | null;
    special_access_id?: number | null;
}

export interface Floor {
    id: number;
    label: string;
    sort_order: number | null;
}

export interface DocumentTemplate {
    id: string;
    key: string;
    name: string;
    document_type: string;
    version: number;
    active: boolean;
    content: string | null;
    created_at: string;
}

export interface SignedDocument {
    id: string;
    person_id: string | null;
    access_media_id: string | null;
    template_id: string | null;
    document_type: string;
    content: Record<string, unknown> | null;
    signature: string;
    legal_hash: string | null;
    legal_snapshot: string | null;
    created_at: string;
    // Propiedades de join
    document_templates?: DocumentTemplate;
    access_media?: AccessMedia;
}
