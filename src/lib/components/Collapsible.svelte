<script lang="ts">
    import { type Snippet, type ComponentType } from 'svelte';
    import { ChevronDown } from 'lucide-svelte';
    import Card from './Card.svelte';
    import Badge from './Badge.svelte';
    import { mediaState } from '../stores';

    /**
     * Collapsible — Sección colapsable solo en móvil.
     *
     * En `lg+` se comporta como un `Card` normal (siempre expandido); en móvil
     * muestra una cabecera tappable que expande/colapsa el contenido.
     *
     * @example
     * <Collapsible title="Dependencias" icon={Building2} defaultOpen={false}>
     *     ...
     * </Collapsible>
     */
    type Props = {
        title: string;
        subtitle?: string;
        icon?: ComponentType;
        /** Clases de color del contenedor del icono. */
        iconBgClass?: string;
        /** Valor a mostrar como badge en la cabecera. */
        count?: number | string;
        /** Abierto por defecto en móvil. */
        defaultOpen?: boolean;
        /** Clases para el contenedor (p. ej. `lg:col-span-2`). */
        class?: string;
        /** Muestra el borde inferior de la cabecera. */
        headerBorder?: boolean;
        /** Acciones extra en la cabecera (a la derecha). */
        headerActions?: Snippet;
        /** Callback al abrir/cerrar en móvil (p. ej. para `chart.resize()`). */
        onToggle?: (open: boolean) => void;
        children?: Snippet;
    };

    let {
        title,
        subtitle,
        icon: Icon,
        iconBgClass = 'bg-slate-100 text-slate-600',
        count,
        defaultOpen = false,
        class: className = '',
        headerBorder = true,
        headerActions,
        onToggle,
        children,
    }: Props = $props();

    // svelte-ignore state_referenced_locally
    let isOpen = $state(defaultOpen);

    function toggle() {
        if (!mediaState.isMobile.matches) return;
        isOpen = !isOpen;
        onToggle?.(isOpen);
    }
</script>

<Card class="p-0 overflow-hidden {className}">
    <div
        class="flex items-center gap-3 px-4 py-3 lg:px-6 lg:pt-5 lg:pb-3 {headerBorder
            ? 'border-b border-slate-100/60'
            : ''}"
    >
        <button
            type="button"
            class="flex items-center gap-3 flex-1 min-w-0 text-left lg:pointer-events-none"
            onclick={toggle}
            aria-expanded={isOpen}
        >
            {#if Icon}
                <div class="p-2 {iconBgClass} rounded-xl shrink-0">
                    <Icon size={18} strokeWidth={2.5} />
                </div>
            {/if}
            <div class="min-w-0 flex-1">
                <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider truncate">
                    {title}
                </h2>
                {#if subtitle}
                    <p class="text-[11px] text-slate-400 font-medium truncate">{subtitle}</p>
                {/if}
            </div>
            {#if count !== undefined}
                <Badge variant="slate" class="text-[9px] font-extrabold px-1.5 py-0.5 shrink-0">{count}</Badge
                >
            {/if}
        </button>

        {#if headerActions}
            <div class="shrink-0">{@render headerActions()}</div>
        {/if}

        <ChevronDown
            size={18}
            class="lg:hidden text-slate-400 shrink-0 transition-transform duration-300 {isOpen
                ? 'rotate-180'
                : ''}"
        />
    </div>

    <div class="{isOpen ? 'block' : 'hidden'} lg:block">
        {@render children?.()}
    </div>
</Card>
