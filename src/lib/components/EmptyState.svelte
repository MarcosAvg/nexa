<script lang="ts">
    import { type Snippet, type ComponentType } from "svelte";
    import { FilterX } from "lucide-svelte";

    /**
     * EmptyState — Estado vacío con ícono, título, descripción y acciones.
     *
     * Soporta modo "con filtros" (muestra texto alternativo + botón limpiar)
     * y modo "sin filtros" (muestra children como acciones).
     *
     * @example
     * <EmptyState icon={Users} title="Sin registros" description="Crea el primero.">
     *     <Button onclick={onCreate}>Crear</Button>
     * </EmptyState>
     */
    type Props = {
        /** Ícono central (lucide-svelte). */
        icon?: ComponentType;
        /** Clases bg-gradient-to-br + color del ícono. @default "from-slate-100 to-slate-200" */
        iconBgClass?: string;
        /** Título principal. */
        title: string;
        /** Título alternativo cuando hay filtros activos. */
        titleFiltered?: string;
        /** Descripción principal. */
        description: string;
        /** Descripción alternativa cuando hay filtros activos. */
        descriptionFiltered?: string;
        /** Muestra versión "con filtros" (texto alternativo + botón limpiar). */
        hasFilters?: boolean;
        /** Handler al hacer clic en "Limpiar filtros". */
        onClearFilters?: () => void;
        /** Acciones (botón de crear, etc.) visibles solo si no hay filtros. */
        children?: Snippet;
    };

    let {
        icon: Icon,
        iconBgClass = "from-slate-100 to-slate-200",
        title,
        titleFiltered,
        description,
        descriptionFiltered,
        hasFilters = false,
        onClearFilters,
        children,
    }: Props = $props();

    let displayTitle = $derived(hasFilters ? (titleFiltered ?? title) : title);
    let displayDescription = $derived(hasFilters ? (descriptionFiltered ?? description) : description);
</script>

<div class="flex flex-col items-center justify-center py-20 px-8">
    {#if Icon}
        <div class="w-20 h-20 rounded-[28px] bg-gradient-to-br {iconBgClass} flex items-center justify-center mb-6 shadow-inner">
            <Icon size={40} strokeWidth={1.5} />
        </div>
    {/if}

    <h3 class="text-xl font-black text-slate-900 tracking-tight mb-2">
        {displayTitle}
    </h3>

    <p class="text-sm font-medium text-slate-400 text-center max-w-sm mb-8">
        {displayDescription}
    </p>

    {#if hasFilters && onClearFilters}
        <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-[13px] font-extrabold hover:bg-slate-200 transition-all active:scale-95"
            onclick={onClearFilters}
        >
            <FilterX size={16} strokeWidth={2.5} />
            Limpiar filtros
        </button>
    {:else if children}
        {@render children()}
    {/if}
</div>
