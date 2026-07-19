<script lang="ts">
    /**
     * CatalogItemModal.svelte
     *
     * A reusable CRUD modal for managing catalog items.
     * Always renders a "Nombre" field, and accepts optional children
     * for extra fields (e.g., pisos, días, etc.).
     *
     * @example
     *   <CatalogItemModal
     *       bind:isOpen
     *       title={editingId ? "Editar Edificio" : "Nuevo Edificio"}
     *       description="Registra un nuevo edificio"
     *       bind:itemName={buildingName}
     *       onSave={handleSaveBuilding}
     *       saveLabel={editingId ? "Actualizar Edificio" : "Guardar Edificio"}
     *   >
     *       <!-- Extra fields -->
     *       <div>...</div>
     *   </CatalogItemModal>
     */
    import Modal from "./Modal.svelte";
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import { type Snippet } from "svelte";

    let {
        isOpen = $bindable(false),
        title = "Nuevo Elemento",
        description = "",
        itemName = $bindable(""),
        onSave = async () => {},
        onClose = () => {},
        children,
        footer,
        canSave = true,
        saveLabel = "Guardar",
        saveLoading = false,
        namePlaceholder = "Nombre",
        nameLabel = "Nombre",
    }: {
        /** Whether the modal is open (two-way bindable). */
        isOpen: boolean;
        /** Modal title. */
        title?: string;
        /** Modal description / subtitle. */
        description?: string;
        /** The item's name (two-way bindable). */
        itemName: string;
        /** Async callback invoked when the user clicks Save. */
        onSave: () => Promise<void>;
        /** Called when the modal is closed without saving. */
        onClose?: () => void;
        /** Extra form fields rendered below the name field. */
        children?: Snippet;
        /** Override the default footer buttons. */
        footer?: Snippet;
        /** Disables the Save button when falsy. */
        canSave?: boolean;
        /** Label for the Save button. */
        saveLabel?: string;
        /** Shows a loading spinner on the Save button. */
        saveLoading?: boolean;
        /** Placeholder for the name input. */
        namePlaceholder?: string;
        /** Label for the name input. */
        nameLabel?: string;
    } = $props();

    function handleClose() {
        isOpen = false;
        onClose?.();
    }
</script>

<Modal bind:isOpen {title} {description} onclose={handleClose} footer={innerFooter}>
    <div class="space-y-4">
        <div>
            <label for="catalog-name" class="block text-sm font-medium text-slate-700 mb-1"
                >{nameLabel}</label
            >
            <Input
                id="catalog-name"
                placeholder={namePlaceholder}
                bind:value={itemName}
            />
        </div>

        {#if children}
            {@render children()}
        {/if}
    </div>
</Modal>

{#snippet innerFooter()}
    {#if footer}
        {@render footer()}
    {:else}
        <div class="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onclick={handleClose}>
                Cancelar
            </Button>
            <Button
                variant="primary"
                onclick={onSave}
                disabled={!canSave}
                loading={saveLoading}
            >
                {saveLabel}
            </Button>
        </div>
    {/if}
{/snippet}
