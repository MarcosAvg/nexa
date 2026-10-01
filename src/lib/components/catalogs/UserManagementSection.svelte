<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { handleError } from '../../utils';
    import { profileService } from '../../services';
    import { userState } from '../../stores';
    import Badge from '../Badge.svelte';
    import Card from '../Card.svelte';
    import IconButton from '../IconButton.svelte';
    import DataTable from '../DataTable.svelte';
    import DataList from '../DataList.svelte';
    import Input from '../Input.svelte';
    import Select from '../Select.svelte';
    import SearchInput from '../SearchInput.svelte';
    import FilterSelect from '../FilterSelect.svelte';
    import Modal from '../Modal.svelte';
    import Button from '../Button.svelte';
    import { Shield, Power } from 'lucide-svelte';
    import { normalizeSearch } from '../../utils';
    import { confirm } from '../../utils/confirmModal.svelte';

    /**
     * UserManagementSection — Gestión de usuarios y permisos.
     *
     * @example
     * <UserManagementSection />
     */
    type Props = Record<string, never>;

    let _: Props = $props();

    let users = $state<any[]>([]);

    // Buscador y filtro por rol (cliente; la lista de usuarios es pequeña).
    let userSearch = $state('');
    let userRoleFilter = $state<string[]>([]);
    let userActiveFilter = $state<string[]>([]);

    let isUserActive = (u: any) => u.is_active !== false;

    let filteredUsers = $derived.by(() => {
        const terms = normalizeSearch(userSearch).split(' ').filter(Boolean);
        return users.filter((u: any) => {
            if (userRoleFilter.length > 0 && !userRoleFilter.includes(u.role)) return false;
            const active = isUserActive(u);
            if (userActiveFilter.length > 0) {
                const wantsActive = userActiveFilter.includes('Activos');
                const wantsInactive = userActiveFilter.includes('Inactivos');
                if (wantsActive && !wantsInactive && !active) return false;
                if (wantsInactive && !wantsActive && active) return false;
            }
            if (terms.length === 0) return true;
            const hay = normalizeSearch(`${u.full_name ?? ''} ${u.email ?? ''}`);
            return terms.every((t) => hay.includes(t));
        });
    });

    /** ¿El usuario es el último admin activo? No se puede degradar ni desactivar. */
    function isLastActiveAdmin(user: any): boolean {
        if (user.role !== 'admin' || !isUserActive(user)) return false;
        return users.filter((u: any) => u.role === 'admin' && isUserActive(u)).length <= 1;
    }

    async function toggleActive(user: any) {
        const toActive = !isUserActive(user);
        if (!toActive && isLastActiveAdmin(user)) {
            toast.error('No se puede desactivar al último administrador activo');
            return;
        }
        const isSelf = userState.profile && String(userState.profile.id) === String(user.id);
        const apply = async () => {
            try {
                await profileService.setActive(String(user.id), toActive);
                await fetchUsers();
                toast.success(toActive ? 'Usuario activado' : 'Usuario desactivado');
                if (isSelf && !toActive) {
                    const { supabase: sb } = await import('../../supabase');
                    await sb.auth.signOut();
                }
            } catch (e) {
                handleError(e, toActive ? 'Activar Usuario' : 'Desactivar Usuario');
            }
        };
        if (!toActive) {
            confirm.open({
                title: `¿Desactivar a ${user.full_name || user.email}?`,
                description: isSelf
                    ? 'Se cerrará tu sesión y no podrás volver a entrar hasta que otro administrador te reactive.'
                    : 'No podrá iniciar sesión ni usar el sistema hasta ser reactivado.',
                variant: 'danger',
                confirmText: 'Desactivar',
                onConfirm: () => void apply(),
            });
        } else {
            await apply();
        }
    }

    // Modal state
    let isUserModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let userName = $state('');
    let userEmail = $state('');
    let userRole = $state('user');

    // Invitar usuario
    let isInviteOpen = $state(false);
    let inviteName = $state('');
    let inviteEmail = $state('');
    let inviteRole = $state('viewer');
    let isInviting = $state(false);

    /** ¿El usuario editado es el último admin? Entonces no se puede degradar. */
    let editingIsLastAdmin = $derived.by(() => {
        if (!editingId) return false;
        const target = users.find((u: any) => String(u.id) === String(editingId));
        if (!target || target.role !== 'admin') return false;
        return users.filter((u: any) => u.role === 'admin').length <= 1;
    });

    /** ¿El admin se está degradando a sí mismo? (permitido solo si quedan otros). */
    let isSelfDemotion = $derived.by(() => {
        if (!editingId || userState.profile?.role !== 'admin') return false;
        return (
            String(userState.profile.id) === String(editingId) && userRole !== 'admin' && !editingIsLastAdmin
        );
    });

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
            userName = '';
            userEmail = '';
            userRole = 'user';
        }
        isUserModalOpen = true;
    }

    async function openInviteModal() {
        inviteName = '';
        inviteEmail = '';
        inviteRole = 'viewer';
        isInviteOpen = true;
    }

    async function handleInvite() {
        if (!inviteEmail.trim()) {
            toast.error('Ingresa el correo del invitado');
            return;
        }
        isInviting = true;
        try {
            await profileService.inviteUser(inviteEmail.trim(), inviteName.trim(), inviteRole);
            await fetchUsers();
            isInviteOpen = false;
            toast.success(`Invitación enviada a ${inviteEmail.trim()}`);
        } catch (e) {
            handleError(e, 'Invitar Usuario');
        } finally {
            isInviting = false;
        }
    }

    async function saveUser() {
        if (!editingId) return;

        // Defensa en cliente (el servidor vuelve a validar en set_user_role).
        if (editingIsLastAdmin && userRole !== 'admin') {
            toast.error('No se puede degradar al último administrador');
            return;
        }

        try {
            // Todo por RPC: el cliente no emite UPDATEs directos sobre profiles.
            await profileService.updateRole(editingId.toString(), userRole, userName);

            await fetchUsers();
            isUserModalOpen = false;
            toast.success('Permisos actualizados correctamente');
        } catch (e) {
            handleError(e, 'Guardar Perfil de Usuario');
        }
    }
