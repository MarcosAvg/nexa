<script lang="ts">
    import { type Snippet, type ComponentType } from 'svelte';
    import { AlertCircle, RefreshCcw } from 'lucide-svelte';
    import Card from './Card.svelte';
    import Button from './Button.svelte';
    import SkeletonTable from './SkeletonTable.svelte';
    import SkeletonCard from './SkeletonCard.svelte';
    import EmptyState from './EmptyState.svelte';

    type Props = {
        /** Si es true, muestra el skeleton loading (oculto si ya hay datos). */
        isLoading: boolean;
        /** Array de datos. Si está vacío y no está cargando, se muestra EmptyState. */
        data: any[];
        /** Mensaje de error de carga. Si existe y no hay datos, muestra error + retry. */
        error?: string | null;
        /** Callback para reintentar la carga. */
        onRetry?: () => void;
        /** Número de columnas del skeleton. @default 4 */
        skeletonColumns?: number;
        /** Número de filas del skeleton. @default 5 */
        skeletonRows?: number;
        /** Si es true, el skeleton muestra espacio para acciones. @default false */
        skeletonHasActions?: boolean;

        /** Título del estado vacío (cuando no hay filtros). */
        emptyTitle: string;
        /** Descripción del estado vacío. */
        emptyDescription: string;
        /** Icono del estado vacío. */
        emptyIcon?: ComponentType;
        /** Clases de fondo/estilo para el contenedor del icono. */
        emptyIconBgClass?: string;
        /** Título alternativo cuando hay filtros activos y no hay resultados. */
        emptyTitleFiltered?: string;
        /** Descripción alternativa cuando hay filtros activos. */
        emptyDescriptionFiltered?: string;
        /** Si es true, muestra la versión "filtrada" del EmptyState. */
        hasFilters?: boolean;
        /** Callback para limpiar filtros desde el EmptyState. */
        onClearFilters?: () => void;

        /** Si se provee, envuelve todo en un <Card>. */
        cardClass?: string;

        /** Contenido principal con datos. */
        children?: Snippet;
        /** Acciones adicionales en el estado vacío. */
        emptyActions?: Snippet;
    };

    let {
        isLoading,
        data,
        error = null,
        onRetry,
        skeletonColumns = 4,
        skeletonRows = 5,
        skeletonHasActions = false,

        emptyTitle,
        emptyDescription,
        emptyIcon,
        emptyIconBgClass,
        emptyTitleFiltered,
        emptyDescriptionFiltered,
        hasFilters = false,
        onClearFilters,

        cardClass,

        children,
        emptyActions,
    }: Props = $props();

    let showSkeleton = $derived(isLoading && data.length === 0);
    let showError = $derived(!isLoading && !showSkeleton && !!error && data.length === 0);
    let showEmpty = $derived(!isLoading && !showError && data.length === 0);

    let displayTitle = $derived(hasFilters && emptyTitleFiltered ? emptyTitleFiltered : emptyTitle);
    let displayDescription = $derived(
        hasFilters && emptyDescriptionFiltered ? emptyDescriptionFiltered : emptyDescription,
    );
</script>

{#snippet skeleton()}
    <div class="hidden lg:block">
        <SkeletonTable columns={skeletonColumns} rows={skeletonRows} hasActions={skeletonHasActions} />
    </div>
    <div class="lg:hidden">
        <SkeletonCard columns={skeletonColumns} rows={skeletonRows} hasActions={skeletonHasActions} />
    </div>
{/snippet}

{#snippet errorState()}
    <div class="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div class="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-5">
            <AlertCircle size={30} strokeWidth={2} />
        </div>
        <h3 class="text-lg font-black text-slate-900 tracking-tight mb-1.5">
            No se pudieron cargar los datos
        </h3>
        <p class="text-sm font-medium text-slate-500 max-w-sm mb-6">
            {error ?? 'Ocurrió un error inesperado.'}
        </p>
        {#if onRetry}
            <Button variant="primary" onclick={onRetry}>
                <RefreshCcw size={16} class="mr-2" />
                Reintentar
            </Button>
        {/if}
    </div>
{/snippet}

{#snippet empty()}
    <EmptyState
        icon={emptyIcon}
        iconBgClass={emptyIconBgClass}
        title={displayTitle}
        description={displayDescription}
        {hasFilters}
        {onClearFilters}
    >
        {#snippet children()}
            {@render emptyActions?.()}
        {/snippet}
    </EmptyState>
{/snippet}

{#snippet body()}
    {#if showSkeleton}
        {@render skeleton()}
    {:else if showError}
        {@render errorState()}
    {:else if showEmpty}
        {@render empty()}
    {:else}
        {@render children?.()}
    {/if}
{/snippet}

{#if cardClass}
    <Card class={cardClass}>
        {@render body()}
    </Card>
{:else}
    {@render body()}
{/if}
