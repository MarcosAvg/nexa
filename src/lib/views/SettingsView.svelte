<script lang="ts">
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import {
        personnelService,
        catalogService,
        profileService,
    } from "../services/personnel";
    import {
        Building2,
        Briefcase,
        Key,
        Calendar,
        Users,
        Plus,
        Trash2,
        Edit2,
        Shield,
    } from "lucide-svelte";
    import Card from "../components/Card.svelte";
    import Button from "../components/Button.svelte";
    import Badge from "../components/Badge.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Modal from "../components/Modal.svelte";
    import Input from "../components/Input.svelte";
    import Select from "../components/Select.svelte";

    import { catalogState, userState } from "../stores"; // Import stores
    // Remove currentUser prop

    let activeTab = $state<"catalogos" | "usuarios">("catalogos");
    let activeCatalog = $state<
        "edificios" | "dependencias" | "accesos" | "dias"
    >("edificios");

    // --- Global State ---
    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let specialAccesses = $derived(catalogState.specialAccesses);
    let schedules = $derived(catalogState.schedules);
    let users = $state<any[]>([]); // Users still local as they are specific to this admin view

    let currentUser = $derived.by(() => {
        if (!userState.profile) return { role: "viewer" }; // Fallback
        return userState.profile;
    });

    let canEdit = $derived(
        currentUser.role === "admin" || currentUser.role === "operator",
    );

    onMount(async () => {
        await fetchAll();
    });

    async function fetchAll() {
        await Promise.all([
            fetchBuildings(),
            fetchDependencies(),
            fetchAccesses(),
            fetchSchedules(),
            fetchUsers(),
        ]);
    }

    async function fetchBuildings() {
        const data = await catalogService.fetchBuildings();
        catalogState.setBuildings(data);
    }

    async function fetchDependencies() {
        const data = await catalogService.fetchDependencies();
        catalogState.setDependencies(data);
    }

    async function fetchAccesses() {
        const data = await catalogService.fetchAccesses();
        catalogState.setSpecialAccesses(data);
    }

    async function fetchSchedules() {
        const data = await catalogService.fetchSchedules();
        catalogState.setSchedules(data);
    }

    async function fetchUsers() {
        const data = await profileService.fetchAll();
        users = data;
    }

    // --- Derived ---
    // (Helpers for rendering logic if needed)

    // --- Actions ---

    // Placeholder for modal states
    let isBuildingModalOpen = $state(false);
    let isDependencyModalOpen = $state(false);
    let isAccessModalOpen = $state(false);
    let isScheduleModalOpen = $state(false);
    let isUserModalOpen = $state(false);
    // --- Edit State ---
    let editingId = $state<number | null>(null);

    // Form States
    let buildingName = $state("");
    let buildingFloors = $state("");

    let dependencyName = $state("");

    let accessName = $state("");

    let scheduleName = $state("");
    let scheduleDays = $state<string[]>([]);

    let userName = $state("");
    let userEmail = $state("");
    let userRole = $state("user");

    // --- Actions ---

    function openBuildingModal(building?: any) {
        if (building) {
            editingId = building.id;
            buildingName = building.name;
            buildingFloors = building.floors.join(", ");
        } else {
            editingId = null;
            buildingName = "";
            buildingFloors = "";
        }
        isBuildingModalOpen = true;
    }

    async function saveBuilding() {
        if (!buildingName.trim()) {
            toast.error("El nombre del edificio es requerido");
            return;
        }
        const floors = buildingFloors
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f);
        if (floors.length === 0) {
            toast.error("Debes agregar al menos un piso");
            return;
        }

        try {
            await catalogService.saveBuilding(editingId, {
                name: buildingName,
                floors,
            });
            await fetchBuildings();
            isBuildingModalOpen = false;
            toast.success(
                editingId ? "Edificio actualizado" : "Edificio creado",
            );
        } catch {
            toast.error("Error al guardar el edificio");
        }
    }

    function openDependencyModal(dep?: any) {
        if (dep) {
            editingId = dep.id;
            dependencyName = dep.name;
        } else {
            editingId = null;
            dependencyName = "";
        }
        isDependencyModalOpen = true;
    }

    async function saveDependency() {
        if (!dependencyName.trim()) {
            toast.error("El nombre de la dependencia es requerido");
            return;
        }
        try {
            await catalogService.saveDependency(editingId, {
                name: dependencyName,
            });
            await fetchDependencies();
            isDependencyModalOpen = false;
            toast.success(
                editingId ? "Dependencia actualizada" : "Dependencia creada",
            );
        } catch {
            toast.error("Error al guardar la dependencia");
        }
    }

    function openAccessModal(access?: any) {
        if (access) {
            editingId = access.id;
            accessName = access.name;
        } else {
            editingId = null;
            accessName = "";
        }
        isAccessModalOpen = true;
    }

    async function saveAccess() {
        if (!accessName.trim()) {
            toast.error("El nombre del acceso es requerido");
            return;
        }
        try {
            await catalogService.saveAccess(editingId, { name: accessName });
            await fetchAccesses();
            isAccessModalOpen = false;
            toast.success(editingId ? "Acceso actualizado" : "Acceso creado");
        } catch {
            toast.error("Error al guardar el acceso");
        }
    }

    function openScheduleModal(schedule?: any) {
        if (schedule) {
            editingId = schedule.id;
            scheduleName = schedule.name;
            scheduleDays = [...schedule.days];
        } else {
            editingId = null;
            scheduleName = "";
            scheduleDays = [];
        }
        isScheduleModalOpen = true;
    }

    function toggleDay(day: string) {
        if (scheduleDays.includes(day)) {
            scheduleDays = scheduleDays.filter((d) => d !== day);
        } else {
            scheduleDays = [...scheduleDays, day];
        }
    }

    async function saveSchedule() {
        if (!scheduleName.trim()) {
            toast.error("El nombre del horario es requerido");
            return;
        }
        if (scheduleDays.length === 0) {
            toast.error("Debes seleccionar al menos un día");
            return;
        }
        try {
            await catalogService.saveSchedule(editingId, {
                name: scheduleName,
                days: scheduleDays,
            });
            await fetchSchedules();
            isScheduleModalOpen = false;
            toast.success(editingId ? "Horario actualizado" : "Horario creado");
        } catch {
            toast.error("Error al guardar el horario");
        }
    }

    function openUserModal(user?: any) {
        if (user) {
            editingId = user.id;
            userName = user.name;
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

            const { supabase: sb } = await import("../supabase");
            const { error: nameError } = await sb
                .from("profiles")
                .update({ full_name: userName })
                .eq("id", editingId);

            if (nameError) throw nameError;

            await fetchUsers();
            isUserModalOpen = false;
            toast.success("Permisos actualizados correctamente");
        } catch (e) {
            console.error("Error saving user profile", e);
            toast.error("Error al actualizar permisos");
        }
    }

    // --- Secure Delete State ---
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null); // { id, name, type }
    let deleteConfirmation = $state("");

    function openDeleteModal(item: any, type: string) {
        deleteTarget = { ...item, type };
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;

        const tableMap: Record<string, string> = {
            building: "buildings",
            dependency: "dependencies",
            access: "special_accesses",
            schedule: "schedules",
        };

        const table = tableMap[deleteTarget.type];
        if (!table) return;

        try {
            await catalogService.deleteCatalogItem(
                table,
                deleteTarget.id,
                deleteTarget.name,
            );
            await fetchAll();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("Error al eliminar el elemento");
        }

        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Sidebar Navigation -->
    <Card
        class="lg:col-span-1 p-0 overflow-hidden h-fit bg-white/50 backdrop-blur-md border border-slate-200/50 rounded-[22px] shadow-sm"
    >
        <div class="p-6 border-b border-slate-100/60">
            <h3
                class="font-extrabold text-slate-900 tracking-tight uppercase text-xs tracking-[0.1em]"
            >
                Administración
            </h3>
            <p class="text-[11px] font-bold text-slate-400 mt-1">
                Configura el ecosistema Nexa
            </p>
        </div>
        <nav class="flex flex-col p-3 gap-1.5">
            <button
                class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 text-left active:scale-[0.98] {activeTab ===
                'catalogos'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'}"
                onclick={() => (activeTab = "catalogos")}
            >
                <div
                    class={activeTab === "catalogos"
                        ? "text-white"
                        : "text-slate-400"}
                >
                    <Building2 size={18} strokeWidth={2.5} />
                </div>
                Catálogos
            </button>

            {#if currentUser.role === "admin"}
                <button
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 text-left active:scale-[0.98] {activeTab ===
                    'usuarios'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'}"
                    onclick={() => (activeTab = "usuarios")}
                >
                    <div
                        class={activeTab === "usuarios"
                            ? "text-white"
                            : "text-slate-400"}
                    >
                        <Users size={18} strokeWidth={2.5} />
                    </div>
                    Usuarios
                </button>
            {/if}
        </nav>
    </Card>

    <!-- Content Area -->
    <div class="lg:col-span-3 space-y-6">
        {#if activeTab === "catalogos"}
            <!-- Sub-tabs for Catalogos -->
            <div
                class="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-none"
            >
                {#each [{ id: "edificios", label: "Edificios", icon: Building2 }, { id: "dependencias", label: "Dependencias", icon: Briefcase }, { id: "accesos", label: "Accesos", icon: Key }, { id: "dias", label: "Horarios", icon: Calendar }] as item}
                    {@const Icon = item.icon}
                    <button
                        class="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[13px] font-extrabold whitespace-nowrap transition-all duration-300 active:scale-95 {activeCatalog ===
                        item.id
                            ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-500/10'
                            : 'bg-slate-100/50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                        onclick={() => (activeCatalog = item.id as any)}
                    >
                        <Icon size={16} strokeWidth={2.5} />
                        {item.label}
                    </button>
                {/each}
            </div>

            <!-- Catalog Content -->
            <Card
                class="p-8 min-h-[400px] bg-white/60 backdrop-blur-md rounded-[22px] border border-slate-200/50 shadow-sm relative overflow-hidden"
            >
                {#if activeCatalog === "edificios"}
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h3
                                class="text-xl font-black text-slate-900 tracking-tight"
                            >
                                Edificios y Pisos
                            </h3>
                            <p
                                class="text-sm font-medium text-slate-500 mt-0.5"
                            >
                                Gestión de infraestructura física
                            </p>
                        </div>
                        {#if canEdit}
                            <Button
                                variant="primary"
                                size="sm"
                                class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10"
                                onclick={() => openBuildingModal()}
                            >
                                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo
                                Edificio
                            </Button>
                        {/if}
                    </div>

                    <div class="grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
                        {#each buildings as building}
                            <div
                                class="group p-6 border border-slate-200/50 rounded-[24px] bg-white/40 hover:bg-white transition-all duration-500 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
                            >
                                <div
                                    class="flex justify-between items-start mb-5 relative z-10"
                                >
                                    <div>
                                        <h4
                                            class="font-extrabold text-slate-900 text-[16px] tracking-tight group-hover:text-blue-600 transition-colors"
                                        >
                                            {building.name}
                                        </h4>
                                        <p
                                            class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 flex items-center gap-2"
                                        >
                                            <span
                                                class="w-1.5 h-1.5 rounded-full bg-blue-500/40"
                                            ></span>
                                            {building.floors.length} pisos configurados
                                        </p>
                                    </div>
                                    {#if canEdit}
                                        <div class="flex gap-1.5">
                                            <button
                                                class="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-all active:scale-95"
                                                onclick={() =>
                                                    openBuildingModal(building)}
                                            >
                                                <Edit2
                                                    size={16}
                                                    strokeWidth={2.5}
                                                />
                                            </button>
                                            <button
                                                class="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl transition-all active:scale-95"
                                                onclick={() =>
                                                    openDeleteModal(
                                                        building,
                                                        "building",
                                                    )}
                                            >
                                                <Trash2
                                                    size={16}
                                                    strokeWidth={2.5}
                                                />
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                                <div class="flex flex-wrap gap-2 relative z-10">
                                    {#each building.floors as floor}
                                        <span
                                            class="px-3.5 py-1.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 shadow-sm group-hover:border-blue-100 transition-colors"
                                        >
                                            {floor}
                                        </span>
                                    {/each}
                                </div>
                                <div
                                    class="absolute -right-6 -bottom-6 text-slate-400/5 group-hover:text-blue-500/8 rotate-12 transition-all duration-700 pointer-events-none"
                                >
                                    <Building2 size={100} />
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else if activeCatalog === "dependencias"}
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h3
                                class="text-xl font-black text-slate-900 tracking-tight"
                            >
                                Dependencias
                            </h3>
                            <p
                                class="text-sm font-medium text-slate-500 mt-0.5"
                            >
                                Áreas y departamentos registrados
                            </p>
                        </div>
                        {#if canEdit}
                            <Button
                                variant="primary"
                                size="sm"
                                class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10"
                                onclick={() => openDependencyModal()}
                            >
                                <Plus size={18} strokeWidth={3} class="mr-2" /> Nueva
                                Dependencia
                            </Button>
                        {/if}
                    </div>
                    <DataTable
                        data={dependencies}
                        columns={[{ key: "name", label: "Nombre" }]}
                    >
                        {#snippet actions(row: any)}
                            {#if canEdit}
                                <div class="flex justify-end gap-1">
                                    <button
                                        class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        onclick={() => openDependencyModal(row)}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        onclick={() =>
                                            openDeleteModal(row, "dependency")}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            {/if}
                        {/snippet}
                    </DataTable>
                {:else if activeCatalog === "accesos"}
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h3
                                class="text-xl font-black text-slate-900 tracking-tight"
                            >
                                Accesos Especiales
                            </h3>
                            <p
                                class="text-sm font-medium text-slate-500 mt-0.5"
                            >
                                Zonas restringidas o críticas
                            </p>
                        </div>
                        {#if canEdit}
                            <Button
                                variant="primary"
                                size="sm"
                                class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10"
                                onclick={() => openAccessModal()}
                            >
                                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo
                                Acceso
                            </Button>
                        {/if}
                    </div>

                    {#snippet renderAccessName(row: any)}
                        <div class="flex items-center gap-3">
                            <div
                                class="p-2 bg-slate-100 rounded-lg text-slate-500"
                            >
                                <Key size={16} />
                            </div>
                            <span class="text-slate-700 font-medium"
                                >{row.name}</span
                            >
                        </div>
                    {/snippet}

                    <DataTable
                        data={specialAccesses}
                        columns={[
                            {
                                key: "name",
                                label: "Nombre",
                                render: renderAccessName,
                            },
                        ]}
                    >
                        {#snippet actions(row: any)}
                            {#if canEdit}
                                <div class="flex justify-end gap-1">
                                    <button
                                        class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        onclick={() => openAccessModal(row)}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        onclick={() =>
                                            openDeleteModal(row, "access")}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            {/if}
                        {/snippet}
                    </DataTable>
                {:else if activeCatalog === "dias"}
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h3
                                class="text-xl font-black text-slate-900 tracking-tight"
                            >
                                Horarios
                            </h3>
                            <p
                                class="text-sm font-medium text-slate-500 mt-0.5"
                            >
                                Configuración de jornadas
                            </p>
                        </div>
                        {#if canEdit}
                            <Button
                                variant="primary"
                                size="sm"
                                class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10"
                                onclick={() => openScheduleModal()}
                            >
                                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo
                                Horario
                            </Button>
                        {/if}
                    </div>

                    {#snippet renderDays(row: any)}
                        <div class="flex flex-wrap gap-1">
                            {#each row.days as day}
                                <span
                                    class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200"
                                >
                                    {day.slice(0, 3)}
                                </span>
                            {/each}
                        </div>
                    {/snippet}

                    <DataTable
                        data={schedules}
                        columns={[
                            { key: "name", label: "Nombre" },
                            { key: "days", label: "Días", render: renderDays },
                        ]}
                    >
                        {#snippet actions(row: any)}
                            {#if canEdit}
                                <div class="flex justify-end gap-1">
                                    <button
                                        class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        onclick={() => openScheduleModal(row)}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        onclick={() =>
                                            openDeleteModal(row, "schedule")}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            {/if}
                        {/snippet}
                    </DataTable>
                {/if}
            </Card>
        {:else if activeTab === "usuarios" && currentUser.role === "admin"}
            <Card
                class="p-0 overflow-hidden bg-white/60 backdrop-blur-md rounded-[22px] border border-slate-200/50 shadow-sm h-fit"
            >
                <div
                    class="p-8 border-b border-slate-100/60 flex justify-between items-center"
                >
                    <div>
                        <h3
                            class="text-xl font-black text-slate-900 tracking-tight"
                        >
                            Gestión de Permisos
                        </h3>
                        <p class="text-sm font-medium text-slate-500 mt-0.5">
                            Configura los niveles de acceso de los usuarios
                            registrado
                        </p>
                    </div>
                </div>

                {#snippet renderUserName(row: any)}
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-900"
                            >{row.full_name || "Sin nombre"}</span
                        >
                        <span class="text-xs text-slate-500">{row.email}</span>
                    </div>
                {/snippet}

                {#snippet renderUserRole(row: any)}
                    {#if row.role === "admin"}
                        <Badge
                            variant="violet"
                            class="bg-indigo-100 text-indigo-700 border-indigo-200"
                            >Administrador</Badge
                        >
                    {:else if row.role === "operator"}
                        <Badge
                            variant="blue"
                            class="bg-blue-100 text-blue-700 border-blue-200"
                            >Operador</Badge
                        >
                    {:else}
                        <Badge
                            variant="slate"
                            class="bg-slate-100 text-slate-600 border-slate-200"
                            >Visor</Badge
                        >
                    {/if}
                {/snippet}

                <DataTable
                    data={users}
                    columns={[
                        {
                            key: "full_name",
                            label: "Usuario",
                            render: renderUserName,
                        },
                        {
                            key: "role",
                            label: "Rol de Acceso",
                            render: renderUserRole,
                        },
                        { key: "created_at", label: "Registro" },
                    ]}
                >
                    {#snippet actions(row: any)}
                        <div class="flex justify-end gap-1">
                            <button
                                class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Cambiar Permisos"
                                onclick={() => openUserModal(row)}
                            >
                                <Shield size={16} />
                            </button>
                        </div>
                    {/snippet}
                </DataTable>
            </Card>
        {/if}
    </div>
</div>

<!-- Add Building Modal -->
<Modal
    bind:isOpen={isBuildingModalOpen}
    title={editingId ? "Editar Edificio" : "Nuevo Edificio"}
    description="Registra un nuevo edificio y sus pisos correspondientes."
>
    <div class="space-y-4">
        <div>
            <label
                for="building-name"
                class="block text-sm font-medium text-slate-700 mb-1"
                >Nombre del Edificio</label
            >
            <Input
                id="building-name"
                placeholder="Ej. Torre Administrativa"
                bind:value={buildingName}
            />
        </div>
        <div>
            <label
                for="building-floors"
                class="block text-sm font-medium text-slate-700 mb-1"
                >Pisos (separados por coma)</label
            >
            <Input
                id="building-floors"
                placeholder="Ej. PB, 1, 2, 3"
                bind:value={buildingFloors}
            />
            <p class="text-xs text-slate-500 mt-1">
                Ingresa los identificadores de los pisos separados por comas.
            </p>
        </div>
    </div>
    {#snippet footer()}
        <Button
            variant="secondary"
            onclick={() => (isBuildingModalOpen = false)}>Cancelar</Button
        >
        <Button variant="primary" onclick={saveBuilding}
            >{editingId ? "Actualizar" : "Guardar"} Edificio</Button
        >
    {/snippet}
</Modal>

<!-- Add Dependency Modal -->
<Modal
    bind:isOpen={isDependencyModalOpen}
    title={editingId ? "Editar Dependencia" : "Nueva Dependencia"}
    description="Registra una nueva dependencia o área."
>
    <div class="space-y-4">
        <div>
            <label
                for="dependency-name"
                class="block text-sm font-medium text-slate-700 mb-1"
                >Nombre de la Dependencia</label
            >
            <Input
                id="dependency-name"
                placeholder="Ej. Dirección General"
                bind:value={dependencyName}
            />
        </div>
    </div>
    {#snippet footer()}
        <Button
            variant="secondary"
            onclick={() => (isDependencyModalOpen = false)}>Cancelar</Button
        >
        <Button variant="primary" onclick={saveDependency}
            >{editingId ? "Actualizar" : "Guardar"}</Button
        >
    {/snippet}
</Modal>

<!-- Add Special Access Modal -->
<Modal
    bind:isOpen={isAccessModalOpen}
    title={editingId ? "Editar Acceso Especial" : "Nuevo Acceso Especial"}
    description="Registra un nuevo punto de acceso especial."
>
    <div class="space-y-4">
        <div>
            <label
                for="access-name"
                class="block text-sm font-medium text-slate-700 mb-1"
                >Nombre del Acceso</label
            >
            <Input
                id="access-name"
                placeholder="Ej. Laboratorio de Redes"
                bind:value={accessName}
            />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isAccessModalOpen = false)}
            >Cancelar</Button
        >
        <Button variant="primary" onclick={saveAccess}
            >{editingId ? "Actualizar" : "Guardar"}</Button
        >
    {/snippet}
</Modal>

<!-- Add User Modal -->
<Modal
    bind:isOpen={isUserModalOpen}
    title={editingId ? "Editar Usuario" : "Nuevo Usuario"}
    description="Registra un nuevo usuario con acceso al sistema."
>
    <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label
                    for="user-name"
                    class="block text-sm font-medium text-slate-700 mb-1"
                    >Nombre</label
                >
                <Input
                    id="user-name"
                    placeholder="Ej. Juan Pérez"
                    bind:value={userName}
                />
            </div>
            <div>
                <label
                    for="user-email"
                    class="block text-sm font-medium text-slate-700 mb-1"
                    >Correo Electrónico</label
                >
                <Input
                    type="email"
                    id="user-email"
                    placeholder="ejemplo@nexa.com"
                    bind:value={userEmail}
                />
            </div>
        </div>
        <div>
            <label
                for="user-role"
                class="block text-sm font-medium text-slate-700 mb-1"
                >Rol de Acceso</label
            >
            <Select id="user-role" bind:value={userRole} placeholder="">
                <option value="viewer">Visor (Solo lectura)</option>
                <option value="operator">Operador (Gestión de datos)</option>
                <option value="admin">Administrador (Total)</option>
            </Select>
            <p class="text-[10px] text-slate-500 mt-2">
                <b>Visor:</b> Solo puede ver datos y crear tickets.<br />
                <b>Operador:</b> Puede gestionar personal y tarjetas, pero no
                completar tickets ni cambiar configuraciones.<br />
                <b>Admin:</b> Control total del sistema.
            </p>
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isUserModalOpen = false)}
            >Cancelar</Button
        >
        <Button variant="primary" onclick={saveUser}>Actualizar Permisos</Button
        >
    {/snippet}
</Modal>

<!-- Add Schedule Modal -->
<Modal
    bind:isOpen={isScheduleModalOpen}
    title={editingId ? "Editar Horario" : "Nuevo Horario"}
    description="Registra un nuevo esquema de días laborales."
>
    <div class="space-y-4">
        <div>
            <label
                for="schedule-name"
                class="block text-sm font-medium text-slate-700 mb-1"
                >Nombre del Horario</label
            >
            <Input
                id="schedule-name"
                placeholder="Ej. Medio Tiempo"
                bind:value={scheduleName}
            />
        </div>
        <div>
            <span class="block text-sm font-medium text-slate-700 mb-2"
                >Días Laborales</span
            >
            <div class="grid grid-cols-2 gap-2">
                {#each ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as day}
                    <label
                        class="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            checked={scheduleDays.includes(day)}
                            onchange={() => toggleDay(day)}
                        />
                        <span class="text-sm text-slate-700">{day}</span>
                    </label>
                {/each}
            </div>
        </div>
    </div>
    {#snippet footer()}
        <Button
            variant="secondary"
            onclick={() => (isScheduleModalOpen = false)}>Cancelar</Button
        >
        <Button variant="primary" onclick={saveSchedule}
            >{editingId ? "Actualizar" : "Guardar"}</Button
        >
    {/snippet}
</Modal>

<!-- Secure Delete Modal -->
<Modal
    bind:isOpen={isDeleteModalOpen}
    title="Eliminar Elemento"
    description={`Estas a punto de eliminar "${deleteTarget?.name}". Esta acción es irreversible.`}
    size="sm"
>
    <div class="space-y-4">
        <div class="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <div class="flex gap-3">
                <div class="mt-0.5 text-rose-600">
                    <Trash2 size={20} />
                </div>
                <div>
                    <h4 class="text-sm font-bold text-rose-900">
                        Confirmación requerida
                    </h4>
                    <p class="text-sm text-rose-800 mt-1">
                        Para confirmar, por favor escribe <strong
                            >{deleteTarget?.name}</strong
                        > en el campo de abajo.
                    </p>
                </div>
            </div>
        </div>
        <div>
            <label
                for="delete-confirmation"
                class="block text-sm font-medium text-slate-700 mb-1"
            >
                Confirmación
            </label>
            <Input
                id="delete-confirmation"
                placeholder={deleteTarget?.name}
                bind:value={deleteConfirmation}
                class="border-rose-300 focus:ring-rose-500"
            />
        </div>
    </div>

    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}
            >Cancelar</Button
        >
        <Button
            variant="danger"
            onclick={confirmDelete}
            disabled={deleteConfirmation !== deleteTarget?.name}
        >
            Eliminar permanentemente
        </Button>
    {/snippet}
</Modal>
