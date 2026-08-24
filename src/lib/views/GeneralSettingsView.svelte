<script lang="ts">
    import { toast } from "svelte-sonner";
    import { settingsState } from "../stores";
    import { networkStore } from "../stores/network.svelte";
    import { handleError } from "../utils";
    import Button from "../components/Button.svelte";
    import Card from "../components/Card.svelte";
    import Input from "../components/Input.svelte";
    import { Save, RotateCcw, Building2, Mail, Phone, Coins } from "lucide-svelte";

    let orgName = $state(settingsState.orgName);
    let orgSupportEmail = $state(settingsState.orgSupportEmail);
    let orgSupportExtension = $state(settingsState.orgSupportExtension);
    let replacementCost = $state(settingsState.replacementCost);

    // Sincronizar inputs cuando cambia el store (ej. reset)
    $effect(() => {
        orgName = settingsState.orgName;
        orgSupportEmail = settingsState.orgSupportEmail;
        orgSupportExtension = settingsState.orgSupportExtension;
        replacementCost = settingsState.replacementCost;
    });

    async function handleSave() {
        if (!orgName.trim()) { toast.error("El nombre del sistema es requerido"); return; }
        try {
            await settingsState.setOrganization({
                orgName,
                orgSupportEmail,
                orgSupportExtension,
                replacementCost,
            });
            toast.success("Configuración general guardada");
        } catch (e) {
            handleError(e, "Guardar Configuración General");
        }
    }

    async function handleReset() {
        await settingsState.resetToDefaults();
        toast.success("Valores restablecidos");
    }
</script>

<div class="max-w-2xl">
    <div class="flex items-center gap-3 pb-4">
        <div class="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700">
            <Building2 size={16} strokeWidth={2.5} />
            <span class="text-[13px] font-extrabold">Configuración General</span>
        </div>
    </div>

    <Card class="p-8 bg-white border border-slate-200 rounded-[22px] shadow-sm space-y-8">
        <div class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <Building2 size={20} strokeWidth={2.5} />
            </div>
            <div>
                <h4 class="text-sm font-bold text-slate-800 mb-1">Identidad del sistema</h4>
                <p class="text-xs font-medium text-slate-500 leading-relaxed">
                    Estos valores se usan en las plantillas de solicitudes y en los documentos/exportaciones (nombre del sistema,
                    datos de contacto del área y monto de reposición).
                </p>
            </div>
        </div>

        <div class="space-y-5">
            <div>
                <label for="org-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre del sistema</label>
                <div class="flex items-center gap-2">
                    <Building2 size={16} class="text-slate-400 shrink-0" />
                    <Input id="org-name" placeholder="Ej. Nexa" bind:value={orgName} />
                </div>
                <p class="text-[11px] text-slate-400 mt-1">Se muestra en títulos y nombres de archivo de las exportaciones.</p>
            </div>

            <div>
                <label for="org-email" class="block text-sm font-medium text-slate-700 mb-1">Correo de contacto / envío</label>
                <div class="flex items-center gap-2">
                    <Mail size={16} class="text-slate-400 shrink-0" />
                    <Input id="org-email" type="email" placeholder="ej. acceso@dominio.gob.mx" bind:value={orgSupportEmail} />
                </div>
                <p class="text-[11px] text-slate-400 mt-1">Aparece en la hoja de instrucciones de la plantilla.</p>
            </div>

            <div>
                <label for="org-ext" class="block text-sm font-medium text-slate-700 mb-1">Extensión del área</label>
                <div class="flex items-center gap-2">
                    <Phone size={16} class="text-slate-400 shrink-0" />
                    <Input id="org-ext" placeholder="Ej. 32199" bind:value={orgSupportExtension} />
                </div>
            </div>

            <div>
                <label for="replacement-cost" class="block text-sm font-medium text-slate-700 mb-1">Monto de reposición</label>
                <div class="flex items-center gap-2">
                    <Coins size={16} class="text-slate-400 shrink-0" />
                    <Input id="replacement-cost" placeholder="Ej. $300.00 (Trescientos pesos 00/100 M.N.)" bind:value={replacementCost} />
                </div>
                <p class="text-[11px] text-slate-400 mt-1">Se inserta en los textos legales mediante el token {'{monto}'}.</p>
            </div>
        </div>

        <div class="flex items-center gap-3 border-t border-slate-100 pt-6">
            <Button
                variant="indigo"
                class="flex items-center gap-2 px-6 py-2.5 rounded-xl"
                onclick={handleSave}
                disabled={!networkStore.isOnline}
            >
                <Save size={16} strokeWidth={2.5} /> Guardar configuración
            </Button>
            <Button
                variant="secondary"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                onclick={handleReset}
            >
                <RotateCcw size={16} strokeWidth={2} /> Restablecer
            </Button>
        </div>
    </Card>
</div>
