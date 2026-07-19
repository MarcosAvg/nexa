
export interface Enlace {
    id: string;
    person_id: string;
    extension: string;
    created_at: string;
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
    floors_p2000: string[];
    floors_kone: string[];
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
    card_id: string | null;
    payload: any;
    // Propiedades calculadas/combinadas
    personName?: string;
    cardType?: string;
    cardFolio?: string;
    personnel?: {
        first_name: string;
        last_name: string;
        status?: string;
    };
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