</script>

<Card
    class="p-0 overflow-hidden bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-sm h-fit"
>
    <div class="p-8 border-b border-slate-100/60 flex items-start justify-between gap-4">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Gestión de Permisos</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">
                Configura los niveles de acceso de los usuarios registrados
            </p>
        </div>
        <Button variant="primary" size="sm" onclick={openInviteModal} class="shrink-0">
            Invitar usuario
        </Button>
    </div>

    {#snippet renderUserName(row: any)}
        <div class="flex flex-col">
            <span class="flex items-center gap-2 font-bold text-slate-900">
                {row.full_name || 'Sin nombre'}
                {#if !isUserActive(row)}
                    <Badge variant="rose" class="bg-rose-100 text-rose-700 border-rose-200">Inactivo</Badge>
                {/if}
            </span>
            <span class="text-xs text-slate-500">{row.email}</span>
        </div>
    {/snippet}

    {#snippet renderUserRole(row: any)}
        {#if row.role === 'admin'}
            <Badge variant="violet" class="bg-indigo-100 text-indigo-700 border-indigo-200"
                >Administrador</Badge
            >
        {:else if row.role === 'operator'}
            <Badge variant="blue" class="bg-blue-100 text-blue-700 border-blue-200">Operador</Badge>
        {:else}
            <Badge variant="slate" class="bg-slate-100 text-slate-600 border-slate-200">Visor</Badge>
        {/if}
    {/snippet}

    <div class="p-4 space-y-3">
        <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1">
                <SearchInput
                    placeholder="Buscar por nombre o correo..."
                    bind:value={userSearch}
                    class="h-10 text-xs font-bold"
                />
            </div>
            <div class="sm:w-56">
                <FilterSelect
                    label="Rol"
                    multiple
                    options={[
                        { value: 'admin', label: 'Administrador' },
                        { value: 'operator', label: 'Operador' },
                        { value: 'viewer', label: 'Visor' },
                    ]}
                    placeholder="Todos"
                    bind:values={userRoleFilter}
                />
            </div>
            <div class="sm:w-44">
                <FilterSelect
                    label="Estado"
                    multiple
                    options={[
                        { value: 'Activos', label: 'Activos' },
                        { value: 'Inactivos', label: 'Inactivos' },
                    ]}
                    placeholder="Todos"
                    bind:values={userActiveFilter}
                />
            </div>
        </div>
        <DataTable
            data={filteredUsers}
            columns={[
                { key: 'full_name', label: 'Usuario', render: renderUserName, width: '60%' },
                { key: 'role', label: 'Rol de Acceso', render: renderUserRole, width: '40%' },
            ]}
            {mobileList}
        >
            {#snippet actions(row: any)}
                <div class="flex justify-end gap-1">
                    <IconButton
                        icon={Shield}
                        label="Cambiar permisos"
                        tone="blue"
                        size="sm"
                        onclick={() => openUserModal(row)}
                    />
                    <IconButton
                        icon={Power}
                        label={isUserActive(row) ? 'Desactivar usuario' : 'Activar usuario'}
                        tone={isUserActive(row) ? 'rose' : 'emerald'}
                        size="sm"
                        onclick={() => toggleActive(row)}
                    />
                </div>
            {/snippet}
        </DataTable>
    </div>
</Card>

{#snippet mobileList(rows: any[])}
    <DataList
        items={rows}
        key={(r: any) => r.id}
        sheetTitle={(r: any) => r.full_name || 'Sin nombre'}
        sheetSubtitle={(r: any) => r.email}
        actions={(r: any) => [
            { label: 'Permisos', tone: 'blue' as const, onAction: () => openUserModal(r) },
            isUserActive(r)
                ? { label: 'Desactivar', tone: 'rose' as const, onAction: () => toggleActive(r) }
                : { label: 'Activar', tone: 'emerald' as const, onAction: () => toggleActive(r) },
        ]}
    >
        {#snippet title(r: any)}
            <span>{r.full_name || 'Sin nombre'}</span>
        {/snippet}
        {#snippet subtitle(r: any)}
            <span>{r.email}</span>
        {/snippet}
        {#snippet trailing(r: any)}
            {#if r.role === 'admin'}
                <Badge variant="violet" class="bg-indigo-100 text-indigo-700 border-indigo-200"
                    >Administrador</Badge
                >
            {:else if r.role === 'operator'}
                <Badge variant="blue" class="bg-blue-100 text-blue-700 border-blue-200">Operador</Badge>
            {:else}
                <Badge variant="slate" class="bg-slate-100 text-slate-600 border-slate-200">Visor</Badge>
            {/if}
        {/snippet}
        {#snippet details(r: any)}
            <div class="space-y-3">
                <div class="flex flex-col">
                    <span class="flex items-center gap-2 font-bold text-slate-900">
                        {r.full_name || 'Sin nombre'}
                        {#if !isUserActive(r)}
                            <Badge variant="rose" class="bg-rose-100 text-rose-700 border-rose-200"
                                >Inactivo</Badge
                            >
                        {/if}
                    </span>
                    <span class="text-xs text-slate-500">{r.email}</span>
                </div>
                {#if r.role === 'admin'}
                    <Badge variant="violet" class="bg-indigo-100 text-indigo-700 border-indigo-200"
                        >Administrador</Badge
                    >
                {:else if r.role === 'operator'}
                    <Badge variant="blue" class="bg-blue-100 text-blue-700 border-blue-200">Operador</Badge>
                {:else}
                    <Badge variant="slate" class="bg-slate-100 text-slate-600 border-slate-200">Visor</Badge>
                {/if}
                <IconButton
                    icon={Shield}
                    label="Cambiar permisos"
                    tone="blue"
                    size="sm"
                    onclick={() => openUserModal(r)}
                />
            </div>
        {/snippet}
    </DataList>
{/snippet}

<!-- Edit User Modal -->
<Modal
    bind:isOpen={isUserModalOpen}
    title="Editar Usuario"
    description="Gestiona los permisos y datos del usuario."
>
    <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label for="user-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <Input id="user-name" placeholder="Ej. Juan Pérez" bind:value={userName} />
            </div>
            <div>
                <span class="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</span>
                <div
                    class="w-full min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-500 break-all"
                >
                    {userEmail || '—'}
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                    Identidad de acceso; no se puede modificar desde aquí.
                </p>
            </div>
        </div>
        <div>
            <label for="user-role" class="block text-sm font-medium text-slate-700 mb-1">Rol de Acceso</label>
            <Select id="user-role" bind:value={userRole} placeholder="" disabled={editingIsLastAdmin}>
                <option value="viewer">Visor (Solo lectura)</option>
                <option value="operator">Operador (Gestión de datos)</option>
                <option value="admin">Administrador (Total)</option>
            </Select>
            {#if editingIsLastAdmin}
                <p class="text-[11px] font-bold text-amber-600 mt-2">
                    Es el último administrador: no se puede degradar su rol.
                </p>
            {/if}
            {#if isSelfDemotion}
                <p class="text-[11px] font-bold text-amber-600 mt-2">
                    Te estás quitando el acceso de administrador. Podrás seguir usando el sistema como {userRole ===
                    'operator'
                        ? 'operador'
                        : 'visor'}.
                </p>
            {/if}
            <p class="text-[10px] text-slate-500 mt-2">
                <b>Visor:</b> Solo lectura en Dashboard, Personal, Tarjetas y Enlaces.<br />
                <b>Operador:</b> Gestiona personal, tarjetas y atiende tickets; sin acceso a Configuración.<br
                />
                <b>Admin:</b> Control total del sistema.
            </p>
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isUserModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveUser}>Actualizar Permisos</Button>
    {/snippet}
</Modal>

<!-- Invite User Modal -->
<Modal
    bind:isOpen={isInviteOpen}
    title="Invitar Usuario"
    description="Envía una invitación por correo con rol preasignado."
>
    <div class="space-y-4">
        <div>
            <label for="invite-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <Input id="invite-name" placeholder="Ej. Juan Pérez" bind:value={inviteName} />
        </div>
        <div>
            <label for="invite-email" class="block text-sm font-medium text-slate-700 mb-1"
                >Correo Electrónico <span class="text-rose-500">*</span></label
            >
            <Input id="invite-email" type="email" placeholder="ejemplo@nexa.com" bind:value={inviteEmail} />
        </div>
        <div>
            <label for="invite-role" class="block text-sm font-medium text-slate-700 mb-1"
                >Rol de Acceso</label
            >
            <Select id="invite-role" bind:value={inviteRole} placeholder="">
                <option value="viewer">Visor (Solo lectura)</option>
                <option value="operator">Operador (Gestión de datos)</option>
                <option value="admin">Administrador (Total)</option>
            </Select>
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isInviteOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={handleInvite} loading={isInviting}>Enviar invitación</Button>
    {/snippet}
</Modal>
