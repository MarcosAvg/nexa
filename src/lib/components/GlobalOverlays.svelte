<script lang="ts">
    import { personnelState } from "../stores";
    import { personnelService } from "../services/personnel";
    import { cardService } from "../services/cards";
    import PersonDetailsPanel from "./PersonDetailsPanel.svelte";
    import PersonModal from "./modals/PersonModal.svelte";
    import AddCardModal from "./modals/AddCardModal.svelte";
    import ConfirmationModal from "./modals/ConfirmationModal.svelte";
    import DeletePersonnelModal from "./modals/DeletePersonnelModal.svelte";
    import { personnelActions } from "../utils";
    import { uiState } from "../stores/ui.svelte";
    import { confirm } from "../utils/confirmModal.svelte";

    // Estado calculado desde el store global
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);

    let fetchedPerson = $state<any>(null);

    let selectedPerson = $derived.by(() => {
        if (!selectedPersonId) return null;
        const pInStore = personnelState.pagination.items.find(
            (p) => p.id === selectedPersonId,
        );
        if (pInStore) return pInStore;
        if (fetchedPerson && fetchedPerson.id === selectedPersonId)
            return fetchedPerson;
        return null;
    });

    $effect(() => {
        if (isDetailsOpen && selectedPersonId) {
            const pInStore = personnelState.pagination.items.find(
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

    // La desactivación ahora se maneja directamente desde PersonnelView
    // sin necesidad del bus de eventos.

    // Estado local para overlays globales (acciones disparadas desde aquí)
    let isCardModalOpen = $state(false);
    let replacingCard = $state<any>(null);
    let deleteModal = $state<{
        isOpen: boolean;
        person: any;
    }>({
        isOpen: false,
        person: null,
    });

    // Auxiliar de actualización de datos
    async function refreshData() {
        await Promise.all([
            personnelState.refresh(personnelState.pagination.currentPage),
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

    // Envoltorios de acción que inyectan refreshData
    const onBlock = (p: any) => {
        confirm.open({
            title: p.status_raw === "blocked" ? "¿Desbloquear Persona?" : "¿Bloquear Persona?",
            description: p.status_raw === "blocked"
                ? "La persona volverá a tener acceso según sus tarjetas activas."
                : "Se denegará el acceso a todas las instalaciones.",
            variant: p.status_raw === "blocked" ? "info" : "warning",
            confirmText: p.status_raw === "blocked" ? "Desbloquear" : "Bloquear",
            onConfirm: () => personnelActions.handleBlockPerson(p, refreshData),
        });
    };

    const onDeactivate = (p: any) => {
        confirm.open({
            title: "¿DAR DE BAJA?",
            description: "Esta persona dejará de tener acceso, pero sus datos se conservarán en el sistema. Las tarjetas pasarán a estar bloqueadas.",
            variant: "danger",
            confirmText: "Dar de Baja",
            onConfirm: () => personnelActions.handleDeactivatePerson(p, refreshData),
        });
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
        const isReactivation = c.status === "blocked" || c.status === "inactive";
        confirm.open({
            title: isReactivation ? "¿Reactivar tarjeta?" : "¿Bloquear tarjeta?",
            description: isReactivation ? "La tarjeta volverá a estar disponible o activa." : "Se denegará el acceso a esta tarjeta.",
            variant: isReactivation ? "info" : "warning",
            confirmText: isReactivation ? "Reactivar" : "Bloquear",
            onConfirm: () => personnelActions.handleCardBlock(c, refreshData),
        });
    };

    const onCardUnassign = (c: any) => {
        confirm.open({
            title: "¿Desvincular tarjeta?",
            description: "La tarjeta volverá al inventario como disponible.",
            variant: "warning",
            confirmText: "Desvincular",
            onConfirm: () => personnelActions.handleCardUnassign(c, refreshData),
        });
    };

    const onCardReplace = (c: any) => {
        replacingCard = c;
        isCardModalOpen = true;
    };

    const onCardProgram = (c: any) => {
        confirm.open({
            title: "¿Confirmar Programación?",
            description: "Confirma que la tarjeta ha sido programada físicamente en el sistema externo. Esto también completará automáticamente cualquier ticket de programación pendiente asociado.",
            variant: "info",
            confirmText: "Completar Programación",
            onConfirm: () => personnelActions.handleCardProgram(c, refreshData),
        });
    };

    // Manejador de guardado de tarjeta (desde AddCardModal en contexto de Details Panel)
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
        isCardModalOpen = false;            replacingCard = null; // Reiniciar
    };

    function onEdit(person: any) {
        personnelState.openEditModal(person);
    }
</script>        <!-- Panel de detalles global -->
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
/>        <!-- Modal de edición global -->
<PersonModal
    isOpen={personnelState.isEditModalOpen}
    editingPerson={personnelState.editingPerson}
    forceDirectSave={uiState.isDirectEditMode}
    onclose={() => personnelState.closeEditModal()}
/>        <!-- Modal de añadir tarjeta global (desde Panel de detalles) -->
<AddCardModal
    bind:isOpen={isCardModalOpen}
    mode="assign"
    {replacingCard}
    onSave={handleCardSave}
    onclose={() => {
        replacingCard = null;
        isCardModalOpen = false;
    }}
/>        <!-- Modal de confirmación genérico (singleton) -->
<ConfirmationModal
    bind:isOpen={confirm.isOpen}
    title={confirm.title}
    description={confirm.description}
    variant={confirm.variant}
    confirmText={confirm.confirmText}
    cancelText={confirm.cancelText}
    onConfirm={confirm.onConfirm}
    onCancel={() => confirm.close()}
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
