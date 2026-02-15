<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import Input from "../Input.svelte";
    import ToggleGroup from "../ToggleGroup.svelte";
    import AddCardModal from "./AddCardModal.svelte";
    import Select from "../Select.svelte";
    import { Plus, CreditCard, Trash2 } from "lucide-svelte";
    import { untrack } from "svelte";

    import { personnelService, ticketService } from "../../services";
    import { personnelState, catalogState } from "../../stores";
    import { toast } from "svelte-sonner";
    import type { Person } from "../../types";

    let {
        isOpen = $bindable(false),
        editingPerson = null,
        onclose,
    }: {
        isOpen: boolean;
        editingPerson?: Person | null;
        onclose?: () => void;
    } = $props();

    // Catalogs
    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let schedules = $derived(catalogState.schedules);
    let specialAccesses = $derived(catalogState.specialAccesses);
    let availableCards = $derived(personnelState.extraCards);

    // Form state
    let nombres = $state("");
    let apellidos = $state("");
    let noEmpleado = $state("");
    let dependency = $state("");
    let areaEquipo = $state("");
    let puestoFuncion = $state("");
    let edificio = $state("");
    let pisoBase = $state("");
    let pisosP2000 = $state<string[]>([]);
    let pisosKone = $state<string[]>([]);
    let diasHorario = $state("");
    let horaEntrada = $state("08:00");
    let horaSalida = $state("17:00");
    let email = $state("");
    let accesosEspeciales = $state<string[]>([]);
    let tarjetasAsignadas = $state<{ type: string; folio: string }[]>([]);

    // Nested modal state
    let isCardModalOpen = $state(false);
    let isSubmitting = $state(false);

    // Derived floors based on selected building
    let availableFloors = $derived.by(() => {
        const b = buildings.find((b) => b.name === edificio);
        return b?.floors || [];
    });

    // When building changes, reset floor selections
    $effect(() => {
        if (edificio && !editingPerson) {
            // Only reset if not loading initial data
            pisoBase = "";
            pisosP2000 = [];
            pisosKone = [];
        }
    });

    // Auto-assign base floor to both access systems
    let lastAutoAddedBase = $state("");
    $effect(() => {
        if (pisoBase) {
            // Remove previous auto-added floor if it changed
            if (lastAutoAddedBase && lastAutoAddedBase !== pisoBase) {
                pisosP2000 = pisosP2000.filter((f) => f !== lastAutoAddedBase);
                pisosKone = pisosKone.filter((f) => f !== lastAutoAddedBase);
            }

            if (!pisosP2000.includes(pisoBase)) {
                pisosP2000 = [...pisosP2000, pisoBase];
            }
            if (!pisosKone.includes(pisoBase)) {
                pisosKone = [...pisosKone, pisoBase];
            }

            lastAutoAddedBase = pisoBase;
        }
    });

    // Populate form
    let lastLoadedPersonId = $state("");

    $effect(() => {
        if (
            isOpen &&
            editingPerson &&
            lastLoadedPersonId !== editingPerson.id
        ) {
            untrack(() => {
                nombres = editingPerson.first_name || "";
                apellidos = editingPerson.last_name || "";
                noEmpleado = editingPerson.employee_no;
                dependency = editingPerson.dependency;
                areaEquipo = (editingPerson as any).area || "";
                puestoFuncion = (editingPerson as any).position || "";
                edificio = editingPerson.building;
                pisoBase = editingPerson.floor || "";
                lastAutoAddedBase = pisoBase;
                pisosP2000 = [...(editingPerson.floors_p2000 || [])];
                pisosKone = [...(editingPerson.floors_kone || [])];

                if (editingPerson.schedule) {
                    diasHorario = editingPerson.schedule.days;
                    horaEntrada = editingPerson.schedule.entry;
                    horaSalida = editingPerson.schedule.exit;
                }

                email = editingPerson.email || "";
                accesosEspeciales = [...(editingPerson.specialAccesses || [])];
                tarjetasAsignadas = [...(editingPerson.cards || [])];
                lastLoadedPersonId = editingPerson.id;
            });
        } else if (isOpen && !editingPerson && lastLoadedPersonId !== "new") {
            resetForm();
            lastLoadedPersonId = "new";
        } else if (!isOpen) {
            lastLoadedPersonId = "";
        }
    });

    function addCard(card: { type: string; folio: string }) {
        tarjetasAsignadas = [...tarjetasAsignadas, card];
    }

    function removeCard(index: number) {
        tarjetasAsignadas = tarjetasAsignadas.filter((_, i) => i !== index);
    }

    async function handleSave() {
        if (isSubmitting) return;
        isSubmitting = true;

        try {
            const data = {
                id: editingPerson?.id,
                nombres,
                apellidos,
                noEmpleado,
                areaEquipo,
                puestoFuncion,
                dependency,
                dependency_id: dependencies.find((d) => d.name === dependency)
                    ?.id,
                edificio,
                building_id: buildings.find((b) => b.name === edificio)?.id,
                pisoBase,
                pisosP2000,
                pisosKone,
                first_name: nombres,
                last_name: apellidos,
                employee_no: noEmpleado,
                email,
                floor: pisoBase,
                floors_p2000: pisosP2000,
                floors_kone: pisosKone,
                schedule_id: schedules.find((s) => s.name === diasHorario)?.id,
                entry_time: horaEntrada,
                exit_time: horaSalida,
                cards: tarjetasAsignadas,
                specialAccesses: accesosEspeciales,
            };

            if (editingPerson) {
                const normalizedOriginal = {
                    id: editingPerson.id,
                    nombres: editingPerson.first_name,
                    apellidos: editingPerson.last_name,
                    noEmpleado: editingPerson.employee_no,
                    dependency: editingPerson.dependency,
                    edificio: editingPerson.building,
                    pisosP2000: editingPerson.floors_p2000,
                    pisosKone: editingPerson.floors_kone,
                    horario: editingPerson.schedule,
                    accesosEspeciales: editingPerson.specialAccesses,
                    tarjetas: editingPerson.cards,
                    email: editingPerson.email,
                    floor: editingPerson.floor,
                };

                const ticketPayload = {
                    original: normalizedOriginal,
                    modified: data,
                };
                await ticketService.create({
                    title: "Modificación de Datos Personales",
                    description: `Solicitud de cambio de datos para ${nombres} ${apellidos} (${noEmpleado})`,
                    type: "Modificación de datos",
                    priority: "media",
                    person_id: editingPerson.id,
                    payload: ticketPayload,
                });

                toast.success("Solicitud Enviada", {
                    description: "Los cambios se han enviado a aprobación.",
                });
            } else {
                await personnelService.save(data);
                const updated = await personnelService.fetchAll();
                personnelState.setPersonnel(updated);
                toast.success("Personal Registrado");
            }

            resetAndClose();
        } catch (e) {
            console.error(e);
            toast.error("Error", {
                description: "Ocurrió un error al guardar.",
            });
        } finally {
            isSubmitting = false;
        }
    }

    function resetForm() {
        nombres = "";
        apellidos = "";
        noEmpleado = "";
        dependency = "";
        areaEquipo = "";
        puestoFuncion = "";
        edificio = "";
        pisoBase = "";
        pisosP2000 = [];
        pisosKone = [];
        diasHorario = "";
        horaEntrada = "08:00";
        horaSalida = "17:00";
        email = "";
        accesosEspeciales = [];
        tarjetasAsignadas = [];
        lastAutoAddedBase = "";
    }

    function resetAndClose() {
        resetForm();
        if (onclose) {
            onclose();
        } else {
            isOpen = false;
        }
    }
