<script lang="ts" module>
    export function getStatusVariant(priority: string) {
        if (priority === "Alta") return "rose";
        if (priority === "Media") return "amber";
        return "blue";
    }
</script>

<script lang="ts">
    import Badge from "./Badge.svelte";
    import Button from "./Button.svelte";
    import {
        Clock,
        CreditCard,
        FileSignature,
        Wallet,
        AlertCircle,
        CheckCircle2,
        Briefcase,
        Lock,
        ArrowRight,
        Calendar,
    } from "lucide-svelte";

    type Ticket = {
        id: number | string;
        title: string;
        description: string;
        type: string;
        personName: string;
        cardType?: string;
        cardFolio?: string;
        priority: string;
        status: string;
        created_at?: string;
    };

    type Props = {
        ticket: Ticket;
        onManage?: (ticket: Ticket) => void;
        onComplete?: (ticket: Ticket) => void;
    };

    let { ticket, onManage, onComplete }: Props = $props();

    const iconMap: Record<string, any> = {
        Programación: CreditCard,
        "Firma Responsiva": FileSignature,
        Cobro: Wallet,
        Bloqueo: Lock,
        Otro: Briefcase,
    };

    const priorityColor = {
        Alta: "rose",
        Media: "amber",
        Baja: "blue",
    };

    const typeStyles: Record<string, string> = {
        Programación: "bg-white border-slate-200",
        "Firma Responsiva": "bg-white border-slate-200",
        Cobro: "bg-white border-slate-200",
        Bloqueo: "bg-white border-slate-200",
        Otro: "bg-white border-slate-200",
    };

    const iconStyles: Record<string, string> = {
        Programación: "bg-blue-50/50 text-blue-600 border-blue-100/50",
        "Firma Responsiva":
            "bg-indigo-50/50 text-indigo-600 border-indigo-100/50",
        Cobro: "bg-emerald-50/50 text-emerald-600 border-emerald-100/50",
        Bloqueo: "bg-rose-50/50 text-rose-600 border-rose-100/50",
        Otro: "bg-slate-50/50 text-slate-600 border-slate-100/50",
    };

    function formatDate(dateStr?: string) {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

<article
    class="group relative rounded-xl border bg-white p-3.5 transition-all duration-200 hover:shadow-md border-slate-200 shadow-sm"
>
    <!-- Accent Line (optional, but adds a nice touch without being too much) -->
    <div
        class="absolute inset-y-0 left-0 w-1.5 rounded-l-xl {ticket.type ===
        'Programación'
            ? 'bg-blue-600'
            : ticket.type === 'Firma Responsiva'
              ? 'bg-indigo-600'
              : ticket.type === 'Cobro'
                ? 'bg-emerald-600'
                : ticket.type === 'Bloqueo'
                  ? 'bg-rose-600'
                  : 'bg-slate-400'} opacity-0 group-hover:opacity-100 transition-opacity"
    ></div>

    <div class="relative flex flex-col md:flex-row md:items-center gap-4">
        <!-- Icon Section -->
        <div class="flex items-center gap-3.5 min-w-[160px]">
            <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border {iconStyles[
                    ticket.type
                ] || iconStyles['Otro']} shadow-sm"
            >
                {#if iconMap[ticket.type]}
                    {@const Icon = iconMap[ticket.type]}
                    <Icon size={20} strokeWidth={2.5} />
                {:else}
                    <Briefcase size={20} strokeWidth={2.5} />
                {/if}
            </div>

            <div class="min-w-0">
                <span
                    class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5"
                >
                    {ticket.type}
                </span>
                <h3
                    class="text-sm font-bold text-slate-900 leading-tight truncate"
                >
                    {ticket.title}
                </h3>
            </div>
        </div>

        <!-- Content Section -->
        <div class="flex-1 min-w-0">
            <p class="text-[13px] font-medium text-slate-500 line-clamp-1 mb-2">
                {ticket.description}
            </p>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <!-- Beneficiary -->
                <div class="flex items-center gap-1.5">
                    <div
                        class="h-5 w-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400"
                    >
                        <Clock size={10} />
                    </div>
                    <span class="text-xs font-semibold text-slate-700"
                        >{ticket.personName}</span
                    >
                </div>

                <!-- Technical Details -->
                {#if ticket.cardFolio}
                    <div
                        class="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100"
                    >
                        <CreditCard size={10} class="text-slate-400" />
                        <span class="text-[10px] font-bold text-slate-500">
                            {ticket.cardType} ·
                            <span class="text-slate-700"
                                >{ticket.cardFolio}</span
                            >
                        </span>
                    </div>
                {/if}

                <!-- Time -->
                {#if ticket.created_at}
                    <div class="flex items-center gap-1.5 text-slate-400">
                        <Calendar size={10} />
                        <span class="text-[10px] font-bold"
                            >{formatDate(ticket.created_at)}</span
                        >
                    </div>
                {/if}
            </div>
        </div>

        <!-- Priority & Actions -->
        <div
            class="flex flex-row md:items-center justify-between md:justify-end gap-3 min-w-fit border-t md:border-t-0 border-slate-50 pt-3 md:pt-0"
        >
            <Badge
                variant={getStatusVariant(ticket.priority)}
                class="px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-tight"
            >
                {ticket.priority}
            </Badge>

            {#if ticket.type === "Programación" || ticket.type === "Firma Responsiva"}
                <Button
                    variant="soft-emerald"
                    size="sm"
                    class="h-9 px-4 rounded-xl active:scale-95"
                    onclick={() => onComplete?.(ticket)}
                >
                    <CheckCircle2 size={15} strokeWidth={2.5} class="mr-2" />
                    Completar
                </Button>
            {:else}
                <Button
                    variant="soft-slate"
                    size="sm"
                    class="h-9 px-4 rounded-xl active:scale-95"
                    onclick={() => onManage?.(ticket)}
                >
                    Gestionar
                    <ArrowRight
                        size={15}
                        strokeWidth={2.5}
                        class="ml-2 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                    />
                </Button>
            {/if}
        </div>
    </div>
</article>
