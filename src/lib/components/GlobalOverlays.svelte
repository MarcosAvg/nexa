<script lang="ts">
    import { personnelState } from "../stores";
    import { personnelService } from "../services/personnel";
    import { cardService } from "../services/cards";
    import PersonDetailsPanel from "./PersonDetailsPanel.svelte";
    import PersonModal from "./modals/PersonModal.svelte";
    import AddCardModal from "./modals/AddCardModal.svelte";
    import ConfirmationModal from "./modals/ConfirmationModal.svelte";
    import DeletePersonnelModal from "./modals/DeletePersonnelModal.svelte";
    import { personnelActions } from "../utils/personnelActions";
    import { appEvents, EVENTS } from "../utils/appEvents";

    // Computed state from global store
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);

    let fetchedPerson = $state<any>(null);

    let selectedPerson = $derived.by(() => {
        if (!selectedPersonId) return null;
        const pInStore = personnelState.personnel.find(
            (p) => p.id === selectedPersonId,
        );
        if (pInStore) return pInStore;
        if (fetchedPerson && fetchedPerson.id === selectedPersonId)
            return fetchedPerson;
        return null;
    });

    $effect(() => {
        if (isDetailsOpen && selectedPersonId) {
            const pInStore = personnelState.personnel.find(
                (p) => p.id === selectedPersonId,
            );
            if (
                !pInStore &&
                (!fetchedPerson || fetchedPerson.id !== selectedPersonId)
            ) {
                personnelService
                    .fetchById(selectedPersonId)
                    .then((p) => {
                        if (p) fetchedPerson = p;
                    })
                    .catch(console.error);
            }
        }
    });

    $effect(() => {
        const unsub = appEvents.on(EVENTS.TRIGGER_DEACTIVATE, (payload: any) => {
            if (payload?.person) {
                // 1. Abrimos el panel lateral de la persona
                personnelState.selectPerson(payload.person.id);
                // 2. Preparamos y abrimos el modal de confirmación
                confirmModal = {
                    isOpen: true,
                    title: "¿DAR DE BAJA?",
                    description:
                        "Esta persona dejará de tener acceso, pero sus datos se conservarán en el sistema. Las tarjetas pasarán a estar bloqueadas.",
                    variant: "danger",
                    confirmText: "Dar de Baja",
                    onConfirm: async () => {
                        await personnelActions.handleDeactivatePerson(
                            payload.person,
                            refreshData,
                        );
                        if (payload.onSuccess) {
                            await payload.onSuccess();
                        }
                    },
                };
            }
        });
        return () => unsub();
    });

    // Local state for Global Overlays (actions triggered from here)
    let isCardModalOpen = $state(false);
    let replacingCard = $state<any>(null);
    let deleteModal = $state<{
        isOpen: boolean;
        person: any;
    }>({
        isOpen: false,
        person: null,
    });

    let confirmModal = $state({
        isOpen: false,
        title: "",
        description: "",
        variant: "danger" as "danger" | "warning" | "info",
        confirmText: "Confirmar",
        onConfirm: async () => {},
    });

    // Refresh Data Helper
    async function refreshData() {
        await Promise.all([
            personnelState.refresh(
                personnelState.currentPage,
                personnelState.searchQuery,
                personnelState.statusFilter,
                personnelState.dependencyId,
            ),
            cardService
                .fetchExtra()
                .then((cards) => personnelState.setCards(cards)),
        ]);

        if (selectedPersonId) {
            const stillExists =
                await personnelService.fetchById(selectedPersonId);
            if (!stillExists) {
                personnelState.setDetailsOpen(false);
            } else {
                fetchedPerson = stillExists;
            }
        }
    }

    // Action wrappers that inject refreshData
    const onBlock = (p: any) => {
        confirmModal = {
            isOpen: true,
            title:
                p.status_raw === "blocked"
                    ? "¿Desbloquear Persona?"
                    : "¿Bloquear Persona?",
            description:
                p.status_raw === "blocked"
                    ? "La persona volverá a tener acceso según sus tarjetas activas."
                    : "Se denegará el acceso a todas las instalaciones.",
            variant: p.status_raw === "blocked" ? "info" : "warning",
            confirmText:
                p.status_raw === "blocked" ? "Desbloquear" : "Bloquear",
            onConfirm: () => personnelActions.handleBlockPerson(p, refreshData),
        };
    };

    const onDeactivate = (p: any) => {
        confirmModal = {
            isOpen: true,
            title: "¿DAR DE BAJA?",
            description:
                "Esta persona dejará de tener acceso, pero sus datos se conservarán en el sistema. Las tarjetas pasarán a estar bloqueadas.",
            variant: "danger",
            confirmText: "Dar de Baja",
            onConfirm: () =>
                personnelActions.handleDeactivatePerson(p, refreshData),
        };
    };

    const onReactivate = (p: any) =>
        personnelActions.handleReactivatePerson(p, refreshData);

    const onDeletePermanent = (p: any) => {
        deleteModal = {
            isOpen: true,
            person: p,
        };
    };

    const onCardBlock = (c: any) => {
        const isReactivation =
            c.status === "blocked" || c.status === "inactive";
        confirmModal = {
            isOpen: true,
            title: isReactivation
                ? "¿Reactivar tarjeta?"
                : "¿Bloquear tarjeta?",
            description: isReactivation
                ? "La tarjeta volverá a estar disponible o activa."
                : "Se denegará el acceso a esta tarjeta.",
            variant: isReactivation ? "info" : "warning",
            confirmText: isReactivation ? "Reactivar" : "Bloquear",
            onConfirm: () => personnelActions.handleCardBlock(c, refreshData),
        };
    };

    const onCardUnassign = (c: any) => {
        confirmModal = {
            isOpen: true,
            title: "¿Desvincular tarjeta?",
            description: "La tarjeta volverá al inventario como disponible.",
            variant: "warning",
            confirmText: "Desvincular",
            onConfirm: () =>
                personnelActions.handleCardUnassign(c, refreshData),
        };
    };

    const onCardReplace = (c: any) => {
        replacingCard = c;
        isCardModalOpen = true;
    };

    const onCardProgram = (c: any) => {
        confirmModal = {
            isOpen: true,
            title: "¿Confirmar Programación?",
            description:
                "Confirma que la tarjeta ha sido programada físicamente en el sistema externo. Esto también completará automáticamente cualquier ticket de programación pendiente asociado.",
            variant: "info",
            confirmText: "Completar Programación",
            onConfirm: () => personnelActions.handleCardProgram(c, refreshData),
        };
    };

    // Card Save Handler (from AddCardModal inside Details Panel context)
    const handleCardSave = async (
        cardData: { type: string; folio: string },
        replacementOptions?: { oldCardStatus: string },
    ) => {
        if (!selectedPersonId) return;

        await personnelActions.handleCardSave(
            cardData,
            selectedPersonId,
            refreshData,
            replacementOptions,
        );
        isCardModalOpen = false;
        replacingCard = null; // Reset
    };

    function onEdit(person: any) {
        personnelState.openEditModal(person);
    }
