import { supabase } from "../supabase";
import { appEvents, EVENTS } from "./appEvents";

let globalRealtimeStarted = false;

function logSubscribeStatus(channelName: string, status: string, err?: Error) {
    if (status === "SUBSCRIBED") {
        console.log(`[Realtime] ${channelName}: suscrito`);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[Realtime] ${channelName}: ${status}`, err ?? "");
    }
}

/**
 * Una sola conexión de canales con postgres_changes para tickets, cards e historial.
 * Evita duplicar suscripciones si initData se ejecuta más de una vez.
 *
 * Nota: en el panel de Supabase (Database → Publications) las tablas deben estar
 * en la publicación `supabase_realtime` o no llegará ningún evento.
 */
export function initGlobalRealtime() {
    if (globalRealtimeStarted) {
        return;
    }
    globalRealtimeStarted = true;

    console.log("[Realtime] Conectando subscripciones globales (tickets, cards, history_logs)...");

    supabase
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
        .subscribe((status, err) => logSubscribeStatus("global-app-data", status, err));
}
