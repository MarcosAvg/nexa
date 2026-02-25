/**
 * appEvents.ts
 * 
 * Lightweight global event bus for cross-view data refresh.
 * When a view saves/modifies data, it emits an event so other views
 * can refresh their data without tight coupling.
 * 
 * Usage:
 *   appEvents.emit('personnel:changed');
 *   const unsub = appEvents.on('personnel:changed', () => refresh());
 *   // later: unsub();
 */

type Listener = () => void;

class AppEvents {
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, callback: Listener): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    emit(event: string): void {
        this.listeners.get(event)?.forEach(cb => {
            try { cb(); } catch (e) { console.error(`[AppEvents] Error in listener for '${event}':`, e); }
        });
    }
}

export const appEvents = new AppEvents();

// Event name constants to avoid typos
export const EVENTS = {
    PERSONNEL_CHANGED: 'personnel:changed',
    CARDS_CHANGED: 'cards:changed',
    TICKETS_CHANGED: 'tickets:changed',
    HISTORY_CHANGED: 'history:changed',
    CATALOGS_CHANGED: 'catalogs:changed',
} as const;
