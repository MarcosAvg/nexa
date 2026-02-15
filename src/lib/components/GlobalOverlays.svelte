<script lang="ts">
    import { personnelState } from "../stores";
    import { personnelService } from "../services/personnel";
    import { cardService } from "../services/cards";
    import PersonDetailsPanel from "./PersonDetailsPanel.svelte";
    import PersonModal from "./modals/PersonModal.svelte";
    import AddCardModal from "./modals/AddCardModal.svelte";
    import ConfirmationModal from "./modals/ConfirmationModal.svelte";
    import { personnelActions } from "../utils/personnelActions";

    // Computed state from global store
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);
    let selectedPerson = $derived(
        personnelState.personnel.find((p) => p.id === selectedPersonId) || null,
    );

    let isEditModalOpen = $derived(personnelState.isEditModalOpen);
    let editingPerson = $derived(personnelState.editingPerson);

    // Local state for Global Overlays (actions triggered from here)
    let isCardModalOpen = $state(false);

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
        const [updatedPeople, updatedCards] = await Promise.all([
            personnelService.fetchAll(),
            cardService.fetchExtra(),
        ]);
        personnelState.setPersonnel(updatedPeople);
        personnelState.setCards(updatedCards);

        // Update selected person reference if open
        if (selectedPersonId) {
            // No need to manually update selectedPerson as it is a derived value from the store
            // But we might need to handle edge case if person was deleted
            if (!updatedPeople.find((p) => p.id === selectedPersonId)) {
                personnelState.setDetailsOpen(false);
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
            title: "¿Dar de baja?",
            description:
                "La persona pasará a estado INACTIVO. Sus tarjetas se desactivarán.",
            variant: "danger",
            confirmText: "Dar de Baja",
            onConfirm: () =>
                personnelActions.handleDeactivatePerson(p, refreshData),
        };
    };

    const onReactivate = (p: any) =>
        personnelActions.handleReactivatePerson(p, refreshData);

    const onDeletePermanent = (p: any) => {
        confirmModal = {
            isOpen: true,
            title: "¿ELIMINAR PERMANENTEMENTE?",
            description:
                "Esta acción borrará todo el historial, tarjetas y accesos. NO SE PUEDE DESHACER.",
            variant: "danger",
            confirmText: "Eliminar Definitivamente",
            onConfirm: () =>
                personnelActions.handleDeletePersonPermanent(p, async () => {
                    personnelState.setDetailsOpen(false);
                    await refreshData();
                }),
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

    // Card Save Handler (from AddCardModal inside Details Panel context)
    const handleCardSave = async (cardData: {
        type: string;
        folio: string;
    }) => {
        if (!selectedPersonId) return;
        await personnelActions.handleCardSave(
            cardData,
            selectedPersonId,
            refreshData,
        );
        isCardModalOpen = false;
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
    onCardAdd={() => (isCardModalOpen = true)}
    {onCardBlock}
    {onCardUnassign}
    onRefresh={refreshData}
    onclose={() => personnelState.setDetailsOpen(false)}
/>

<!-- Global Edit Modal -->
<PersonModal bind:isOpen={isEditModalOpen} {editingPerson} />

<!-- Global Add Card Modal (triggered from Details Panel) -->
<AddCardModal
    bind:isOpen={isCardModalOpen}
    mode="assign"
    onSave={handleCardSave}
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
