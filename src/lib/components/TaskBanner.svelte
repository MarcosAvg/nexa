<script lang="ts" module>
    export function getStatusVariant(
        priority: string,
    ): "rose" | "amber" | "blue" | "slate" {
        const p = priority?.toLowerCase();
        if (p === "urgente") return "rose";
        if (p === "alta") return "rose";
        if (p === "media") return "amber";
        if (p === "baja") return "blue";
        return "slate";
    }
</script>

<script lang="ts">
    import Badge from "./Badge.svelte";
    import Button from "./Button.svelte";
    import PermissionGuard from "./PermissionGuard.svelte";
    import {
        Clock,
        CreditCard,
        FileSignature,
        Wallet,
        Lock,
        ArrowRight,
        Calendar,
        User,
        Hash,
        CheckCircle2,
        MoreHorizontal,
        AlertCircle,
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
        payload?: any;
    };

    let {
        ticket,
        onManage,
        onComplete,
    }: {
        ticket: Ticket;
        onManage?: (ticket: Ticket) => void;
        onComplete?: (ticket: Ticket) => void;
    } = $props();

    const typeConfig: Record<
        string,
        {
            icon: any;
            color: string;
            bg: string;
            border: string;
            cardBg: string;
            cardBorder: string;
        }
    > = {
        Programación: {
            icon: CreditCard,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
            cardBg: "bg-blue-50/60",
            cardBorder: "border-blue-200/60",
        },
        "Firma Responsiva": {
            icon: FileSignature,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            border: "border-indigo-100",
            cardBg: "bg-indigo-50/60",
            cardBorder: "border-indigo-200/60",
        },
        "Alta de Persona": {
            icon: User,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100",
            cardBg: "bg-emerald-50/60",
            cardBorder: "border-emerald-200/60",
        },
        "Baja de Persona": {
            icon: Lock,
            color: "text-rose-600",
            bg: "bg-rose-50",
            border: "border-rose-100",
            cardBg: "bg-rose-50/60",
            cardBorder: "border-rose-200/60",
        },
        "Modificación de datos": {
            icon: ArrowRight,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
            cardBg: "bg-amber-50/60",
            cardBorder: "border-amber-200/60",
        },
        Modificación: {
            icon: ArrowRight,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
            cardBg: "bg-amber-50/60",
            cardBorder: "border-amber-200/60",
        },
        Reposición: {
            icon: CreditCard,
            color: "text-sky-600",
            bg: "bg-sky-50",
            border: "border-sky-100",
            cardBg: "bg-sky-50/60",
            cardBorder: "border-sky-200/60",
        },
        "Reporte de Fallo": {
            icon: AlertCircle,
            color: "text-orange-600",
            bg: "bg-orange-50",
            border: "border-orange-100",
            cardBg: "bg-orange-50/60",
            cardBorder: "border-orange-200/60",
        },
        "Reporte de Falla": {
            icon: AlertCircle,
            color: "text-orange-600",
            bg: "bg-orange-50",
            border: "border-orange-100",
            cardBg: "bg-orange-50/60",
            cardBorder: "border-orange-200/60",
        },
        Default: {
            icon: MoreHorizontal,
            color: "text-slate-600",
            bg: "bg-slate-50",
            border: "border-slate-100",
            cardBg: "bg-slate-50/60",
            cardBorder: "border-slate-200/60",
        },
    };

    const config = $derived(typeConfig[ticket.type] || typeConfig["Default"]);

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

    const priorityColor = $derived(getStatusVariant(ticket.priority));
</script>

<article
    class="group relative flex flex-col h-full {config.cardBg} rounded-2xl border {config.cardBorder} overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1"
