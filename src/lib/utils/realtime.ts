import { supabase } from "../supabase";
import { appEvents, EVENTS } from "./appEvents";
import { networkStore } from "../stores/network.svelte";

let globalRealtimeStarted = false;
let channelRef: ReturnType<typeof supabase.channel> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 30000; // 30 seconds
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isReconnecting = false;

// Referencias a los listeners para poder limpiarlos en destroy
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

/**
 * Calcula el delay de reconexión con exponential backoff + jitter.
 * Fórmula: min(BASE * 2^attempt, MAX) * (0.5 + random * 0.5)
 * Esto distribuye los reintentos evitando el "thundering herd" effect.
 */
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

    // Limpiar el canal anterior si existe
    if (channelRef) {
        try {
            supabase.removeChannel(channelRef);
        } catch (e) {
            console.warn(`[Realtime] Error al remover canal anterior:`, e);
        }
        channelRef = null;
    }

    // Crear nueva suscripción
    const newChannel = createChannel(channelName);
    if (newChannel) {
        channelRef = newChannel;
    } else {
        scheduleReconnect(channelName);
    }
}

function createChannel(channelName: string) {
    try {
        const channel = supabase
            .channel("global-app-data")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tickets" },
                (payload) => {
                    console.log("[Realtime: Tickets]", payload.eventType, payload);
                    appEvents.emit(EVENTS.TICKETS_CHANGED);
                },
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "cards" },
                (payload) => {
                    console.log("[Realtime: Cards]", payload.eventType, payload);
                    appEvents.emit(EVENTS.CARDS_CHANGED);
                },
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "history_logs" },
                (payload) => {
                    console.log("[Realtime: history_logs]", payload.eventType, payload);
                    appEvents.emit(EVENTS.HISTORY_CHANGED);
                },
            )
            .subscribe((status, err) => logSubscribeStatus(channelName, status, err));

        return channel;
    } catch (error) {
        console.error(`[Realtime] Error al crear canal ${channelName}:`, error);
        return null;
    }
}

/**
 * Una sola conexión de canales con postgres_changes para tickets, cards e historial.
 * Incluye reconexión automática con exponential backoff y manejo de conectividad.
 *
 * Nota: en el panel de Supabase (Database → Publications) las tablas deben estar
 * en la publicación `supabase_realtime` o no llegará ningún evento.
 */
export function initGlobalRealtime() {
    if (globalRealtimeStarted) {
        // Si ya se inició pero se perdió la conexión, permitir reconexión
        if (!channelRef && !isReconnecting) {
            scheduleReconnect("global-app-data");
        }
        return;
    }
    globalRealtimeStarted = true;

    console.log("[Realtime] Conectando subscripciones globales (tickets, cards, history_logs)...");

    channelRef = createChannel("global-app-data");

    // Guardar referencias a los listeners para poder limpiarlos después
    const handleOnline = () => {
        console.log("[Realtime] Detectada conexión restaurada. Reconectando...");
        reconnectAttempts = 0;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        isReconnecting = false;
        reconnect("global-app-data");
    };

    const handleOffline = () => {
        console.log("[Realtime] Detectada pérdida de conexión. Esperando reconexión...");
        // No hacemos nada aquí, scheduleReconnect se encargará cuando detecte !networkStore.isOnline
    };

    onlineListener = handleOnline;
    offlineListener = handleOffline;

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
}

/**
 * Cierra todas las suscripciones, remueve los event listeners y limpia temporizadores.
 * Útil para logout o cuando se quiere reiniciar manualmente las suscripciones.
 */
export function destroyGlobalRealtime() {
    // Limpiar timeout pendiente
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Remover canal de Supabase
    if (channelRef) {
        try {
            supabase.removeChannel(channelRef);
        } catch (e) {
            console.warn("[Realtime] Error al remover canal en destroy:", e);
        }
        channelRef = null;
    }

    // Remover event listeners de conectividad para evitar memory leaks
    if (onlineListener) {
        window.removeEventListener("online", onlineListener);
        onlineListener = null;
    }
    if (offlineListener) {
        window.removeEventListener("offline", offlineListener);
        offlineListener = null;
    }

    // Resetear estado global
    globalRealtimeStarted = false;
    reconnectAttempts = 0;
    isReconnecting = false;
}
