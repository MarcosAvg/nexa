<script lang="ts">
    import { type Snippet } from "svelte";
    import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-svelte";

    type TopSnippet = Snippet<[any]>;

    type Column = {
        key: string;
        label: string;
        render?: TopSnippet;
        class?: string;
        hideOnMobile?: boolean;
        sortable?: boolean;
        width?: string;
        maxWidth?: string;
    };

    type Props = {
        data: any[];
        columns: Column[];
        actions?: TopSnippet;
        mobileCard?: TopSnippet;
        actionsWidth?: string;
    };
    let {
        data,
        columns,
        actions,
        mobileCard,
        actionsWidth = "140px",
    }: Props = $props();

    // Sort state
    let sortKey = $state<string | null>(null);
    let sortDirection = $state<"asc" | "desc" | null>(null);

    let sortedData = $derived.by(() => {
        if (!sortKey || !sortDirection) return data;

        return [...data].sort((a, b) => {
            let aVal = a[sortKey!];
            let bVal = b[sortKey!];

            // Normalize for sorting (handle missing values)
            if (aVal === null || aVal === undefined) aVal = "";
            if (bVal === null || bVal === undefined) bVal = "";

            // Handle string comparison
            if (typeof aVal === "string" && typeof bVal === "string") {
                const cmp = aVal.localeCompare(bVal, undefined, {
                    numeric: true,
                    sensitivity: "base",
                });
                return sortDirection === "asc" ? cmp : -cmp;
            }

            // Handle other comparisons (numbers, etc)
            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
    });

    function toggleSort(key: string) {
        if (sortKey === key) {
            if (sortDirection === "asc") {
                sortDirection = "desc";
            } else if (sortDirection === "desc") {
                sortKey = null;
                sortDirection = null;
            }
        } else {
            sortKey = key;
            sortDirection = "asc";
        }
    }
</script>

<!-- Desktop Table View (hidden on small/medium screens) -->
<div
    class="hidden lg:block overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm bg-white/80 backdrop-blur-sm"
>
    <div class="w-full overflow-x-auto custom-scrollbar">
        <table
            class="w-full min-w-[1024px] table-fixed text-left text-sm text-slate-600 border-collapse"
        >
            <thead
                class="bg-slate-50/40 text-[11px] uppercase tracking-[0.15em] text-slate-500 font-bold border-b border-slate-200/50"
            >
                <tr>
                    {#each columns as column}
                        <th
                            scope="col"
                            class="px-5 py-4 lg:px-6 lg:py-5 {column.class ||
                                ''} {column.sortable !== false
                                ? 'cursor-pointer hover:bg-slate-100/30 transition-all duration-300 group select-none'
                                : ''}"
                            style:width={column.width}
                            style:max-width={column.maxWidth}
                            onclick={() =>
                                column.sortable !== false &&
                                toggleSort(column.key)}
                        >
                            <div class="flex items-center gap-2.5">
                                {column.label}
                                {#if column.sortable !== false}
                                    <div
                                        class="flex-shrink-0 transition-all duration-300 {sortKey ===
                                        column.key
                                            ? 'text-blue-500 scale-110'
                                            : 'text-slate-300 group-hover:text-slate-400 group-hover:scale-105'}"
                                    >
                                        {#if sortKey === column.key}
                                            {#if sortDirection === "asc"}
                                                <ChevronUp
                                                    size={15}
                                                    strokeWidth={2.5}
                                                />
                                            {:else}
                                                <ChevronDown
                                                    size={15}
                                                    strokeWidth={2.5}
                                                />
                                            {/if}
                                        {:else}
                                            <ChevronsUpDown
                                                size={14}
                                                strokeWidth={2}
                                            />
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </th>
                    {/each}
                    {#if actions}
                        <th
                            scope="col"
                            class="px-5 py-4 lg:px-6 lg:py-5 text-right font-bold"
                            style:width={actionsWidth}>Acciones</th
                        >
                    {/if}
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/60">
                {#each sortedData as row (row.id || Math.random())}
                    <tr
                        class="group transition-all duration-300 hover:bg-blue-50/30"
                    >
                        {#each columns as column}
                            <td
                                class="px-5 py-4 lg:px-6 lg:py-4.5 text-[13.5px] font-medium text-slate-700/90 transition-colors group-hover:text-slate-900 {column.width ||
                                column.maxWidth
                                    ? 'truncate'
                                    : ''} {column.class || ''}"
                                style:width={column.width}
                                style:max-width={column.maxWidth}
                            >
                                <div
                                    class={column.width || column.maxWidth
                                        ? "truncate"
                                        : ""}
                                >
                                    {#if column.render}
                                        {@render column.render(row)}
                                    {:else}
                                        {row[column.key]}
                                    {/if}
                                </div>
                            </td>
                        {/each}
                        {#if actions}
                            <td
                                class="px-5 py-4 lg:px-6 lg:py-4.5 whitespace-nowrap text-right"
                                style:width={actionsWidth}
                            >
                                <div
                                    class="flex justify-end opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                                >
                                    {@render actions(row)}
                                </div>
                            </td>
                        {/if}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<!-- Mobile/Tablet Card View (visible on small/medium screens) -->
<div class="lg:hidden space-y-4">
    {#each sortedData as row (row.id || Math.random())}
        {#if mobileCard}
            {@render mobileCard(row)}
        {:else}
            {@const [isExpanded, setExpanded] = (() => {
                let expanded = $state(false);
                return [expanded, (val: boolean) => (expanded = val)];
            })()}
            <!-- Card component with internal state logic simplified -->
            <article
                class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4 relative overflow-hidden transition-all duration-200"
            >
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-3">
                    <div class="flex flex-col">
                        <span
                            class="text-[10px] font-bold uppercase text-slate-400 tracking-wider"
                            >{columns[0]?.label}</span
                        >
                        <div
                            class="font-bold text-slate-900 text-[16px] tracking-tight"
                        >
                            {row[columns[0]?.key]}
                        </div>
                    </div>
                    {#if actions}
                        <div class="flex items-center gap-2">
                            {@render actions(row)}
                        </div>
                    {/if}
                </div>

                <!-- Card Content (Expandable) -->
                <div class="grid grid-cols-1 gap-1 pt-1">
                    <!-- Always visible fields (next 1 or 2) -->
                    {#each columns.slice(1, 3) as column}
                        <div
                            class="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0"
                        >
                            <span
                                class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                                >{column.label}</span
                            >
                            <span
                                class="text-[13px] font-semibold text-slate-700"
                            >
                                {#if column.render}
                                    {@render column.render(row)}
                                {:else}
                                    {row[column.key]}
                                {/if}
                            </span>
                        </div>
                    {/each}

                    <!-- Expandable fields -->
                    <div
                        class="content-wrapper overflow-hidden transition-all duration-300"
                        style="max-height: {row._expanded
                            ? '500px'
                            : '0px'}; opacity: {row._expanded
                            ? '1'
                            : '0'}; visibility: {row._expanded
                            ? 'visible'
                            : 'hidden'}"
                    >
                        {#each columns.slice(3) as column}
                            {#if !column.hideOnMobile}
                                <div
                                    class="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0"
                                >
                                    <span
                                        class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                                        >{column.label}</span
                                    >
                                    <span
                                        class="text-[13px] font-semibold text-slate-700"
                                    >
                                        {#if column.render}
                                            {@render column.render(row)}
                                        {:else}
                                            {row[column.key]}
                                        {/if}
                                    </span>
                                </div>
                            {/if}
                        {/each}
                    </div>

                    <!-- Expand Toggle -->
                    {#if columns.length > 3}
                        <button
                            class="w-full pt-3 text-[11px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center justify-center gap-1"
                            onclick={() => (row._expanded = !row._expanded)}
                        >
                            {row._expanded ? "Ver menos" : "Ver más detalles"}
                        </button>
                    {/if}
                </div>
            </article>
        {/if}
    {/each}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #cbd5e1;
    }
</style>