>
    <!-- Header: Type Icon & Priority -->
    <div class="p-4 flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
            <div
                class="flex h-11 w-11 items-center justify-center rounded-xl border-2 {config.bg} {config.border} {config.color} shadow-sm transition-transform duration-300 group-hover:scale-110"
            >
                {#if true}
                    {@const Icon = config.icon}
                    <Icon size={22} strokeWidth={2.5} />
                {/if}
            </div>
            <div class="min-w-0">
                <p
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1"
                >
                    {ticket.type}
                </p>
                <div class="flex items-center gap-1.5 text-slate-300">
                    <Hash size={10} />
                    <span class="text-[10px] font-bold"
                        >Ticket #{String(ticket.id)
                            .slice(-6)
                            .toUpperCase()}</span
                    >
                </div>
            </div>
        </div>

        <Badge
            variant={priorityColor}
            class="px-2 py-0.5 text-[9px] uppercase font-black tracking-tight rounded-lg shadow-sm"
        >
            {ticket.priority}
        </Badge>
    </div>

    <!-- Body: Title & Description -->
    <div class="px-4 pb-2 flex-1">
        <h3
            class="text-sm font-bold text-slate-900 leading-snug mb-1.5 line-clamp-2 min-h-[2.5rem]"
        >
            {ticket.title}
        </h3>
        <p class="text-xs font-medium text-slate-500 line-clamp-2 min-h-[2rem]">
            {ticket.description}
        </p>
    </div>

    <!-- Metadata Section -->
    <div class="px-4 pb-4 space-y-3">
        <!-- Main Person Label -->
        <div
            class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100/60"
        >
            <div
                class="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm shrink-0"
            >
                <User size={14} />
            </div>
            <div class="min-w-0 overflow-hidden">
                <p
                    class="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5"
                >
                    Solicitante / Beneficiario
                </p>
                <p class="text-xs font-bold text-slate-700 truncate">
                    {ticket.personName}
                </p>
            </div>
        </div>

        <!-- Secondary Meta (Date & Assets) -->
        <div
            class="flex items-center justify-between text-[10px] font-bold px-1"
        >
            <div class="flex items-center gap-1.5 text-slate-400">
                <Calendar size={12} />
                <span>{formatDate(ticket.created_at)}</span>
            </div>

            {#if ticket.cardFolio}
                <div
                    class="flex items-center gap-1.5 text-slate-600 bg-slate-100/60 px-2 py-0.5 rounded-md"
                >
                    <CreditCard size={12} />
                    <span>{ticket.cardType} · {ticket.cardFolio}</span>
                </div>
            {/if}
        </div>
    </div>

    <div class="p-3 bg-slate-50/50 border-t border-slate-100 flex gap-2">
        <PermissionGuard requireEdit disabledOnly>
            {#snippet children({ disabled })}
                {#if (ticket.type === "Programación" || ticket.type === "Firma Responsiva" || ticket.type === "Modificación" || ticket.type === "Modificación de datos") && onComplete}
                    <Button
                        variant="primary"
                        size="sm"
                        class="flex-1 shadow-md shadow-slate-200/50"
                        onclick={() => onComplete(ticket)}
                        {disabled}
                    >
                        <CheckCircle2 size={16} class="mr-2" />
                        Completar
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        class="w-10 p-0"
                        onclick={() => onManage?.(ticket)}
                        {disabled}
                    >
                        <MoreHorizontal size={18} class="text-slate-400" />
                    </Button>
                {:else}
                    <Button
                        variant="primary"
                        size="sm"
                        class="flex-1 shadow-lg shadow-slate-200/50"
                        onclick={() => onManage?.(ticket)}
                        {disabled}
                    >
                        Gestionar Ticket
                        <ArrowRight
                            size={16}
                            class="ml-2 group-hover:translate-x-1 transition-transform"
                        />
                    </Button>
                {/if}
            {/snippet}
        </PermissionGuard>
    </div>

    <!-- Background Decoration -->
    <div
        class="absolute -right-6 -top-6 w-24 h-24 {config.bg} opacity-[0.03] rounded-full blur-2xl group-hover:opacity-10 group-hover:scale-150 transition-all duration-700 pointer-events-none"
    ></div>
</article>
