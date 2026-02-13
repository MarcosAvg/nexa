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
    class="hidden md:block overflow-hidden rounded-xl border border-slate-200/60 shadow-sm bg-white"
>
    <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-500">
            <thead
                class="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/60"
            >
                <tr>
                    {#each columns as column}
                        <th
                            scope="col"
                            class="px-4 py-3 lg:px-6 lg:py-4 {column.class ||
                                ''} {column.sortable !== false
                                ? 'cursor-pointer hover:bg-slate-100/50 transition-all duration-200 group select-none'
                                : ''}"
                            onclick={() =>
                                column.sortable !== false &&
                                toggleSort(column.key)}
                        >
                            <div class="flex items-center gap-2">
                                {column.label}
                                {#if column.sortable !== false}
                                    <div
                                        class="flex-shrink-0 transition-colors {sortKey ===
                                        column.key
                                            ? 'text-slate-900'
                                            : 'text-slate-300 group-hover:text-slate-400'}"
                                    >
                                        {#if sortKey === column.key}
                                            {#if sortDirection === "asc"}
                                                <ChevronUp
                                                    size={14}
                                                    strokeWidth={3}
                                                />
                                            {:else}
                                                <ChevronDown
                                                    size={14}
                                                    strokeWidth={3}
                                                />
                                            {/if}
                                        {:else}
                                            <ChevronsUpDown size={14} />
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </th>
                    {/each}
                    {#if actions}
                        <th
                            scope="col"
                            class="px-4 py-3 lg:px-6 lg:py-4 text-right"
                            >Acciones</th
                        >
                    {/if}
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                {#each sortedData as row (row.id || Math.random())}
                    <tr class="transition-colors hover:bg-slate-50/80">
                        {#each columns as column}
                            <td
                                class="px-4 py-3 lg:px-6 lg:py-4 lg:whitespace-nowrap text-slate-700 {column.class ||
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
                                class="px-4 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-right"
                            >
                                {@render actions(row)}
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
                class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="font-bold text-slate-900">
                        {row[columns[0]?.key]}
                    </div>
                    {#if actions}
                        {@render actions(row)}
                    {/if}
                </div>
                {#each columns.slice(1) as column}
                    {#if !column.hideOnMobile}
                        <div
                            class="flex items-center justify-between gap-2 text-sm"
                        >
                            <span class="text-slate-400">{column.label}</span>
                            <span class="text-slate-700">
                                {#if column.render}
                                    {@render column.render(row)}
                                {:else}
                                    {row[column.key]}
                                {/if}
                            </span>
                        </div>
                    {/if}
                {/each}
            </article>
        {/if}
    {/each}
</div>
