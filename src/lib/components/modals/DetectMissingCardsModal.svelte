<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { cardService } from "../../services/cards";
    import { HistoryService } from "../../services/history";
    import { exportMissingCardsToExcel } from "../../utils/xlsxExport";
    import { toast } from "svelte-sonner";
    import { FileSearch, AlertCircle } from "lucide-svelte";

    let { isOpen = $bindable(false) } = $props();

    let type = $state("KONE");
    let startRange = $state<number | null>(null);
    let endRange = $state<number | null>(null);
    let isProcessing = $state(false);

    async function handleDetect() {
        if (startRange === null || endRange === null) {
            toast.error("Por favor ingresa un rango válido");
            return;
        }

        if (startRange > endRange) {
            toast.error("El inicio no puede ser mayor al fin");
            return;
        }

        const count = endRange - startRange + 1;
        if (count > 5000) {
            toast.error("El rango es demasiado grande (máximo 5000)");
            return;
        }

        isProcessing = true;
        const toastId = toast.loading(`Analizando tarjetas ${type} y su historial...`);

        try {
            // 1. Fetch all cards for this type (active, available, blocked, inactive)
            const cardsInDb = await cardService.fetchCardsByType(type);
            const cardMap = new Map(cardsInDb.map(c => [c.folio, c.status]));

            // 2. Fetch history logs for CARD entity_type to understand WHY a card is gone
            const history = await HistoryService.fetchCardHistoryByRange(type);
            
            // Group all logs by folio
            const logsByFolio = new Map<string, typeof history>();
            history.forEach(log => {
                const folioMatch = log.entity_name?.match(/Folio:\s*(\w+)/i);
                const folio = folioMatch ? folioMatch[1] : null;
                if (!folio) return;
                if (!logsByFolio.has(folio)) logsByFolio.set(folio, []);
                logsByFolio.get(folio)!.push(log);
            });
            
            // Analyze each folio's full history → reason, date, person_id
            type HistoryResult = { reason: string, date: string | null, personId: string | null };
            const historyMap = new Map<string, HistoryResult>();
            
            logsByFolio.forEach((logs, folio) => {
                let wasReplacedByLoss = false;
                let wasReplacedAvailable = false;
                let wasDeleted = false;
                let relevantDate: string | null = null;
                let relevantPersonId: string | null = null;
                
                for (const log of logs) {
                    const msg = log.details?.message || "";
                    
                    if (log.action === 'REPLACE_OLD') {
                        if (msg.includes("Baja Definitiva") || msg.includes("bloqueado")) {
                            wasReplacedByLoss = true;
                            if (!relevantDate) relevantDate = log.timestamp;
                            if (!relevantPersonId) relevantPersonId = log.details?.related_person_id || null;
                        } else {
                            wasReplacedAvailable = true;
                        }
                    } else if (log.action === 'DELETE') {
                        wasDeleted = true;
                        if (!relevantDate) relevantDate = log.timestamp;
                    }
                }
                
                // If no date from replacement/delete, use the most recent log
                if (!relevantDate && logs.length > 0) {
                    relevantDate = logs[0].timestamp;
                }
                if (!relevantPersonId) {
                    // Try to find person_id from any log's details
                    for (const log of logs) {
                        if (log.details?.related_person_id) {
                            relevantPersonId = log.details.related_person_id;
                            break;
                        }
                    }
                }
                
                if (wasReplacedByLoss) {
                    historyMap.set(folio, { reason: "Extravío / Reposición", date: relevantDate, personId: relevantPersonId });
                } else if (wasReplacedAvailable) {
                    if (wasDeleted) {
                        historyMap.set(folio, { reason: "Tarjeta no devuelta", date: relevantDate, personId: relevantPersonId });
                    } else {
                        historyMap.set(folio, { reason: "Disponible (Ignorar)", date: null, personId: null });
                    }
                } else if (wasDeleted) {
                    historyMap.set(folio, { reason: "Eliminada permanentemente", date: relevantDate, personId: relevantPersonId });
                }
            });

            // 3. Resolve person names in batch
            const personIds = new Set<string>();
            const personContextMap = new Map<string, string>();
            historyMap.forEach(entry => {
                if (entry.personId) personIds.add(entry.personId);
            });
            
            const personNameMap = new Map<string, string>();
            if (personIds.size > 0) {
                const { supabase } = await import("../../supabase");
                const ids = Array.from(personIds);
                for (let i = 0; i < ids.length; i += 50) {
                    const chunk = ids.slice(i, i + 50);
                    const { data: people } = await supabase
                        .from("personnel")
                        .select("id, first_name, last_name, status")
                        .in("id", chunk);
                    if (people) {
                        people.forEach(p => {
                            personNameMap.set(p.id, `${p.first_name} ${p.last_name}`);
                            if (p.status === 'inactive' || p.status === 'baja') {
                                personContextMap.set(p.id, "Baja de personal");
                            }
                        });
                    }
                }
                
                for (const pid of ids) {
                    if (!personNameMap.has(pid)) {
                        const { data: histLogs } = await supabase
                            .from("history_logs")
                            .select("entity_name, action")
                            .eq("entity_id", pid)
                            .order("timestamp", { ascending: false });
                        
                        if (histLogs && histLogs.length > 0) {
                            const name = histLogs.find(l => l.entity_name)?.entity_name;
                            if (name) personNameMap.set(pid, name);
                            
                            const isDeleted = histLogs.some(l => l.action === 'DELETE');
                            if (isDeleted) personContextMap.set(pid, "Personal eliminado");
                        }
                    }
                }
            }

            // 4. Process range: only include problematic folios
            type MissingCardEntry = { folio: string, status: string, observation: string, date: string, personName: string };
            const results: MissingCardEntry[] = [];
            
            for (let i = startRange; i <= endRange; i++) {
                const folioStr = i.toString();
                const status = cardMap.get(folioStr);
                const historyEntry = historyMap.get(folioStr);
                let reason = historyEntry?.reason || "";

                if (status === 'active' || status === 'available') continue;
                if (reason === 'Disponible (Ignorar)') continue;

                let displayStatus: string;
                let finalObservation: string;

                if (status) {
                    displayStatus = status === 'blocked' ? 'BLOQUEADA' : status === 'inactive' ? 'BAJA' : status.toUpperCase();
                    
                    if (!reason || reason === "Tarjeta no devuelta") {
                        const context = historyEntry?.personId ? personContextMap.get(historyEntry.personId) : "";
                        finalObservation = context ? `Tarjeta no devuelta (${context})` : "Tarjeta no devuelta";
                    } else {
                        finalObservation = reason;
                    }
                } else {
                    displayStatus = "NO REGISTRADA";
                    finalObservation = reason || "No registrada";
                }

                const dateStr = historyEntry?.date 
                    ? new Date(historyEntry.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
                    : "-";
                const personName = historyEntry?.personId 
                    ? (personNameMap.get(historyEntry.personId) || "-")
                    : "-";

                results.push({
                    folio: folioStr,
                    status: displayStatus,
                    observation: finalObservation,
                    date: dateStr,
                    personName
                });
            }

            if (results.length === 0) {
                toast.success("No se encontraron incidencias en este rango", { id: toastId });
                isOpen = false;
                return;
            }

            // 4. Export
            await exportMissingCardsToExcel(results, type, startRange, endRange);
            toast.success(`Análisis completado. Reporte generado.`, { id: toastId });
            isOpen = false;
        } catch (error) {
            console.error(error);
            toast.error("Error al procesar el análisis", { id: toastId });
        } finally {
            isProcessing = false;
        }
    }
</script>

<Modal bind:isOpen title="Detectar Folios Faltantes" size="md">
    <div class="space-y-6">
        <div class="p-4 bg-blue-50 rounded-xl flex gap-3 border border-blue-100">
            <FileSearch class="text-blue-600 shrink-0" size={20} />
            <div class="space-y-1">
                <p class="text-xs font-bold text-blue-900 uppercase tracking-tight">Análisis de Inventario</p>
                <p class="text-[11px] text-blue-700 leading-relaxed">
                    Esta herramienta comparará el rango de folios ingresado con los registros actuales en el sistema 
                    para identificar cuáles tarjetas no han sido registradas aún.
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-4">
            <div class="space-y-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest block">Tipo de Tarjeta</span>
                <div class="flex p-1 bg-slate-100 rounded-lg w-full">
                    <button 
                        type="button"
                        class="flex-1 py-2 text-xs font-bold rounded-md transition-all {type === 'KONE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
                        onclick={() => type = 'KONE'}
                    >
                        KONE
                    </button>
                    <button 
                        type="button"
                        class="flex-1 py-2 text-xs font-bold rounded-md transition-all {type === 'P2000' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
                        onclick={() => type = 'P2000'}
                    >
                        P2000
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-widest block">Folio Inicial</span>
                    <Input 
                        type="number" 
                        placeholder="Ej. 1" 
                        bind:value={startRange}
                        min="1"
                    />
                </div>
                <div class="space-y-2">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-widest block">Folio Final</span>
                    <Input 
                        type="number" 
                        placeholder="Ej. 100" 
                        bind:value={endRange}
                        min="1"
                    />
                </div>
            </div>
        </div>

        {#if startRange !== null && endRange !== null && endRange >= startRange}
            <div class="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-slate-600">
                <AlertCircle size={16} />
                <span class="text-[11px] font-medium">Se analizarán {endRange - startRange + 1} folios potenciales.</span>
            </div>
        {/if}
    </div>

    {#snippet footer()}
        <Button variant="ghost" onclick={() => isOpen = false} disabled={isProcessing}>
            Cancelar
        </Button>
        <Button 
            variant="primary" 
            onclick={handleDetect} 
            loading={isProcessing}
            disabled={startRange === null || endRange === null || startRange > endRange}
        >
            Detectar y Exportar
        </Button>
    {/snippet}
</Modal>
