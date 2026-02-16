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
    };

    type Props = {
        data: any[];
        columns: Column[];
        actions?: TopSnippet;
        mobileCard?: TopSnippet;
    };

    let { data, columns, actions, mobileCard }: Props = $props();

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

<!-- Desktop Table View (hidden on small screens) -->
<div
    class="hidden md:block overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm bg-white/80 backdrop-blur-sm"
>
    <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-sm text-slate-600 border-collapse">
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
                            >Acciones</th
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
                                class="px-5 py-4 lg:px-6 lg:py-4.5 lg:whitespace-nowrap text-[13.5px] font-medium text-slate-700/90 transition-colors group-hover:text-slate-900 {column.class ||
                                    ''}"
                            >
                                {#if column.render}
                                    {@render column.render(row)}
                                {:else}
                                    {row[column.key]}
                                {/if}
                            </td>
                        {/each}
                        {#if actions}
                            <td
                                class="px-5 py-4 lg:px-6 lg:py-4.5 whitespace-nowrap text-right"
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

<!-- Mobile Card View (visible only on small screens) -->
<div class="md:hidden space-y-4">
    {#each sortedData as row (row.id || Math.random())}
        {#if mobileCard}
            {@render mobileCard(row)}
        {:else}
            <!-- Fallback generic card -->
            <article
                class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4 relative overflow-hidden active:scale-[0.98] transition-all duration-200"
            >
                <div class="flex items-start justify-between gap-3">
                    <div
                        class="font-bold text-slate-900 text-[15px] tracking-tight"
                    >
                        {row[columns[0]?.key]}
                    </div>
                    {#if actions}
                        <div class="opacity-80">
                            {@render actions(row)}
                        </div>
                    {/if}
                </div>

                <div class="grid grid-cols-1 gap-3 pt-1">
                    {#each columns.slice(1) as column}
                        {#if !column.hideOnMobile}
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
                        {/if}
                    {/each}
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
