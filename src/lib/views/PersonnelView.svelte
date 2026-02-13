<script lang="ts">
    import { appState } from "../state.svelte";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import FilterSelect from "../components/FilterSelect.svelte";
    import Button from "../components/Button.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import { Search, FileDown } from "lucide-svelte";
    import { personnelService } from "../services/personnel";
    import { exportPersonnelToExcel } from "../utils/xlsxExport";

    let { personnel, dependencies, buildings } = $derived(appState);
    let dependencyNames = $derived(dependencies.map((d) => d.name));

    // Local UI filters for this view
    let statusFilter = $state("Todos");
    let dependencyFilter = $state("");
    let personSearch = $state("");

    let filteredPersonnel = $derived.by(() => {
        return personnel.filter((person) => {
            const matchStatus =
                statusFilter === "Todos" ||
                (statusFilter === "Activo/a" && person.status === "Activo/a") ||
                (statusFilter === "Inactivo/a" &&
                    person.status === "Inactivo/a") ||
                (statusFilter === "Bloqueado/a" &&
                    person.status === "Bloqueado/a") ||
                (statusFilter === "Baja" && person.status === "Baja");

            const matchDependency =
                dependencyFilter === "" ||
                person.dependency === dependencyFilter;
            const matchSearch =
                personSearch === "" ||
                person.name.toLowerCase().includes(personSearch.toLowerCase());

            return matchStatus && matchDependency && matchSearch;
        });
    });

    // Props/Events passed from App.svelte or handled here
    let { onOpenAddModal, onOpenDetails, currentUser } = $props<{
        onOpenAddModal: () => void;
        onOpenDetails: (person: any) => void;
        currentUser?: any;
    }>();

    function handleExportExcel() {
        exportPersonnelToExcel(filteredPersonnel, {
            filters: {
                status: statusFilter,
                dependency: dependencyFilter,
                search: personSearch,
            },
        });
    }

    // Snippets
    function getStatusVariant(status: string) {
        if (status === "Activo/a") return "emerald";
        if (status === "Inactivo/a") return "slate"; // Or maybe "amber" if we want it to stand out
        if (status === "Bloqueado/a") return "rose";
        if (status === "Baja") return "slate";
        return "slate";
    }
</script>

{#snippet renderName(row: any)}
    {@const hasPendingModification = appState.pendingItems?.some(
        (t: any) =>
            t.person_id === row.id && t.type === "Modificación de Datos",
    )}
    <div class="flex items-center gap-2">
        <span class="font-bold text-slate-900">{row.name}</span>
        {#if hasPendingModification}
            <Badge
                variant="amber"
                class="text-[8px] px-1 py-0 h-4 border-amber-200 bg-amber-50 text-amber-700 animate-pulse"
                title="Esta persona tiene cambios pendientes de aprobación"
            >
                MODIFICACIÓN PENDIENTE
            </Badge>
        {/if}
    </div>
{/snippet}

{#snippet renderStatus(row: any)}
    <div class="flex items-center gap-2">
        <Badge variant={getStatusVariant(row.status)}>
            {row.status}
        </Badge>
        {#if row.status === "Baja"}
            <Badge variant="slate" class="opacity-50 text-[10px]"
                >INACTIVO</Badge
            >
        {/if}
    </div>
{/snippet}

{#snippet renderDependency(row: any)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900">{row.dependency}</span>
        <span class="text-xs text-slate-500">{row.building} ({row.floor})</span>
    </div>
{/snippet}

{#snippet renderCards(row: any)}
    <div class="flex flex-wrap gap-1">
        {#each row.cards || [] as card}
            <Badge
                variant={card.type === "KONE" ? "blue" : "amber"}
                class="px-1.5 py-0"
            >
                {card.type}
            </Badge>
        {/each}
    </div>
{/snippet}

{#snippet mobilePersonnelCard(row: any)}
    <article
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
        <div class="p-4 space-y-3">
            <div class="flex justify-between items-start">
                {@render renderName(row)}
                {@render renderStatus(row)}
            </div>
            <div class="text-sm text-slate-500">ID: {row.employeeNo}</div>
            {@render renderDependency(row)}
            <div>
                <div
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1"
                >
                    Tarjetas
                </div>
                {@render renderCards(row)}
            </div>
        </div>
        <div
            class="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-end"
        >
            <Button
                variant="secondary"
                size="sm"
                onclick={() => onOpenDetails(row)}>Ver Detalles</Button
            >
        </div>
    </article>
{/snippet}

<div class="space-y-6">
    <SectionHeader title="Directorio de Personal">
        {#snippet filters()}
            <FilterGroup
                label="Estado"
                options={[
                    "Todos",
                    "Activo/a",
                    "Inactivo/a",
                    "Bloqueado/a",
                    "Baja",
                ]}
                bind:value={statusFilter}
            />
            <FilterSelect
                label="Dependencia"
                options={dependencyNames}
                placeholder="Todas las dependencias"
                bind:value={dependencyFilter}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >Buscar</span
                >
                <div class="relative">
                    <input
                        type="text"
                        placeholder="Nombre..."
                        bind:value={personSearch}
                        class="h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-900 transition-all outline-none"
                    />
                    <div
                        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    >
                        <Search size={14} />
                    </div>
                </div>
            </div>
        {/snippet}

        {#snippet actions()}
            <Button
                variant="secondary"
                onclick={handleExportExcel}
                class="flex items-center gap-2"
                disabled={filteredPersonnel.length === 0}
            >
                <FileDown size={18} />
                Exportar Excel
            </Button>
            {#if currentUser?.role !== "viewer"}
                <Button variant="primary" onclick={onOpenAddModal}
                    >Nueva Alta</Button
                >
            {/if}
        {/snippet}
    </SectionHeader>

    <Card class="overflow-hidden">
        <DataTable
            data={filteredPersonnel}
            columns={[
                { key: "name", label: "Nombre completo", render: renderName },
                { key: "employeeNo", label: "No. Empleado" },
                { key: "area", label: "Área" },
                { key: "position", label: "Puesto" },
                {
                    key: "dependency",
                    label: "Dependencia / Edificio",
                    render: renderDependency,
                },
                {
                    key: "cards",
                    label: "Tarjetas",
                    render: renderCards,
                    sortable: false,
                },
                { key: "status", label: "Estado", render: renderStatus },
            ]}
            mobileCard={mobilePersonnelCard}
        >
            {#snippet actions(row: any)}
                <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => onOpenDetails(row)}>Ver Detalles</Button
                >
            {/snippet}
        </DataTable>
    </Card>
</div>
