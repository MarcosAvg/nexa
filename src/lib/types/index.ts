
export interface Person {
    id: string;
    first_name: string;
    last_name: string;
    employee_no: string;
    // Database status
    status_raw: string;
    // Display status (computed)
    status: string;
    name: string; // Computed: first_name + last_name
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
}

export interface Card {
    id: string;
    folio: string;
    type: string;
    status: string;
    person_id: string | null;
    personId?: string | null; // Alias for UI consistency
    programming_status: string | null;
    responsiva_status: string | null;
    // Computed/Joined properties
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
    personId?: string | null; // Alias for UI consistency
    card_id: string | null;
    cardId?: string | null; // Alias for UI consistency
    payload: any;
    // Computed/Joined properties
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

export interface AppStateData {
    personnel: Person[];
    extraCards: Card[];
    pendingItems: Ticket[];
    dependencies: CatalogItem[];
    buildings: CatalogItem[];
    specialAccesses: CatalogItem[];
    schedules: CatalogItem[];
    filteredHistoryLogs: any[]; // HistoryLog interface could be added later
    userProfile: UserProfile | null;
}
