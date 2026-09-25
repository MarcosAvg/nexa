import { test, expect } from '@playwright/test';

/**
 * Pruebas de UI móvil (viewport iPhone 13: 390x844).
 *
 * - El primer test corre siempre: verifica que la app no desborda
 *   horizontalmente y que el shell renderiza.
 * - Los tests de overlays/back requieren sesión (RUN_E2E=1 + credenciales).
 */
const RUN_E2E = process.env.RUN_E2E === '1';

test.describe('Mobile UX', () => {
    test('la pantalla inicial no tiene scroll horizontal', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(800);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await expect(page.locator('#app')).toBeVisible();
    });

    test('el botón atrás cierra el buscador global', async ({ page }) => {
        test.skip(!RUN_E2E, 'Requiere RUN_E2E=1 y credenciales.');
        const email = process.env.E2E_EMAIL;
        const password = process.env.E2E_PASSWORD;
        test.skip(!email || !password, 'Faltan E2E_EMAIL / E2E_PASSWORD.');

        await page.goto('/');
        await page.getByLabel(/Correo/i).fill(email!);
        await page.getByLabel(/Contraseña/i).fill(password!);
        await page.getByRole('button', { name: /Iniciar sesión|Ingresar/i }).click();
        await expect(page.locator('#app')).toBeVisible();

        // Abre el buscador desde la barra superior móvil.
        await page.getByRole('button', { name: 'Buscar' }).first().click();
        const dialog = page.getByRole('dialog', { name: /Buscador Global/i });
        await expect(dialog).toBeVisible();

        // El back debe cerrar el overlay, no navegar.
        await page.goBack();
        await expect(dialog).toBeHidden();
    });
});