</script>

<Modal
    bind:isOpen
    title={editingPerson ? "Editar Personal" : "Nueva Alta de Personal"}
    description={editingPerson
        ? "Modifique los datos requeridos. Se generará un ticket."
        : "Complete la información para registrar una nueva persona."}
    size="xl"
    onclose={resetAndClose}
>
    <form
        class="space-y-8"
        onsubmit={(e) => {
            e.preventDefault();
            handleSave();
        }}
    >
        <!-- SECTION: Personal Info -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Datos Personales</legend
            >

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="nombres"
                        class="text-xs font-bold text-slate-600 block"
                        >Nombres</label
                    >
                    <Input
                        id="nombres"
                        bind:value={nombres}
                        placeholder="Juan Carlos"
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="apellidos"
                        class="text-xs font-bold text-slate-600 block"
                        >Apellidos</label
                    >
                    <Input
                        id="apellidos"
                        bind:value={apellidos}
                        placeholder="Pérez García"
                    />
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
                <div class="space-y-1.5">
                    <label
                        for="noEmpleado"
                        class="text-xs font-bold text-slate-600 block"
                        >No. Empleado</label
                    >
                    <Input
                        id="noEmpleado"
                        bind:value={noEmpleado}
                        placeholder="EMP-001"
                    />
                </div>
                <div class="md:col-span-2 space-y-1.5">
                    <label
                        for="dependencia"
                        class="text-xs font-bold text-slate-600 block"
                        >Dependencia</label
                    >
                    <Select id="dependencia" bind:value={dependency}>
                        {#each dependencies as dep}
                            <option value={dep.name}>{dep.name}</option>
                        {/each}
                    </Select>
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="area"
                        class="text-xs font-bold text-slate-600 block"
                        >Área / Equipo</label
                    >
                    <Input
                        id="area"
                        bind:value={areaEquipo}
                        placeholder="Sistemas"
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="puesto"
                        class="text-xs font-bold text-slate-600 block"
                        >Puesto / Función</label
                    >
                    <Input
                        id="puesto"
                        bind:value={puestoFuncion}
                        placeholder="Analista"
                    />
                </div>
            </div>

            <div class="space-y-1.5 pt-2">
                <label
                    for="email"
                    class="text-xs font-bold text-slate-600 block"
                    >Correo Electrónico</label
                >
                <Input
                    id="email"
                    type="email"
                    bind:value={email}
                    placeholder="correo@ejemplo.com"
                />
            </div>
        </fieldset>

        <!-- SECTION: Location -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Ubicación</legend
            >

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="edificio"
                        class="text-xs font-bold text-slate-600 block"
                        >Edificio</label
                    >
                    <Select id="edificio" bind:value={edificio}>
                        {#each buildings as b}
                            <option value={b.name}>{b.name}</option>
                        {/each}
                    </Select>
                </div>
                <div class="space-y-1.5">
                    <label
                        for="pisoBase"
                        class="text-xs font-bold text-slate-600 block"
                        >Piso Base</label
                    >
                    <Select
                        id="pisoBase"
                        bind:value={pisoBase}
                        disabled={!edificio}
                    >
                        {#each availableFloors as f}
                            <option value={f}>{f}</option>
                        {/each}
                    </Select>
                </div>
            </div>

            {#if edificio}
                <div class="space-y-4">
                    <ToggleGroup
                        label="Pisos Asignados P2000 (Puertas)"
                        options={availableFloors}
                        bind:value={pisosP2000}
                    />
                    <ToggleGroup
                        label="Pisos Asignados KONE (Elevadores)"
                        options={availableFloors}
                        bind:value={pisosKone}
                    />
                </div>
            {/if}
        </fieldset>

        <!-- SECTION: Schedule -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Horario</legend
            >
            <div class="space-y-1.5">
                <label for="dias" class="text-xs font-bold text-slate-600 block"
                    >Días</label
                >
                <Select id="dias" bind:value={diasHorario}>
                    {#each schedules as s}
                        <option value={s.name}>{s.name}</option>
                    {/each}
                </Select>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="entrada"
                        class="text-xs font-bold text-slate-600 block"
                        >Entrada</label
                    >
                    <Input id="entrada" type="time" bind:value={horaEntrada} />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="salida"
                        class="text-xs font-bold text-slate-600 block"
                        >Salida</label
                    >
                    <Input id="salida" type="time" bind:value={horaSalida} />
                </div>
            </div>
        </fieldset>

        <!-- SECTION: Special Access -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Accesos Especiales</legend
            >
            <ToggleGroup
                label=""
                options={specialAccesses.map((a) => a.name)}
                bind:value={accesosEspeciales}
            />
        </fieldset>

        <!-- SECTION: Cards -->
        {#if !editingPerson}
            <fieldset
                class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            >
                <legend
                    class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                    >Gestión de Tarjetas</legend
                >

                {#if tarjetasAsignadas.length > 0}
                    <div class="space-y-2">
                        {#each tarjetasAsignadas as card, index}
                            <div
                                class="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                            >
                                <div class="flex items-center gap-3">
                                    <CreditCard
                                        size={18}
                                        class="text-slate-400"
                                    />
                                    <Badge
                                        variant={card.type === "KONE"
                                            ? "blue"
                                            : "amber"}>{card.type}</Badge
                                    >
                                    <span
                                        class="text-sm font-bold text-slate-700"
                                        >{card.folio}</span
                                    >
                                </div>
                                <button
                                    type="button"
                                    class="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                    onclick={() => removeCard(index)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}

                <Button
                    type="button"
                    variant="outline"
                    class="w-full"
                    onclick={() => (isCardModalOpen = true)}
                >
                    <Plus size={16} />
                    Asignar Tarjeta Inicial
                </Button>
            </fieldset>
        {/if}
    </form>

    {#snippet footer()}
        <Button variant="ghost" onclick={resetAndClose}>Cancelar</Button>
        <Button variant="primary" onclick={handleSave} loading={isSubmitting}
            >{editingPerson ? "Actualizar (Ticket)" : "Guardar Alta"}</Button
        >
    {/snippet}
</Modal>

<AddCardModal bind:isOpen={isCardModalOpen} onSave={addCard} />
