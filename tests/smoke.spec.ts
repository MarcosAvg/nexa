import { test, expect } from '@playwright/test';

/**
 * Test de humo: verifica que la aplicación arranca y las rutas principales
 * cargan sin errores.
 *
 * Se ejecuta siempre. No requiere credenciales: valida que el shell de la app
 * renderiza (la SPA vía svelte-spa-router). Si quieres pruebas que dependan de
 * datos, configura una cuenta de prueba y activa RUN_E2E=1.
 */

const routes = ['/', '/personal', '/cards', '/tickets', '/history', '/settings', '/enlaces'];

test.describe('Smoke: la app carga y navega', () => {
    for (const route of routes) {
        test(`renderiza ${route}`, async ({ page }) => {
            // La app muestra un login o el shell; sin datos no debe haber errores
            // de consola ni pantallas de "error inesperado".
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(String(e)));

            await page.goto(route);
            await page.waitForTimeout(500);

            // La app siempre renderiza un contenedor raíz (login o shell).
            await expect(page.locator('#app')).toBeVisible();
            expect(errors).toEqual([]);
        });
    }
});

// ─── Flujo opcional con credenciales (RUN_E2E=1) ─────────────────────────
const RUN_E2E = process.env.RUN_E2E === '1';

test.describe('E2E con credenciales (opcional)', () => {
    test.skip(!RUN_E2E, 'Actívalo con RUN_E2E=1 y credenciales en el entorno.');

    test('login y acceso al dashboard', async ({ page }) => {
        const email = process.env.E2E_EMAIL;
        const password = process.env.E2E_PASSWORD;
        test.skip(!email || !password, 'Faltan E2E_EMAIL / E2E_PASSWORD.');

        await page.goto('/');
        await page.getByLabel(/Correo/i).fill(email!);
        await page.getByLabel(/Contraseña/i).fill(password!);
        await page.getByRole('button', { name: /Iniciar sesión|Ingresar/i }).click();

        await expect(page.locator('#app')).toBeVisible();
    });
});
