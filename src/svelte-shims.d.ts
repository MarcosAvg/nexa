declare module '*.svelte' {
    import type { ComponentType } from 'svelte';
    const component: ComponentType;
    export default component;
}

/**
 * Build-time del bundle en ejecución, inyectado por Vite (`define` en
 * vite.config.ts). Se usa para detectar actualizaciones de la PWA.
 */
declare const __BUILD_TIME__: string;
