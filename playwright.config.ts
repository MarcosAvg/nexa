import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de tests E2E (Playwright).
 *
 * - `RUN_E2E=1` habilita los tests de navegación con credenciales de prueba
 *   (ver `src/lib/views/LoginView`). Sin esta variable, los tests se saltan,
 *   de modo que `npm run test` no rompe en entornos sin una cuenta real.
 * - Los tests de humo verifican que la app arranca y las rutas principales
 *   no fallan.
 */
export default defineConfig({
    testDir: './tests',
    // Los tests unitarios (Vitest) viven en tests/unit y no deben correr con Playwright.
    testMatch: '**/*.spec.ts',
    testIgnore: ['**/unit/**'],
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: ['**/mobile.spec.ts'],
        },
        {
            name: 'mobile',
            use: { ...devices['iPhone 13'], browserName: 'chromium' },
            // Los tests de escritorio no aplican al proyecto móvil.
            testMatch: ['**/mobile.spec.ts'],
        },
    ],
    webServer: process.env.E2E_WEB_SERVER
        ? undefined
        : {
              command: 'npm run dev',
              url: 'http://localhost:5173',
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
});
