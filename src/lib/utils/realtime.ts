import { supabase } from "../supabase";
import { appEvents, EVENTS } from "./appEvents";

export function initGlobalRealtime() {
    console.log("[Realtime] Conectando subscripciones globales...");
    
    // Subscribe to tickets table changes
    supabase
        .channel('public:tickets')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tickets' },
            (payload) => {
                console.log("[Realtime: Tickets]", payload);
                appEvents.emit(EVENTS.TICKETS_CHANGED);
            }
        )
        .subscribe();

    // Subscribe to cards table changes
    supabase
        .channel('public:cards')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'cards' },
            (payload) => {
                console.log("[Realtime: Cards]", payload);
                appEvents.emit(EVENTS.CARDS_CHANGED);
            }
        )
        .subscribe();
        
    // Subscribe to history table changes
    supabase
        .channel('public:history')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'history' },
            (payload) => {
                console.log("[Realtime: History]", payload);
                appEvents.emit(EVENTS.HISTORY_CHANGED);
            }
        )
        .subscribe();
}
