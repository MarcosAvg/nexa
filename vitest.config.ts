import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Configuración de tests unitarios (Vitest).
 *
 * El plugin de Svelte es necesario para compilar módulos de runas
 * (`*.svelte.ts`) como `paginatedList.svelte.ts`.
 */
export default defineConfig({
    plugins: [svelte({ hot: false })],
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/unit/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/lib/**/*.{ts,svelte.ts}'],
        },
    },
});
