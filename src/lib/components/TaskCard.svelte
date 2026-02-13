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
    } from "lucide-svelte";

    type Ticket = {
        id: number | string;
        title: string;
        description: string;
        type:
            | "Programación"
            | "Firma Responsiva"
            | "Cobro"
            | "Bloqueo"
            | "Otro";
        personName: string;
        cardType?: "P2000" | "KONE";
        cardFolio?: string;
        priority: "Alta" | "Media" | "Baja";
        status: "Pendiente" | "En Proceso" | "Completado";
    };

    type Props = {
        ticket: Ticket;
        onManage?: (ticket: Ticket) => void;
    };

    let { ticket, onManage }: Props = $props();

    const iconMap = {
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

    const typeStyles = {
        Programación: "bg-blue-50/50 border-blue-200 hover:border-blue-300",
        "Firma Responsiva":
            "bg-violet-50/50 border-violet-200 hover:border-violet-300",
        Cobro: "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300",
        Bloqueo: "bg-rose-50/50 border-rose-200 hover:border-rose-300",
        Otro: "bg-slate-50/50 border-slate-200 hover:border-slate-300",
    };

    const iconStyles = {
        Programación: "bg-blue-100 text-blue-600 border-blue-200",
        "Firma Responsiva": "bg-violet-100 text-violet-600 border-violet-200",
        Cobro: "bg-emerald-100 text-emerald-600 border-emerald-200",
        Bloqueo: "bg-rose-100 text-rose-600 border-rose-200",
        Otro: "bg-slate-100 text-slate-600 border-slate-200",
    };
</script>

<article
    class="rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex flex-col h-full {typeStyles[
        ticket.type
    ] || typeStyles['Otro']}"
>
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
            <div
                class="p-2.5 rounded-xl border {iconStyles[ticket.type] ||
                    iconStyles['Otro']}"
            >
                {#if iconMap[ticket.type]}
                    {@const Icon = iconMap[ticket.type]}
                    <Icon size={20} />
                {:else}
                    <Briefcase size={20} />
                {/if}
            </div>
            <div>
                <h3 class="font-bold text-slate-900 leading-tight">
                    {ticket.title}
                </h3>
                <span class="text-xs font-medium text-slate-500"
                    >{ticket.type}</span
                >
            </div>
        </div>
        <Badge
            variant={(priorityColor[ticket.priority] as
                | "rose"
                | "amber"
                | "blue"
                | "slate") || "slate"}
        >
            {ticket.priority}
        </Badge>
    </div>

    <!-- Description -->
    <p class="text-sm text-slate-600 mb-4 flex-1">
        {ticket.description}
    </p>

    <!-- Details -->
    <div class="space-y-3 mb-5">
        <!-- Person -->
        <div class="flex flex-col">
            <span
                class="text-xs font-bold text-slate-400 uppercase tracking-wide"
            >
                Para
            </span>
            <span class="text-sm font-semibold text-slate-800"
                >{ticket.personName}</span
            >
        </div>

        <!-- Card Info (if applicable) -->
        {#if ticket.cardFolio}
            <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
                <CreditCard size={14} class="text-slate-400" />
                <span class="text-xs font-medium text-slate-500">
                    {ticket.cardType} -
                    <span class="text-slate-700 font-bold"
                        >{ticket.cardFolio}</span
                    >
                </span>
            </div>
        {/if}
    </div>

    <!-- Action -->
    <div class="mt-auto pt-4 border-t border-slate-100">
        <Button
            variant="secondary"
            class="w-full justify-between group"
            onclick={() => onManage?.(ticket)}
        >
            <span class="font-semibold">Gestionar Ticket</span>
            <div
                class="bg-slate-200 rounded-full p-0.5 group-hover:bg-slate-300 transition-colors"
            >
                <CheckCircle2 size={14} />
            </div>
        </Button>
    </div>
</article>