</script>

<!-- Global Details Panel -->
<PersonDetailsPanel
    isOpen={isDetailsOpen}
    person={selectedPerson}
    {onEdit}
    {onBlock}
    {onDeactivate}
    {onReactivate}
    {onDeletePermanent}
    onCardAdd={() => {
        replacingCard = null;
        isCardModalOpen = true;
    }}
    {onCardBlock}
    {onCardUnassign}
    {onCardReplace}
    {onCardProgram}
    onRefresh={refreshData}
    onclose={() => personnelState.setDetailsOpen(false)}
/>

<!-- Global Edit Modal -->
<PersonModal
    isOpen={personnelState.isEditModalOpen}
    editingPerson={personnelState.editingPerson}
    onclose={() => personnelState.closeEditModal()}
/>

<!-- Global Add Card Modal (triggered from Details Panel) -->
<AddCardModal
    bind:isOpen={isCardModalOpen}
    mode="assign"
    {replacingCard}
    onSave={handleCardSave}
    onclose={() => {
        replacingCard = null;
        isCardModalOpen = false;
    }}
/>

<!-- Generic Confirmation Modal -->
<ConfirmationModal
    bind:isOpen={confirmModal.isOpen}
    title={confirmModal.title}
    description={confirmModal.description}
    variant={confirmModal.variant}
    confirmText={confirmModal.confirmText}
    onConfirm={confirmModal.onConfirm}
    onCancel={() => (confirmModal.isOpen = false)}
/>

<DeletePersonnelModal
    bind:isOpen={deleteModal.isOpen}
    person={deleteModal.person}
    onConfirm={async (cardActionMap) => {
        await personnelActions.handleDeletePersonPermanent(
            deleteModal.person,
            cardActionMap,
            async () => {
                personnelState.setDetailsOpen(false);
                await refreshData();
            },
        );
    }}
/>
