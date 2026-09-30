/**
 * routeAccess.ts — Control de acceso por vista.
 *
 * Fuente única de verdad sobre qué roles pueden ver cada ruta:
 * - admin: todo.
 * - operator: todo menos Configuración.
 * - viewer: solo Dashboard, Personal, Tarjetas y Enlaces (lectura).
 *
 * Se usa en tres lugares: guards de ruta (`routes.ts`), filtrado del nav
 * (`MainLayoutWrapper`) y filtrado del CommandPalette.
 */

export type AppRole = 'admin' | 'operator' | 'viewer';

const ALL: AppRole[] = ['admin', 'operator', 'viewer'];
const STAFF: AppRole[] = ['admin', 'operator'];

/** Roles autorizados por ruta. Las rutas no listadas se permiten (las cubre el `*` → Dashboard). */
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
    '/': ALL,
    '/dashboard': ALL,
    '/personal': ALL,
    '/cards': ALL,
    '/enlaces': ALL,
    '/tickets': STAFF,
    '/registro-sin-tarjeta': STAFF,
    '/history': STAFF,
    '/settings': ['admin'],
};

/**
 * Indica si un rol puede ver una ruta.
 * - Ruta desconocida → `true` (la resuelve el catch-all `*` o el guard global).
 * - Sin rol → `true` (App muestra `LoginView` cuando no hay perfil).
 */
export function canAccessRoute(path: string, role: AppRole | null | undefined): boolean {
    const clean = path.split('?')[0].split('#')[0] || '/';
    const allowed = ROUTE_ACCESS[clean];
    if (!allowed) return true;
    if (!role) return true;
    return allowed.includes(role);
}
