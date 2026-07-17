<script lang="ts">
    import {
        ticketState,
        userState,
        personnelState,
        catalogState,
    } from "../stores";
    import SectionHeader from "../components/SectionHeader.svelte";
    import TaskBanner from "../components/TaskBanner.svelte";
    import Button from "../components/Button.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import FilterSelect from "../components/FilterSelect.svelte";
    import Input from "../components/Input.svelte";
    import TicketModal from "../components/modals/TicketModal.svelte";
    import ConfirmationModal from "../components/modals/ConfirmationModal.svelte";
    import ModificationCompareModal from "../components/modals/ModificationCompareModal.svelte";
    import ManualTicketDetailsModal from "../components/modals/ManualTicketDetailsModal.svelte";
    import PermissionGuard from "../components/PermissionGuard.svelte";
    import {
        Search,
        Plus,
        FileSpreadsheet,
        ChevronLeft,
        ChevronRight,
        Download,
        FolderArchive,
        ChevronDown,
    } from "lucide-svelte";
    import FloatingActionButton from "../components/FloatingActionButton.svelte";
    import { ticketService } from "../services/tickets";
    import { cardService } from "../services/cards";
    import { personnelService } from "../services/personnel";
    import { toast } from "svelte-sonner";
    import { exportResponsivasToExcel } from "../utils/xlsxExport";
    import { exportResponsivasAllDependenciesAsZip } from "../utils/zipExport";
    import ImportPreviewModal from "../components/modals/ImportPreviewModal.svelte";
    import ConfirmAltaModal from "../components/modals/ConfirmAltaModal.svelte";
    import TicketImportedDetailsModal from "../components/modals/TicketImportedDetailsModal.svelte";
    import { networkStore } from "../stores/network.svelte";

    // Server-side paginated tickets (replaces client-side filtering)
    let tickets = $state<any[]>([]);
    let currentPage = $state(1);
    let pageSize = $state(50);
    let totalRecords = $state(0);
    let totalPages = $derived(Math.max(1, Math.ceil(totalRecords / pageSize)));
    let isLoading = $state(false);
    let isZipExporting = $state(false);
    let showExportMenu = $state(false);

    // Sections
    let currentSection = $state<"General" | "Responsivas">("General");

    // Filters
    let typeFilter = $state("Todos");
    let priorityFilter = $state("Todas");
    let searchQuery = $state("");
    let dependencyFilter = $state("Todas");

    function switchSection(section: "General" | "Responsivas") {
        if (currentSection !== section) {
            currentSection = section;
            typeFilter = "Todos";
            priorityFilter = "Todas";
            searchQuery = "";
            dependencyFilter = "Todas";
            showExportMenu = false;
            // Reset search input if it exists
            const searchInput = document.getElementById(
                "ticket-search",
            ) as HTMLInputElement;
            if (searchInput) searchInput.value = "";
            refreshData(1);
        }
    }

    // Modal State
    let isModalOpen = $state(false);
    let editingTicket = $state<any>(null);

    // Manual Details State
    let isManualDetailsOpen = $state(false);
    let manualTicket = $state<any>(null);

    // Import modal
    let isImportOpen = $state(false);

    // Smart ticket modals (from plantilla import)
    let isAltaOpen = $state(false);
    let altaTicket = $state<any>(null);
    let isImportedOpen = $state(false);
    let importedTicket = $state<any>(null);

    // Confirmation States
    let ticketToComplete = $state<any>(null);

    // Modification Compare Modal
    let isCompareOpen = $state(false);
    let compareTicket = $state<any>(null);

    let personnel = $derived(personnelState.personnel);
    let dependencies = $derived(catalogState.dependencies);

    // Server-paginated data with person name resolution
    let filteredTickets = $derived(
        tickets.map((t) => {
            let personName = "Desconocido";
            if (t.personnel) {
                personName = `${t.personnel.first_name} ${t.personnel.last_name}`;
            } else if (t.payload?.nombres || t.payload?.apellidos) {
                // Resolution for imported tickets (altas, mods, etc)
                personName =
                    `${t.payload.apellidos || ""}, ${t.payload.nombres || ""}`.trim();
                if (personName.startsWith(","))
                    personName = personName.slice(1).trim();
                if (personName.endsWith(","))
                    personName = personName.slice(0, -1).trim();
            } else if (t.payload?.relatedPerson?.name) {
                personName = t.payload.relatedPerson.name;
            }

            // Also try to resolve card info from payload if it's an import (e.g. Reposición)
            let cardType = t.card_type;
            let cardFolio = t.card_folio;

            if (t.cards) {
                cardType = t.cards.type || cardType;
                cardFolio = t.cards.folio || cardFolio;
            }

            if (!cardFolio && t.payload) {
                if (t.payload.folio_p2000) {
                    cardType = "P2000";
                    cardFolio = t.payload.folio_p2000;
                } else if (t.payload.folio_kone) {
                    cardType = "KONE";
                    cardFolio = t.payload.folio_kone;
                } else if (t.payload.folio) {
                    cardType = t.payload.tipo_tarjeta || "N/A";
                    cardFolio = t.payload.folio;
                }
            }

            return { ...t, personName, cardType, cardFolio, movementType: t.movementType };
        }),
    );

    const ticketTypes = [
        "Todos",
        "Alta de Persona",
        "Programación",
        "Modificación",
        "Solicitud de acceso",
        "Reposición",
        "Bloqueo de tarjeta",
        "Baja de tarjeta",
        "Bloqueo de persona",
        "Baja de Persona",
        "Reporte de Falla",
        "Otro",
    ];

    import { onMount, onDestroy } from "svelte";
    import { appEvents, EVENTS } from "../utils/appEvents";
    import { supabase } from "../supabase";

    /** Si otro usuario eliminó/atendió el ticket, cerrar modales y avisar. */
    async function validateOpenModalsAgainstDb() {
        type Entry = { id: number; onGone: () => void };
        const entries: Entry[] = [];

        const add = (id: unknown, onGone: () => void) => {
            if (typeof id === "number" && !Number.isNaN(id)) {
                entries.push({ id, onGone });
            }
        };

        if (isManualDetailsOpen && manualTicket) {
            add(manualTicket.id, () => {
                isManualDetailsOpen = false;
                manualTicket = null;
            });
        }
        if (isCompareOpen && compareTicket) {
            add(compareTicket.id, () => {
                isCompareOpen = false;
                compareTicket = null;
            });
        }
        if (isAltaOpen && altaTicket) {
            add(altaTicket.id, () => {
                isAltaOpen = false;
                altaTicket = null;
            });
        }
        if (isImportedOpen && importedTicket) {
            add(importedTicket.id, () => {
                isImportedOpen = false;
                importedTicket = null;
            });
        }
        if (isModalOpen && editingTicket?.id != null) {
            add(editingTicket.id, () => {
                isModalOpen = false;
                editingTicket = null;
            });
        }

        const seen = new Set<number>();
        let closedAny = false;
        for (const { id, onGone } of entries) {
            if (seen.has(id)) continue;
            seen.add(id);
            const { data } = await supabase
                .from("tickets")
                .select("id")
                .eq("id", id)
                .maybeSingle();
            if (!data) {
                onGone();
                closedAny = true;
            }
        }
        if (closedAny) {
            toast.info(
                "Un ticket que tenías abierto ya no está disponible (puede haber sido atendido por otro usuario).",
            );
        }
    }

    async function refreshData(page: number = 1) {
        isLoading = true;
        currentPage = page;
        try {
            const depId =
                dependencyFilter === "Todas"
                    ? ""
                    : catalogState.dependencies.find(
                          (d) => d.name === dependencyFilter,
                      )?.id || "";

            const [result, extraCards] = await Promise.all([
                ticketService.fetchPaginated(
                    currentPage,
                    pageSize,
                    typeFilter,
                    priorityFilter,
                    searchQuery,
                    currentSection,
                    depId,
                ),
                cardService.fetchExtra(),
            ]);
            tickets = result.data;
            totalRecords = result.count;
            // Also update the global store for Dashboard pending count
            ticketState.setTickets(result.data);
            personnelState.setCards(extraCards);
            await validateOpenModalsAgainstDb();
        } finally {
            isLoading = false;
        }
    }

    // Debounced search
    let searchTimeout: ReturnType<typeof setTimeout>;
    function onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        searchQuery = value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => refreshData(1), 300);
    }

    function onFilterChange() {
        refreshData(1);
    }

    function goToPage(page: number) {
        refreshData(page);
    }

    let unsubs: (() => void)[] = [];

    onMount(() => {
        refreshData();
        unsubs.push(
            appEvents.on(EVENTS.TICKETS_CHANGED, () =>
                refreshData(currentPage),
            ),
        );
    });

    onDestroy(() => unsubs.forEach((fn) => fn()));

    // Handlers
    const IMPORTED_TYPES = new Set([
        "Alta de Persona",
        "Modificación",
        "Baja de Persona",
        "Reposición",
        "Reporte de Falla",
    ]);

    function onManageTicket(ticket: any) {
        // Route imported ticket types to dedicated modals
        if (ticket.type === "Alta de Persona") {
            altaTicket = ticket;
            isAltaOpen = true;
            return;
        }

        if (ticket.type === "Modificación de datos") {
            compareTicket = ticket;
            isCompareOpen = true;
            return;
        }

        if (IMPORTED_TYPES.has(ticket.type)) {
            importedTicket = ticket;
            isImportedOpen = true;
            return;
        }

        // Default: manual details
        manualTicket = ticket;
        isManualDetailsOpen = true;
    }

    function onOpenAddTicket() {
        editingTicket = null;
        isModalOpen = true; // Still use TicketModal for creating new tickets
    }

    function onStartCompletion(ticket: any) {
        if (
            ticket.type === "Firma Responsiva" ||
            ticket.type === "Programación"
        ) {
            if (ticket.person_id) {
                personnelState.selectPerson(ticket.person_id);
                personnelState.highlightedCardId = ticket.card_id || null;
            } else {
                toast.error("Este ticket no tiene una persona vinculada");
            }
            return;
        }

        if (ticket.type === "Modificación de datos") {
            compareTicket = ticket;
            isCompareOpen = true;
            return;
        }

        if (ticket.type === "Modificación") {
            importedTicket = ticket;
            isImportedOpen = true;
            return;
        }

        // For other types, we can use the manual modal flow or quick complete
        // defaulting to manual modal for consistent "review" experience if clicked via banner
        // But onStartCompletion is triggered by the "check" button on banner

        ticketToComplete = ticket;
        // Directly call handleFinalConfirm for simple tickets
        handleFinalConfirm();
    }

    async function handleFinalConfirm() {
        if (!ticketToComplete) return;

        const ticket = ticketToComplete;
        ticketToComplete = null;

        // Optimistic: remove from local array immediately (no flash)
        const prevTickets = tickets;
        tickets = tickets.filter((t) => t.id !== ticket.id);
        totalRecords = Math.max(0, totalRecords - 1);

        try {
            await ticketService.delete(ticket.id);
            toast.success("Ticket completado");
        } catch (e) {
            console.error(e);
            toast.error("Error al completar el ticket");
            // Rollback on error
            tickets = prevTickets;
            totalRecords = totalRecords + 1;
        }
    }

    async function handleExportResponsivas() {
        showExportMenu = false;
        const loadingToast = toast.loading("Preparando exportación...");
        try {
            const depId =
                dependencyFilter === "Todas"
                    ? ""
                    : catalogState.dependencies.find(
                          (d) => d.name === dependencyFilter,
                      )?.id || "";

            const data =
                await ticketService.fetchResponsivasForExport(depId);

            if (data.length === 0) {
                toast.info("No hay responsivas pendientes para exportar", {
                    id: loadingToast,
                });
                return;
            }

            await exportResponsivasToExcel(data, dependencyFilter);
            toast.success("Exportación completada", { id: loadingToast });
        } catch (error) {
            console.error("Export Error:", error);
            toast.error("Error al exportar los datos", {
                id: loadingToast,
            });
        }
    }

    async function handleExportResponsivasAllDepsZip() {
        showExportMenu = false;
        const deps = catalogState.dependencies;
        if (deps.length === 0) {
            toast.error("No hay dependencias registradas");
            return;
        }
        isZipExporting = true;
        const loadingToast = toast.loading("Preparando ZIP...");
        try {
            await exportResponsivasAllDependenciesAsZip(
                deps,
                (_current, _total, label) => {
                    toast.loading(`Procesando: ${label}`, { id: loadingToast });
                },
            );
            toast.success("ZIP descargado", { id: loadingToast });
        } catch (error) {
            console.error("ZIP Export Error:", error);
            toast.error("Error al generar el ZIP", { id: loadingToast });
        } finally {
            isZipExporting = false;
        }
    }
