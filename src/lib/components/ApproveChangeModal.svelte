<script lang="ts">
    import { X, AlertTriangle, User, CheckCircle2 } from "lucide-svelte";
    import Button from "./Button.svelte";
    import Badge from "./Badge.svelte";
    import { ticketService } from "../services/data";
    import { personnelService } from "../services/personnel";
    import { toast } from "svelte-sonner";
    import { appState } from "../state.svelte";

    let { isOpen = $bindable(false), ticket, onClose } = $props();
    const currentUser = $derived(appState.userProfile);

    let isSubmitting = $state(false);
    let confirmMode = $state<"none" | "approve" | "reject">("none");

    // Reset confirm mode when closing
    $effect(() => {
        if (!isOpen) confirmMode = "none";
    });

    // Helper to format values for display
    function formatValue(key: string, value: any): string {
        if (value === null || value === undefined || value === "") return "—";
        if (Array.isArray(value)) {
            if (key === "tarjetas") {
                return (
                    value.map((c: any) => `${c.type} ${c.folio}`).join(", ") ||
                    "Ninguna"
                );
            }
            return value.join(", ");
        }
        if (typeof value === "object") {
            if (key === "horario") {
                return `${value.dias} (${value.entrada} - ${value.salida})`;
            }
            return JSON.stringify(value);
        }
        return String(value);
    }

    // Help mapping for fields
    const ignoredKeys = [
        "id",
        "status_raw",
        "buildingId",
        "dependencyId",
        "scheduleId",
    ];

    const formatKeyMap: Record<string, string> = {
        nombres: "Nombres",
        apellidos: "Apellidos",
        noEmpleado: "No. Empleado",
        areaEquipo: "Área/Equipo",
        puestoFuncion: "Puesto",
        dependency: "Dependencia",
        edificio: "Edificio",
        pisoBase: "Piso Base",
        pisosP2000: "Pisos Asignados P2000",
        pisosKone: "Pisos Asignados KONE",
        horario: "Horario",
        accesosEspeciales: "Accesos Especiales",
        tarjetas: "Tarjetas Asignadas",
        status: "Estatus",
    };

    function formatKey(key: string) {
        return formatKeyMap[key] || key;
    }

    async function handleApprove() {
        if (!ticket || isSubmitting) return;

        if (confirmMode !== "approve") {
            confirmMode = "approve";
            return;
        }

        isSubmitting = true;

        try {
            await personnelService.save(ticket.payload.modified);
            // Delete the ticket as requested by the user
            await ticketService.delete(ticket.id);
            toast.success("Cambios Aplicados", {
                description: `Los datos de ${ticket.personName} han sido actualizados con éxito.`,
            });
            confirmMode = "none";
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Error", {
                description: "No se pudieron aplicar los cambios.",
            });
        } finally {
            isSubmitting = false;
        }
    }

    async function handleReject() {
        if (!ticket || isSubmitting) return;

        if (confirmMode !== "reject") {
            confirmMode = "reject";
            return;
        }

        isSubmitting = true;

        try {
            // Delete the ticket as requested
            await ticketService.delete(ticket.id);
            toast.info("Cambios Rechazados", {
                description: "La solicitud de modificación ha sido descartada.",
            });
            confirmMode = "none";
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Error", {
                description: "No se pudo rechazar la solicitud.",
            });
        } finally {
            isSubmitting = false;
        }
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300"
        role="dialog"
        aria-modal="true"
    >
        <div
            class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
        >
            <!-- Header -->
            <div
                class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"
                    >
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">
                            Aprobar Modificación
                        </h2>
                        <p class="text-sm text-slate-500 mt-0.5">
                            Revisa los cambios solicitados antes de aplicar
                        </p>
                    </div>
                </div>
                <button
                    onclick={onClose}
                    class="p-2 hover:bg-slate-200/50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 overflow-y-auto space-y-6">
                <!-- Ticket Info -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3
                                class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
                            >
                                Solicitud
                            </h3>
                            <p class="font-medium text-slate-900 mb-1">
                                {ticket?.title}
                            </p>
                            <p class="text-sm text-slate-600">
                                {ticket?.description}
                            </p>
                        </div>
                        <div
                            class="bg-white px-3 py-2 rounded-lg border border-slate-200 text-right"
                        >
                            <div
                                class="flex items-center gap-2 text-xs text-slate-500 justify-end"
                            >
                                <User size={14} />
                                <span>Solicitado para:</span>
                            </div>
                            <span
                                class="font-bold text-slate-700 block text-sm"
                            >
                                {ticket?.personName}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Comparison View -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                    <!-- Vertical Divider (Desktop Only) -->
                    <div
                        class="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-slate-200 -translate-x-1/2"
                    ></div>

                    <!-- Column Header: Original -->
                    <div class="flex flex-col gap-4">
                        <div
                            class="flex items-center gap-2 pb-2 border-b border-slate-100"
                        >
                            <span
                                class="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase"
                                >Original</span
                            >
                            <h4
                                class="font-bold text-slate-400 uppercase tracking-widest text-xs"
                            >
                                Datos Actuales
                            </h4>
                        </div>

                        <div class="space-y-4">
                            {#each Object.keys(formatKeyMap).filter((k) => !ignoredKeys.includes(k)) as key}
                                <div class="group">
                                    <span
                                        class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block"
                                        >{formatKey(key)}</span
                                    >
                                    <div
                                        class="p-3 rounded-xl border border-slate-100 bg-slate-50/30 text-sm text-slate-500"
                                    >
                                        {formatValue(
                                            key,
                                            ticket?.payload?.original?.[key],
                                        )}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- Column Header: Modified -->
                    <div class="flex flex-col gap-4">
                        <div
                            class="flex items-center gap-2 pb-2 border-b border-slate-100"
                        >
                            <span
                                class="px-2 py-1 rounded bg-emerald-100 text-[10px] font-bold text-emerald-600 uppercase"
                                >Modificado</span
                            >
                            <h4
                                class="font-bold text-slate-900 uppercase tracking-widest text-xs"
                            >
                                Propuesta de Cambio
                            </h4>
                        </div>

                        <div class="space-y-4">
                            {#each Object.keys(formatKeyMap).filter((k) => !ignoredKeys.includes(k)) as key}
                                {@const isChanged =
                                    JSON.stringify(
                                        ticket?.payload?.original?.[key],
                                    ) !==
                                    JSON.stringify(
                                        ticket?.payload?.modified?.[key],
                                    )}
                                <div class="group">
                                    <span
                                        class="text-[10px] font-bold {isChanged
                                            ? 'text-emerald-600'
                                            : 'text-slate-400'} uppercase tracking-wider mb-1 block"
                                    >
                                        {formatKey(key)}
                                        {#if isChanged}
                                            <Badge
                                                variant="amber"
                                                class="ml-2 text-[8px] px-1 py-0 h-4 border-amber-200 bg-amber-50 text-amber-700"
                                                >MODIFICADO</Badge
                                            >
                                        {/if}
                                    </span>
                                    <div
                                        class="p-3 rounded-xl border transition-all duration-200 {isChanged
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-medium shadow-sm ring-2 ring-emerald-500/5'
                                            : 'border-slate-100 bg-slate-50/30 text-slate-500'} text-sm"
                                    >
                                        {formatValue(
                                            key,
                                            ticket?.payload?.modified?.[key],
                                        )}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div
                class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4"
            >
                <div>
                    {#if confirmMode === "approve"}
                        <div
                            class="flex items-center gap-2 text-emerald-600 animate-in fade-in slide-in-from-left-2"
                        >
                            <CheckCircle2 size={16} />
                            <span class="text-sm font-bold"
                                >¿Confirmas aplicar estos cambios
                                definitivamente?</span
                            >
                        </div>
                    {:else if confirmMode === "reject"}
                        <div
                            class="flex items-center gap-2 text-rose-600 animate-in fade-in slide-in-from-left-2"
                        >
                            <AlertTriangle size={16} />
                            <span class="text-sm font-bold"
                                >¿Estás seguro de descartar esta solicitud?</span
                            >
                        </div>
                    {/if}
                </div>

                <div class="flex gap-3 w-full sm:w-auto">
                    {#if confirmMode !== "none"}
                        <Button
                            variant="secondary"
                            onclick={() => (confirmMode = "none")}
                            disabled={isSubmitting}
                            class="flex-1 sm:flex-none"
                        >
                            Cancelar
                        </Button>
                    {/if}

                    {#if confirmMode !== "approve"}
                        <Button
                            variant="secondary"
                            onclick={handleReject}
                            loading={isSubmitting && confirmMode === "reject"}
                            disabled={isSubmitting ||
                                currentUser?.role !== "admin"}
                            class="border-red-200 text-red-700 hover:bg-red-50 flex-1 sm:flex-none"
                        >
                            {currentUser?.role !== "admin"
                                ? "Solo Admins"
                                : confirmMode === "reject"
                                  ? "Sí, Rechazar"
                                  : "Rechazar Cambios"}
                        </Button>
                    {/if}

                    {#if confirmMode !== "reject"}
                        <Button
                            variant="primary"
                            onclick={handleApprove}
                            loading={isSubmitting && confirmMode === "approve"}
                            disabled={isSubmitting ||
                                currentUser?.role !== "admin"}
                            class="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20 flex-1 sm:flex-none"
                        >
                            {currentUser?.role !== "admin"
                                ? "Solo Admins"
                                : confirmMode === "approve"
                                  ? "Sí, Confirmar"
                                  : "Confirmar y Aplicar"}
                        </Button>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}
