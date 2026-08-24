import { supabase } from "../supabase";
import { networkStore } from "../stores/network.svelte";
import { catalogState } from "../stores/catalogs.svelte";

let globalRealtimeStarted = false;
let channelRef: ReturnType<typeof supabase.channel> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 30000; // 30 seconds
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isReconnecting = false;

let onlineListener: (() => void) | null = null;
let offlineListener: (() => void) | null = null;

function logSubscribeStatus(channelName: string, status: string, err?: Error) {
    if (status === "SUBSCRIBED") {
        console.log(`[Realtime] ${channelName}: suscrito`);
        reconnectAttempts = 0; // Resetear intentos al conectar exitosamente
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[Realtime] ${channelName}: ${status}`, err ?? "");
        scheduleReconnect(channelName);
    }
}

function getReconnectDelay(): number {
    const exponential = Math.min(
        BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
        MAX_DELAY_MS
    );
    const jitter = 0.5 + Math.random() * 0.5; // 0.5–1.0
    return Math.floor(exponential * jitter);
}

function scheduleReconnect(channelName: string) {
    if (isReconnecting) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(
            `[Realtime] ${channelName}: Se alcanzó el máximo de ${MAX_RECONNECT_ATTEMPTS} intentos de reconexión.`
        );
        isReconnecting = false;
        return;
    }

    isReconnecting = true;
    const delay = getReconnectDelay();
    reconnectAttempts++;
    console.log(
        `[Realtime] ${channelName}: Reintentando en ${delay}ms (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    );

    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        isReconnecting = false;
        reconnect(channelName);
    }, delay);
}

function reconnect(channelName: string) {
    if (!networkStore.isOnline) {
        console.log(`[Realtime] ${channelName}: Sin conexión, se reintentará cuando vuelva la conectividad.`);
        isReconnecting = false;
        return;
    }

    console.log(`[Realtime] ${channelName}: Reintentando conexión...`);

    if (channelRef) {
        try {
            supabase.removeChannel(channelRef);
        } catch (e) {
            console.warn(`[Realtime] Error al remover canal anterior:`, e);
        }
        channelRef = null;
    }

    const newChannel = createChannel(channelName);
    if (newChannel) {
        channelRef = newChannel;
    } else {
        scheduleReconnect(channelName);
    }
}

/** Refresca una colección de catálogo tras un cambio. */
async function refreshCatalog(table: string) {
    try {
        const { catalogService } = await import("../services/catalogs");
        if (table === "dependencies") {
            catalogState.setDependencies(await catalogService.fetchDependencies());
        } else if (table === "buildings") {
            catalogState.setBuildings(await catalogService.fetchBuildings());
        } else if (table === "special_accesses") {
            catalogState.setSpecialAccesses(await catalogService.fetchAccesses());
        } else if (table === "schedules") {
            catalogState.setSchedules(await catalogService.fetchSchedules());
        } else if (table === "access_media_types") {
            catalogState.setMediaTypes(await catalogService.fetchMediaTypes());
        } else if (table === "floors") {
            // Los pisos viajan dentro de buildings; recargar buildings para reflejarlos.
            catalogState.setBuildings(await catalogService.fetchBuildings());
        }
    } catch (e) {
        console.warn("[Realtime] No se pudo refrescar catálogo:", e);
    }
}

/** Refresca un store de listado tras un cambio. */
async function refreshStore(storeName: string) {
    try {
        if (storeName === "tickets") {
            const { ticketState } = await import("../stores/tickets.svelte");
            await ticketState.refresh();
        } else if (storeName === "access_media" || storeName === "access_assignments") {
            const { cardState } = await import("../stores/cards.svelte");
            await cardState.refresh();
        } else if (storeName === "cardless_registry") {
            const { cardlessRegistryState } = await import("../stores/cardlessRegistry.svelte");
            await cardlessRegistryState.refresh();
        }
    } catch (e) {
        console.warn("[Realtime] No se pudo refrescar store:", e);
    }
}

function createChannel(channelName: string) {
    try {
        const channel = supabase
            .channel("global-app-data");

        // Tablas de catálogo → recargar catálogo
        for (const table of [
            "dependencies", "buildings", "schedules", "special_accesses",
            "access_media_types", "floors",
        ]) {
            channel.on(
                "postgres_changes",
                { event: "*", schema: "public", table },
                () => { refreshCatalog(table); },
            );
        }

        // Stores de listado → refrescar página actual
        for (const [table, storeName] of [
            ["tickets", "tickets"],
            ["access_media", "access_media"],
            ["access_assignments", "access_assignments"],
            ["cardless_registry", "cardless_registry"],
        ] as [string, string][]) {
            channel.on(
                "postgres_changes",
                { event: "*", schema: "public", table },
                () => { refreshStore(storeName); },
            );
        }

        channel.subscribe((status, err) => logSubscribeStatus(channelName, status, err));
        return channel;
    } catch (error) {
        console.error(`[Realtime] Error al crear canal ${channelName}:`, error);
        return null;
    }
}

/**
 * Suscripción global a cambios de datos (catálogos + listados principales),
 * con reconexión automática y manejo de conectividad.
 * Nota: las tablas deben estar en la publicación `supabase_realtime`.
 */
export function initGlobalRealtime() {
    if (globalRealtimeStarted) {
        if (!channelRef && !isReconnecting) {
            scheduleReconnect("global-app-data");
        }
        return;
    }
    globalRealtimeStarted = true;

    console.log("[Realtime] Conectando subscripciones globales...");

    channelRef = createChannel("global-app-data");

    const handleOnline = () => {
        reconnectAttempts = 0;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        isReconnecting = false;
        reconnect("global-app-data");
    };

    const handleOffline = () => {};

    onlineListener = handleOnline;
    offlineListener = handleOffline;

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
}

export function destroyGlobalRealtime() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (channelRef) {
        try {
            supabase.removeChannel(channelRef);
        } catch (e) {
            console.warn("[Realtime] Error al remover canal en destroy:", e);
        }
        channelRef = null;
    }

    if (onlineListener) {
        window.removeEventListener("online", onlineListener);
        onlineListener = null;
    }
    if (offlineListener) {
        window.removeEventListener("offline", offlineListener);
        offlineListener = null;
    }

    globalRealtimeStarted = false;
    reconnectAttempts = 0;
    isReconnecting = false;
}
