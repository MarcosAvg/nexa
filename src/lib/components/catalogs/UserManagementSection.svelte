<script lang="ts">
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { handleError } from "../../utils";
    import { profileService } from "../../services";
    import Badge from "../Badge.svelte";
    import Card from "../Card.svelte";
    import DataTable from "../DataTable.svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import { Shield } from "lucide-svelte";

    /**
     * UserManagementSection — Gestión de usuarios y permisos.
     *
     * @example
     * <UserManagementSection />
     */
    type Props = Record<string, never>;

    let {}: Props = $props();

    let users = $state<any[]>([]);

    // Modal state
    let isUserModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let userName = $state("");
    let userEmail = $state("");
    let userRole = $state("user");

    onMount(async () => {
        await fetchUsers();
    });

    async function fetchUsers() {
        const data = await profileService.fetchAll();
        users = data;
    }

    function openUserModal(user?: any) {
        if (user) {
            editingId = user.id;
            userName = user.name || user.full_name;
            userEmail = user.email;
            userRole = user.role;
        } else {
            editingId = null;
            userName = "";
            userEmail = "";
            userRole = "user";
        }
        isUserModalOpen = true;
    }

    async function saveUser() {
        if (!editingId) return;

        try {
            await profileService.updateRole(editingId.toString(), userRole);

            const { supabase: sb } = await import("../../supabase");
            const { error: nameError } = await sb
                .from("profiles")
                .update({ full_name: userName })
                .eq("id", editingId);

            if (nameError) throw nameError;

            await fetchUsers();
            isUserModalOpen = false;
            toast.success("Permisos actualizados correctamente");
        } catch (e) {
            handleError(e, "Guardar Perfil de Usuario");
        }
    }
</script>

<Card class="p-0 overflow-hidden bg-white/60 backdrop-blur-md rounded-[22px] border border-slate-200/50 shadow-sm h-fit">
    <div class="p-8 border-b border-slate-100/60">
        <h3 class="text-xl font-black text-slate-900 tracking-tight">Gestión de Permisos</h3>
        <p class="text-sm font-medium text-slate-500 mt-0.5">Configura los niveles de acceso de los usuarios registrados</p>
    </div>

    {#snippet renderUserName(row: any)}
        <div class="flex flex-col">
            <span class="font-bold text-slate-900">{row.full_name || "Sin nombre"}</span>
            <span class="text-xs text-slate-500">{row.email}</span>
        </div>
    {/snippet}

    {#snippet renderUserRole(row: any)}
        {#if row.role === "admin"}
            <Badge variant="violet" class="bg-indigo-100 text-indigo-700 border-indigo-200">Administrador</Badge>
        {:else if row.role === "operator"}
            <Badge variant="blue" class="bg-blue-100 text-blue-700 border-blue-200">Operador</Badge>
        {:else}
            <Badge variant="slate" class="bg-slate-100 text-slate-600 border-slate-200">Visor</Badge>
        {/if}
    {/snippet}

    <div class="p-4">
        <DataTable
            data={users}
            columns={[
                { key: "full_name", label: "Usuario", render: renderUserName, width: "60%" },
                { key: "role", label: "Rol de Acceso", render: renderUserRole, width: "40%" },
            ]}
        >
            {#snippet actions(row: any)}
                <div class="flex justify-end gap-1">
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cambiar Permisos" onclick={() => openUserModal(row)}>
                        <Shield size={16} />
                    </button>
                </div>
            {/snippet}
        </DataTable>
    </div>
</Card>

<!-- Edit User Modal -->
<Modal bind:isOpen={isUserModalOpen} title="Editar Usuario" description="Gestiona los permisos y datos del usuario.">
    <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label for="user-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <Input id="user-name" placeholder="Ej. Juan Pérez" bind:value={userName} />
            </div>
            <div>
                <label for="user-email" class="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                <Input type="email" id="user-email" placeholder="ejemplo@nexa.com" bind:value={userEmail} />
            </div>
        </div>
        <div>
            <label for="user-role" class="block text-sm font-medium text-slate-700 mb-1">Rol de Acceso</label>
            <Select id="user-role" bind:value={userRole} placeholder="">
                <option value="viewer">Visor (Solo lectura)</option>
                <option value="operator">Operador (Gestión de datos)</option>
                <option value="admin">Administrador (Total)</option>
            </Select>
            <p class="text-[10px] text-slate-500 mt-2">
                <b>Visor:</b> Solo puede ver datos y crear tickets.<br />
                <b>Operador:</b> Puede gestionar personal y tarjetas, pero no completar tickets ni cambiar configuraciones.<br />
                <b>Admin:</b> Control total del sistema.
            </p>
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isUserModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveUser}>Actualizar Permisos</Button>
    {/snippet}
</Modal>
