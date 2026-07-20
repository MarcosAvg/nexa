<script lang="ts">
    import {
        ticketState,
        personnelState,
        catalogState,
    } from "../stores";
    import {
        SectionHeader, TaskBanner, Button, FilterGroup, FilterSelect,
        Input, PermissionGuard, ContentView,
        Pagination, ExportDropdown,
        ModificationCompareModal,
    } from "../components";
    import {
        Search,
        FileSpreadsheet,
        Download,
        FolderArchive,
        ClipboardList,
    } from "lucide-svelte";
    import { ticketService } from "../services/tickets";
    import { cardService } from "../services/cards";
    import { toast } from "svelte-sonner";
    import { handleError, exportResponsivasToExcel, exportResponsivasAllDependenciesAsZip } from "../utils";
    import {
        ImportPreviewModal, ConfirmAltaModal, TicketImportedDetailsModal,
    } from "../components";
    import { networkStore } from "../stores/network.svelte";

    // Tickets paginados del servidor vía TicketState
    let tickets = $derived(ticketState.pagination.items);
    let currentPage = $derived(ticketState.pagination.currentPage);
    let pageSize = $derived(ticketState.pagination.pageSize);
    let totalRecords = $derived(ticketState.pagination.totalRecords);
    let isLoading = $derived(ticketState.pagination.isLoading);
    let isZipExporting = $state(false);

    // Filtros de UI que mapean nombre → ID antes de aplicar
    let depNameFilter = $state("Todas");

    // Sincronizar nombre de dependencia → ID en el store
    $effect(() => {
        const depId = depNameFilter === "Todas"
            ? ""
            : catalogState.dependencies.find((d) => d.name === depNameFilter)?.id || "";
        ticketState.filters.dependencyId = depId;
    });

    // Debounced auto-refresh cuando cambian los filtros
    let filterDebounce: ReturnType<typeof setTimeout>;
    $effect(() => {
        ticketState.filters.type;
        ticketState.filters.priority;
        ticketState.filters.search;
        ticketState.filters.dependencyId;
        ticketState.filters.section;

        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(() => ticketState.refresh(1), 400);
    });

    // Secciones
    let currentSection = $derived(ticketState.filters.section);

    function switchSection(section: "General" | "Responsivas") {
        if (ticketState.filters.section === section) return;
        ticketState.filters.section = section;
        ticketState.filters.type = "Todos";
        ticketState.filters.priority = "Todas";
        ticketState.filters.search = "";
        depNameFilter = "Todas";
        // El $effect debounced dispara refresh(1) automáticamente
    }

    // Modal de importación
    let isImportOpen = $state(false);

    // Modales de ticket inteligente (desde importación de plantilla)
    let isAltaOpen = $state(false);
    let altaTicket = $state<any>(null);
    let isImportedOpen = $state(false);
    let importedTicket = $state<any>(null);

    // Estado de confirmacións
    let ticketToComplete = $state<any>(null);

    // Modal de comparación de modificación
    let isCompareOpen = $state(false);
    let compareTicket = $state<any>(null);

    let dependencies = $derived(catalogState.dependencies);

    // Datos paginados del servidor con resolución de nombre de persona
    let filteredTickets = $derived(
        tickets.map((t) => {
            let personName = "Desconocido";
            if (t.personnel) {
                personName = `${t.personnel.first_name} ${t.personnel.last_name}`;
            } else if (t.payload?.nombres || t.payload?.apellidos) {
                personName =
                    `${t.payload.apellidos || ""}, ${t.payload.nombres || ""}`.trim();
                if (personName.startsWith(","))
                    personName = personName.slice(1).trim();
                if (personName.endsWith(","))
                    personName = personName.slice(0, -1).trim();
            } else if (t.payload?.relatedPerson?.name) {
                personName = t.payload.relatedPerson.name;
            }

            let cardType = t.cards?.type || t.cardType;
            let cardFolio = t.cards?.folio || t.cardFolio;

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

    /** Refresca los datos paginados y datos auxiliares. */
    async function refreshData(page?: number) {
        await Promise.all([
            ticketState.refresh(page ?? ticketState.pagination.currentPage),
            cardService.fetchExtra().then((cards) => personnelState.setCards(cards)),
        ]);
        await validateOpenModalsAgainstDb();
    }

    // Manejadores
    const IMPORTED_TYPES = new Set([
        "Alta de Persona",
        "Modificación",
        "Baja de Persona",
        "Reposición",
        "Reporte de Falla",
    ]);

    function onManageTicket(ticket: any) {
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

        // Para tickets automáticos/sistema (Programación, etc.),
        // delegar al flujo de completado correspondiente
        onStartCompletion(ticket);
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

        ticketToComplete = ticket;
        handleFinalConfirm();
    }

    async function handleFinalConfirm() {
        if (!ticketToComplete) return;

        const ticket = ticketToComplete;
        ticketToComplete = null;

        const prevTickets = tickets;
        ticketState.pagination.items = ticketState.pagination.items.filter((t) => t.id !== ticket.id);
        ticketState.pagination.totalRecords = Math.max(0, ticketState.pagination.totalRecords - 1);

        try {
            await ticketService.delete(ticket.id);
            toast.success("Ticket completado");
        } catch (e) {
            handleError(e, "Completar Ticket");
            ticketState.pagination.items = prevTickets;
            ticketState.pagination.totalRecords = ticketState.pagination.totalRecords + 1;
        }
    }

    async function handleExportResponsivas() {
        const loadingToast = toast.loading("Preparando exportación...");
        try {
            const data =
                await ticketService.fetchResponsivasForExport(ticketState.filters.dependencyId);

            if (data.length === 0) {
                toast.info("No hay responsivas pendientes para exportar", {
                    id: loadingToast,
                });
                return;
            }

            await exportResponsivasToExcel(data, depNameFilter);
            toast.success("Exportación completada", { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, "Exportar Responsivas");
        }
    }

    async function handleExportResponsivasAllDepsZip() {
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
            toast.dismiss(loadingToast);
            handleError(error, "Exportar ZIP Responsivas");
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
                            bind:value={ticketState.filters.type}
                        />
                    </div>
                {/if}

                <!-- Priority -->
                <div class="w-full xl:w-auto">
                    <FilterSelect
                        label="Prioridad"
                        options={["Todas", "Alta", "Media", "Baja"]}
                        placeholder=""
                        bind:value={ticketState.filters.priority}
                    />
                </div>

                <!-- Dependency -->
                {#if currentSection === "Responsivas"}
                    <div class="w-full xl:w-auto">
                        <FilterSelect
                            label="Dependencia"
                            options={["Todas", ...dependencies.map((d) => d.name)]}
                            placeholder=""
                            bind:value={depNameFilter}
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
                        bind:value={ticketState.filters.search}
                    />
                </div>
            </div>
        {/snippet}

        {#snippet actions()}
            {#if currentSection === "Responsivas"}
                <ExportDropdown
                    icon={Download}
                    label="Exportar Excel"
                    disabled={!networkStore.isOnline || isZipExporting}
                    menuWidth="w-64"
                >
                    {#snippet items()}
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
                    {/snippet}
                </ExportDropdown>
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
        {/snippet}
    </SectionHeader>

    <ContentView
        isLoading={isLoading}
        data={filteredTickets}
        emptyTitle="Todo al día"
        emptyTitleFiltered="Sin resultados"
        emptyDescription="No hay tickets pendientes en este momento. Todo está en orden."
        emptyDescriptionFiltered="No encontramos tickets con los filtros actuales. Intenta ajustar tu búsqueda."
        emptyIcon={ClipboardList}
        emptyIconBgClass="from-amber-50 to-amber-100 ring-1 ring-amber-200/50 text-amber-400"
        hasFilters={!!(ticketState.filters.type !== "Todos" || ticketState.filters.priority !== "Todas" || ticketState.filters.search)}
        onClearFilters={() => {
            ticketState.filters.type = 'Todos';
            ticketState.filters.priority = 'Todas';
            ticketState.filters.search = '';
            depNameFilter = 'Todas';
            // El $effect debounced dispara refresh(1) automáticamente
        }}
        skeletonColumns={4}
        skeletonRows={6}
    >
        {#snippet children()}
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                {#each filteredTickets as ticket (ticket.id)}
                    <TaskBanner
                        {ticket}
                        onManage={onManageTicket}
                        onComplete={onStartCompletion}
                    />
                {/each}
            </div>
        {/snippet}

    </ContentView>

    <Pagination
        {currentPage}
        {pageSize}
        totalRecords={totalRecords}
        onPrevPage={() => ticketState.prevPage()}
        onNextPage={() => ticketState.nextPage()}
        onGoToPage={(page) => ticketState.goToPage(page)}
        {isLoading}
    />
</div>

<ModificationCompareModal
    bind:isOpen={isCompareOpen}
    ticket={compareTicket}
    onComplete={() => refreshData()}
/>

<ImportPreviewModal bind:isOpen={isImportOpen} onComplete={() => refreshData()} />

<ConfirmAltaModal
    bind:isOpen={isAltaOpen}
    ticket={altaTicket}
    onComplete={() => refreshData()}
/>

<TicketImportedDetailsModal
    bind:isOpen={isImportedOpen}
    ticket={importedTicket}
    onComplete={() => refreshData()}
/>
