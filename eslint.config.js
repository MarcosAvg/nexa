import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/**
 * ESLint flat config.
 *
 * - Reglas base de JS + TypeScript.
 * - Reglas recomendadas de Svelte (incluye a11y).
 * - El parser de Svelte usa el parser de TypeScript para los bloques <script>.
 */
export default tseslint.config(
    {
        ignores: [
            'dist/',
            'dev-dist/',
            'node_modules/',
            'coverage/',
            'test-results/',
            'playwright-report/',
            'src/lib/modules/generated.ts',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...svelte.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                extraFileExtensions: ['.svelte'],
                svelteConfig,
            },
        },
    },
    {
        // Los catálogos y módulos usan `any` de forma intensiva en fronteras de datos.
        // Reglas de estilo de Svelte que generarían ruido en este código (claves de
        // `#each`, reactividad fina con Set/Map, snippets) quedan desactivadas.
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-unused-expressions': 'off',
            'svelte/require-each-key': 'off',
            'svelte/prefer-svelte-reactivity': 'off',
            'svelte/no-useless-children-snippet': 'off',
        },
    },
);
