<script lang="ts">
    import { type Snippet, type ComponentType } from "svelte";
    import Card from "./Card.svelte";
    import SkeletonTable from "./SkeletonTable.svelte";
    import SkeletonCard from "./SkeletonCard.svelte";
    import EmptyState from "./EmptyState.svelte";

    type Props = {
        /** Si es true, muestra el skeleton loading (oculto si ya hay datos). */
        isLoading: boolean;
        /** Array de datos. Si está vacío y no está cargando, se muestra EmptyState. */
        data: any[];
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
    let showEmpty = $derived(!isLoading && data.length === 0);

    let displayTitle = $derived(
        hasFilters && emptyTitleFiltered ? emptyTitleFiltered : emptyTitle,
    );
    let displayDescription = $derived(
        hasFilters && emptyDescriptionFiltered
            ? emptyDescriptionFiltered
            : emptyDescription,
    );
</script>

{#if cardClass}
    <Card class={cardClass}>
        {#if showSkeleton}
            <div class="hidden lg:block">
                <SkeletonTable
                    columns={skeletonColumns}
                    rows={skeletonRows}
                    hasActions={skeletonHasActions}
                />
            </div>
            <div class="lg:hidden">
                <SkeletonCard
                    columns={skeletonColumns}
                    rows={skeletonRows}
                    hasActions={skeletonHasActions}
                />
            </div>
        {:else if showEmpty}
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
        {:else}
            {@render children?.()}
        {/if}
    </Card>
{:else}
    {#if showSkeleton}
        <div class="hidden lg:block">
            <SkeletonTable
                columns={skeletonColumns}
                rows={skeletonRows}
                hasActions={skeletonHasActions}
            />
        </div>
        <div class="lg:hidden">
            <SkeletonCard
                columns={skeletonColumns}
                rows={skeletonRows}
                hasActions={skeletonHasActions}
            />
        </div>
    {:else if showEmpty}
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
    {:else}
        {@render children?.()}
    {/if}
{/if}