</script>

<div class="space-y-6">
    <!-- Section Tabs -->
    <div class="flex border-b border-slate-200">
        <button
            class="px-6 py-3 text-sm font-bold border-b-2 transition-colors {currentSection ===
            'General'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}"
            onclick={() => switchSection("General")}
        >
            Tickets Generales
        </button>
        <button
            class="px-6 py-3 text-sm font-bold border-b-2 transition-colors {currentSection ===
            'Responsivas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}"
            onclick={() => switchSection("Responsivas")}
        >
            Firmas de Responsiva
        </button>
    </div>

    <SectionHeader
        title={currentSection === "General"
            ? "Tickets de trabajo"
            : "Firmas de Responsiva"}
    >
        {#snippet filters()}
            <div
                class="flex flex-col xl:flex-row flex-wrap gap-4 items-center w-full"
            >
                <!-- Type Filters -->
                {#if currentSection === "General"}
                    <div class="w-full xl:w-auto">
                        <FilterSelect
                            label="Tipo"
                            options={ticketTypes}
                            placeholder=""
                            bind:value={typeFilter}
                            onchange={onFilterChange}
                        />
                    </div>
                {/if}

                <!-- Priority -->
                <div class="w-full xl:w-auto">
                    <FilterSelect
                        label="Prioridad"
                        options={["Todas", "Alta", "Media", "Baja"]}
                        placeholder=""
                        bind:value={priorityFilter}
                        onchange={onFilterChange}
                    />
                </div>

                <!-- Dependency -->
                {#if currentSection === "Responsivas"}
                    <div class="w-full xl:w-auto">
                        <FilterSelect
                            label="Dependencia"
                            options={["Todas", ...dependencies.map((d) => d.name)]}
                            placeholder=""
                            bind:value={dependencyFilter}
                            onchange={onFilterChange}
                        />
                    </div>
                {/if}

                <!-- Search -->
                <div class="flex-1 min-w-[200px] w-full relative">
                    <Search
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                    />
                    <Input
                        id="ticket-search"
                        placeholder="Buscar por folio, persona..."
                        class="pl-10 h-9 text-xs font-bold"
                        value={searchQuery}
                        oninput={onSearch}
                    />
                </div>
            </div>
        {/snippet}

        {#snippet actions()}
            {#if currentSection === "Responsivas"}
                <div class="relative">
                    <Button
                        variant="soft-emerald"
                        onclick={() => (showExportMenu = !showExportMenu)}
                        class="flex items-center gap-2 h-10 px-4"
                        disabled={!networkStore.isOnline || isZipExporting}
                    >
                        <Download size={16} />
                        Exportar Excel
                        <ChevronDown
                            size={14}
                            class="ml-1 opacity-50 transition-transform {showExportMenu ? 'rotate-180' : ''}"
                        />
                    </Button>

                    {#if showExportMenu}
                        <div
                            class="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                        >
                            <button
                                class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                onclick={handleExportResponsivas}
                            >
                                <span class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <FileSpreadsheet size={16} />
                                </span>
                                Exportar (Filtro actual)
                            </button>
                            <div class="mx-3 my-1 border-t border-slate-100"></div>
                            <button
                                class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                                onclick={handleExportResponsivasAllDepsZip}
                                disabled={isZipExporting}
                            >
                                <span class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                                    <FolderArchive size={16} />
                                </span>
                                Todas las Dependencias (ZIP)
                            </button>
                        </div>
                    {/if}
                </div>
            {/if}
            <PermissionGuard requireEdit>
                <Button
                    variant="outline"
                    onclick={() => (isImportOpen = true)}
                    class="flex items-center gap-2 h-10 px-4 border-slate-300"
                    disabled={!networkStore.isOnline}
                >
                    <FileSpreadsheet size={16} />
                    Importar Plantilla
                </Button>
            </PermissionGuard>
            <PermissionGuard requireEdit>
                <Button
                    variant="primary"
                    onclick={onOpenAddTicket}
                    class="flex items-center gap-2.5 h-10 px-6 shadow-lg shadow-blue-500/20"
                    disabled={!networkStore.isOnline}
                >
                    <Plus size={18} strokeWidth={3} />
                    Nuevo Ticket
                </Button>
            </PermissionGuard>
        {/snippet}
    </SectionHeader>

    <!-- Top Pagination removed per request -->

    <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20"
    >
        {#if filteredTickets.length === 0}
            <div
                class="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed"
            >
                No hay tickets pendientes
            </div>
        {:else}
            {#each filteredTickets as ticket (ticket.id)}
                <TaskBanner
                    {ticket}
                    onManage={onManageTicket}
                    onComplete={onStartCompletion}
                />
            {/each}
        {/if}
    </div>

    <!-- Pagination Controls -->
    {#if totalRecords > pageSize}
        <div class="flex items-center justify-between px-2">
            <p class="text-xs text-slate-500">
                Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(
                    currentPage * pageSize,
                    totalRecords,
                )} de {totalRecords} tickets
            </p>
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    onclick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                >
                    <ChevronLeft size={14} />
                    Anterior
                </button>
                <span class="text-xs text-slate-500 font-bold">
                    {currentPage} / {totalPages}
                </span>
                <button
                    type="button"
                    class="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    onclick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Siguiente
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    {/if}
</div>

<TicketModal bind:isOpen={isModalOpen} {editingTicket} />

<ManualTicketDetailsModal
    bind:isOpen={isManualDetailsOpen}
    ticket={manualTicket}
    onComplete={refreshData}
/>

<ModificationCompareModal
    bind:isOpen={isCompareOpen}
    ticket={compareTicket}
    onComplete={refreshData}
/>

<ImportPreviewModal bind:isOpen={isImportOpen} onComplete={refreshData} />

<ConfirmAltaModal
    bind:isOpen={isAltaOpen}
    ticket={altaTicket}
    onComplete={refreshData}
/>

<TicketImportedDetailsModal
    bind:isOpen={isImportedOpen}
    ticket={importedTicket}
    onComplete={refreshData}
/>

<PermissionGuard requireEdit>
    <FloatingActionButton onclick={onOpenAddTicket} label="Nuevo Ticket" />
</PermissionGuard>
