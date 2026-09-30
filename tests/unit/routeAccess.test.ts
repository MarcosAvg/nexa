import { describe, it, expect } from 'vitest';
import { ROUTE_ACCESS, canAccessRoute, type AppRole } from '../../src/lib/routeAccess';

describe('routeAccess', () => {
    it('admin ve todas las rutas', () => {
        for (const path of Object.keys(ROUTE_ACCESS)) {
            expect(canAccessRoute(path, 'admin')).toBe(true);
        }
    });

    it('operator ve todo menos configuración', () => {
        expect(canAccessRoute('/tickets', 'operator')).toBe(true);
        expect(canAccessRoute('/history', 'operator')).toBe(true);
        expect(canAccessRoute('/registro-sin-tarjeta', 'operator')).toBe(true);
        expect(canAccessRoute('/settings', 'operator')).toBe(false);
    });

    it('viewer solo ve dashboard, personal, tarjetas y enlaces', () => {
        const visibles = ['/', '/dashboard', '/personal', '/cards', '/enlaces'];
        const ocultas = ['/tickets', '/registro-sin-tarjeta', '/history', '/settings'];
        for (const path of visibles) expect(canAccessRoute(path, 'viewer')).toBe(true);
        for (const path of ocultas) expect(canAccessRoute(path, 'viewer')).toBe(false);
    });

    it('rutas desconocidas y sin rol se permiten (las resuelve el catch-all / login)', () => {
        expect(canAccessRoute('/ruta-inexistente', 'viewer')).toBe(true);
        expect(canAccessRoute('/tickets', null)).toBe(true);
        expect(canAccessRoute('/tickets', undefined)).toBe(true);
    });

    it('ignora query strings al evaluar', () => {
        expect(canAccessRoute('/tickets?page=2', 'viewer')).toBe(false);
        expect(canAccessRoute('/personal?page=2', 'viewer' as AppRole)).toBe(true);
    });
});
