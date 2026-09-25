import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Auditoría de accesibilidad con axe sobre la pantalla pública (login).
 *
 * No requiere credenciales. Falla ante violaciones críticas o serias.
 * `color-contrast` se excluye temporalmente: el barrido de contraste se
 * aborda en el track de design system; reactívalo al completarlo.
 */
test.describe('Accesibilidad (axe)', () => {
    test('la pantalla de login no tiene violaciones críticas/serias', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(800);

        const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();

        const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

        expect(
            blocking,
            JSON.stringify(
                blocking.map((v) => ({ id: v.id, nodes: v.nodes.length })),
                null,
                2,
            ),
        ).toEqual([]);
    });
});
