<script lang="ts">
    /**
     * TicketReposicionDetail.svelte
     *
     * Displays folio validation checks for Reposición ticket type.
     */
    import { CreditCard, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-svelte";

    let {
        selectedPerson = null,
        p = {} as Record<string, string>,
        onGoToFirmaResponsiva = (card: any) => {},
    }: {
        selectedPerson: any | null;
        p: Record<string, string>;
        onGoToFirmaResponsiva: (card: any) => void;
    } = $props();

    type FolioCheck = { card: any; match: boolean; warning: boolean };

    let folioChecks = $derived.by((): FolioCheck[] => {
        if (!selectedPerson) return [];
        const cards: any[] = (selectedPerson.cards ?? []).filter(
            (c: any) => c.status === "active",
        );
        const wantsP2000 = ["sí", "si"].includes(
            (p.reponer_p2000 ?? "").toLowerCase(),
        );
        const wantsKONE = ["sí", "si"].includes(
            (p.reponer_kone ?? "").toLowerCase(),
        );

        const checks: FolioCheck[] = [];

        if (wantsP2000) {
            const folioSought = p.folio_p2000?.trim();
            const p2000Cards = cards.filter((c: any) => c.type === "P2000");
            if (p2000Cards.length === 0) {
                checks.push({
                    card: { type: "P2000", folio: folioSought ?? "—" },
                    match: false,
                    warning: true,
                });
            } else {
                for (const c of p2000Cards) {
                    const match = !folioSought || c.folio === folioSought;
                    checks.push({ card: c, match, warning: !match });
                }
            }
        }
        if (wantsKONE) {
            const folioSought = p.folio_kone?.trim();
            const koneCards = cards.filter((c: any) => c.type === "KONE");
            if (koneCards.length === 0) {
                checks.push({
                    card: { type: "KONE", folio: folioSought ?? "—" },
                    match: false,
                    warning: true,
                });
            } else {
                for (const c of koneCards) {
                    const match = !folioSought || c.folio === folioSought;
                    checks.push({ card: c, match, warning: !match });
                }
            }
        }

        return checks;
    });
</script>

<div class="space-y-2">
    {#each folioChecks as check}
        <div
            class="rounded-xl border {check.warning
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-white'} p-3 flex items-center gap-3"
        >
            <div
                class="w-8 h-8 rounded-full {check.warning
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-slate-100 text-slate-500'} flex items-center justify-center shrink-0"
            >
                <CreditCard size={16} />
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                    <span
                        class="text-[10px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded tracking-wider"
                    >{check.card.type}</span>
                    <span class="text-sm font-semibold text-slate-700 truncate">
                        {check.card.folio ?? "—"}
                    </span>
                </div>
                {#if check.warning}
                    <div class="text-xs text-amber-700 flex items-start gap-2 mt-1">
                        <AlertTriangle size={14} class="shrink-0 mt-0.5" />
                        <div class="leading-snug">
                            {#if !check.card.id}
                                No hay tarjeta {check.card.type} activa asignada.
                            {:else}
                                Folio en plantilla (<strong>
                                    {check.card.type === "P2000" ? p.folio_p2000 : p.folio_kone}
                                </strong>) no coincide con la tarjeta asignada
                                (<strong>{check.card.folio}</strong>). Verifique antes de continuar.
                            {/if}
                        </div>
                    </div>
                {:else}
                    <p class="text-xs text-emerald-600 flex items-center gap-1.5 mt-0.5 font-medium">
                        <CheckCircle2 size={13} /> Folio coincide correctamente.
                    </p>
                {/if}
            </div>
            {#if check.card.id}
                <button
                    class="text-xs text-blue-500 hover:underline font-medium shrink-0"
                    onclick={() => onGoToFirmaResponsiva(check.card)}
                >
                    Ir →
                </button>
            {/if}
        </div>
    {/each}
    {#if folioChecks.length === 0 && selectedPerson}
        <div
            class="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2"
        >
            <AlertCircle size={14} class="mt-0.5 shrink-0" />
            <span>
                No se identificaron tarjetas a reponer según el payload. Revise los campos "¿Reponer P2000/KONE?".
            </span>
        </div>
    {/if}
</div>
{#if folioChecks.length > 0}
    <p class="text-[10px] text-slate-400">
        Al hacer clic en "Ir →" se te llevará al perfil de la persona
        con la tarjeta preseleccionada para el flujo de Firma Responsiva.
    </p>
{/if}
