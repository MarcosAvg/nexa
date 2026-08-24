<script lang="ts">
    import { toast } from "svelte-sonner";
    import { documentService } from "../../services/documents";
    import { catalogState } from "../../stores";
    import { updateWithLock } from "../../utils/optimisticLock";
    import type { DocumentTemplate } from "../../types";

    /** Mensaje cuando otro usuario modificó la plantilla mientras se editaba. */
    const CONFLICT_MSG =
        "Este registro fue modificado por otra persona. Recarga e inténtalo de nuevo.";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import Badge from "../Badge.svelte";
    import DeleteConfirmTypedModal from "../DeleteConfirmTypedModal.svelte";
    import CatalogSectionHeader from "./CatalogSectionHeader.svelte";
    import { Plus, Edit2, Trash2, FileText, ArrowUp, ArrowDown, Copy, Power, Eye } from "lucide-svelte";

    /** Placeholders disponibles para insertar en el texto del documento. */
    const PLACEHOLDERS = [
        { token: "{nombre}", label: "Nombre" },
        { token: "{numEmpleado}", label: "No. Empleado" },
        { token: "{dependencia}", label: "Dependencia" },
        { token: "{folio}", label: "Folio" },
        { token: "{monto}", label: "Monto de reposición" },
        { token: "{organizacion}", label: "Organización" },
    ];

    const EJEMPLO: Record<string, string> = {
        "{nombre}": "Juan Pérez García",
        "{numEmpleado}": "12345",
        "{dependencia}": "Secretaría del Trabajo",
        "{folio}": "KNE-000123",
        "{monto}": "$300.00 (Trescientos pesos 00/100 M.N.)",
        "{organizacion}": "Nexa",
    };

    let templates = $state<DocumentTemplate[]>([]);
    let mediaTypes = $derived(catalogState.mediaTypes);
    let isLoading = $state(false);

    let isModalOpen = $state(false);
    let editingId = $state<string | null>(null);
    let name = $state("");
    let documentType = $state("responsiva");
    let mediaTypeId = $state<string>("");
    let active = $state(true);
    let paragraphs = $state<string[]>([""]);
    let previewing = $state(false);

    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<DocumentTemplate | null>(null);

    // Versión (optimistic locking) de la plantilla al abrir el editor.
    let editingTemplateUpdatedAt = $state<string | null>(null);

    async function loadTemplates() {
        isLoading = true;
        try {
            templates = await documentService.fetchAllTemplates();
        } catch (e: any) {
            toast.error(e?.message || "No se pudieron cargar las plantillas");
        } finally {
            isLoading = false;
        }
    }
    $effect(() => { loadTemplates(); });

    function parseContent(t: DocumentTemplate): string[] {
        try {
            const c = JSON.parse(t.content || "[]");
            return Array.isArray(c) ? c : [];
        } catch {
            return [];
        }
    }

    function openCreate() {
        editingId = null;
        editingTemplateUpdatedAt = null;
        name = "";
        documentType = "responsiva";
        mediaTypeId = "";
        active = true;
        paragraphs = [""];
        previewing = false;
        isModalOpen = true;
    }

    function openEdit(t: DocumentTemplate) {
        editingId = t.id;
        editingTemplateUpdatedAt = (t as any).updated_at ?? null;
        name = t.name;
        documentType = t.document_type;
        mediaTypeId = (t as any).media_type_id ?? "";
        active = t.active !== false;
        paragraphs = parseContent(t);
        if (paragraphs.length === 0) paragraphs = [""];
        previewing = false;
        isModalOpen = true;
    }

    function addParagraph() { paragraphs = [...paragraphs, ""]; }
    function removeParagraph(i: number) { paragraphs = paragraphs.filter((_, idx) => idx !== i); if (paragraphs.length === 0) paragraphs = [""]; }
    function moveParagraph(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= paragraphs.length) return;
        const next = [...paragraphs];
        [next[i], next[j]] = [next[j], next[i]];
        paragraphs = next;
    }

    /** Inserta un placeholder en el párrafo activo (el que tenga el foco o el último). */
    function insertPlaceholder(token: string) {
        const lastIndex = paragraphs.length - 1;
        paragraphs = paragraphs.map((p, i) => (i === lastIndex ? (p ? p + " " + token : token) : p));
    }

    function previewText(paragraph: string): string {
        return PLACEHOLDERS.reduce((acc, ph) => acc.split(ph.token).join(EJEMPLO[ph.token] ?? ph.token), paragraph);
    }

    async function saveTemplate() {
        if (!name.trim()) { toast.error("El nombre de la plantilla es requerido"); return; }
        const cleaned = paragraphs.map((p) => p.trim()).filter((p) => p.length > 0);
        if (cleaned.length === 0) { toast.error("Agrega al menos un párrafo de contenido"); return; }
        try {
            if (editingId) {
                if (editingTemplateUpdatedAt) {
                    // Optimistic locking: valida la versión antes de la actualización
                    // real (updateTemplate incrementa la versión internamente).
                    const lock = await updateWithLock(
                        "document_templates",
                        editingId,
                        {
                            name: name.trim(),
                            document_type: documentType,
                            media_type_id: mediaTypeId || null,
                            active,
                            content: JSON.stringify(cleaned),
                        },
                        editingTemplateUpdatedAt,
                    );
                    if (!lock.ok) {
                        toast.error(CONFLICT_MSG);
                        return;
                    }
                }
                await documentService.updateTemplate(editingId, {
                    name,
                    document_type: documentType,
                    media_type_id: mediaTypeId || null,
                    active,
                    paragraphs: cleaned,
                });
                toast.success("Plantilla actualizada (versión incrementada)");
            } else {
                await documentService.createTemplate({
                    name,
                    document_type: documentType,
                    media_type_id: mediaTypeId || null,
                    active,
                    paragraphs: cleaned,
                });
                toast.success("Plantilla creada");
            }
            isModalOpen = false;
            await loadTemplates();
        } catch (e: any) {
            toast.error(e?.message || "Error al guardar la plantilla");
        }
    }

    async function toggleActive(t: DocumentTemplate) {
        try {
            await documentService.setTemplateActive(t.id, !(t.active !== false));
            await loadTemplates();
        } catch (e: any) {
            toast.error(e?.message || "Error al actualizar el estado");
        }
    }

    async function duplicateTemplate(t: DocumentTemplate) {
        try {
            await documentService.createTemplate({
                name: `${t.name} (copia)`,
                document_type: t.document_type,
                media_type_id: (t as any).media_type_id ?? null,
                active: false,
                paragraphs: parseContent(t),
            });
            toast.success("Plantilla duplicada");
            await loadTemplates();
        } catch (e: any) {
            toast.error(e?.message || "Error al duplicar");
        }
    }

    function openDeleteModal(t: DocumentTemplate) {
        deleteTarget = t;
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await documentService.deleteTemplate(deleteTarget.id);
            toast.success("Plantilla eliminada");
            isDeleteModalOpen = false;
            await loadTemplates();
        } catch (e: any) {
            toast.error(e?.message || "No se pudo eliminar la plantilla");
        }
    }

    function mediaName(id?: string): string {
        if (!id) return "Genérica";
        return mediaTypes.find((m) => m.id === id)?.name || "Genérica";
    }
</script>

<div>
    <CatalogSectionHeader
        title="Editor de Plantillas"
        subtitle="Documentos por medio de acceso (textos legales, etc.)"
        actionLabel="Nueva Plantilla"
        icon={Plus}
        onNew={openCreate}
    />

    <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {#if isLoading}
            <div class="p-10 text-center text-sm text-slate-400">Cargando plantillas…</div>
        {:else if templates.length === 0}
            <div class="p-10 text-center">
                <FileText size={40} class="mx-auto text-slate-300 mb-2" />
                <p class="text-sm font-semibold text-slate-500">No hay plantillas configuradas.</p>
            </div>
        {:else}
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th class="px-5 py-3">Plantilla</th>
                        <th class="px-5 py-3">Medio</th>
                        <th class="px-5 py-3">Tipo</th>
                        <th class="px-5 py-3">Versión</th>
                        <th class="px-5 py-3">Estado</th>
                        <th class="px-5 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {#each templates as t}
                        <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                            <td class="px-5 py-3 font-semibold text-slate-700">{t.name}</td>
                            <td class="px-5 py-3 text-slate-500">{mediaName((t as any).media_type_id)}</td>
                            <td class="px-5 py-3 text-slate-500 capitalize">{t.document_type}</td>
                            <td class="px-5 py-3 text-slate-500">v{t.version}</td>
                            <td class="px-5 py-3">
                                <Badge variant={t.active !== false ? "emerald" : "slate"}>
                                    {t.active !== false ? "Activa" : "Inactiva"}
                                </Badge>
                            </td>
                            <td class="px-5 py-3">
                                <div class="flex justify-end gap-1.5">
                                    <button class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={() => openEdit(t)} title="Editar" aria-label="Editar plantilla">
                                        <Edit2 size={16} />
                                    </button>
                                    <button class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" onclick={() => duplicateTemplate(t)} title="Duplicar" aria-label="Duplicar plantilla">
                                        <Copy size={16} />
                                    </button>
                                    <button class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" onclick={() => toggleActive(t)} title={t.active !== false ? "Desactivar" : "Activar"} aria-label="Cambiar estado">
                                        <Power size={16} />
                                    </button>
                                    <button class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={() => openDeleteModal(t)} title="Eliminar" aria-label="Eliminar plantilla">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
</div>

<!-- Editor de plantilla -->
<Modal
    bind:isOpen={isModalOpen}
    title={editingId ? "Editar Plantilla" : "Nueva Plantilla"}
    description="Define el contenido del documento. Los tokens &lbrace;&hellip;&rbrace; se reemplazan automáticamente con los datos de la persona."
    size="lg"
>
    <div class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-1">
                <label for="tpl-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <Input id="tpl-name" placeholder="Ej. Responsiva del medio" bind:value={name} />
            </div>
            <div>
                <label for="tpl-type" class="block text-sm font-medium text-slate-700 mb-1">Tipo de documento</label>
                <select id="tpl-type" bind:value={documentType} class="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
                    <option value="responsiva">Responsiva</option>
                    <option value="otro">Otro</option>
                </select>
            </div>
            <div>
                <label for="tpl-media" class="block text-sm font-medium text-slate-700 mb-1">Medio asociado</label>
                <select id="tpl-media" bind:value={mediaTypeId} class="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50">
                    <option value="">Genérica (sin medio)</option>
                    {#each mediaTypes as m}
                        <option value={m.id}>{m.name}</option>
                    {/each}
                </select>
            </div>
        </div>

        <label class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
            <span class="text-sm font-bold text-slate-700">Plantilla activa</span>
            <input type="checkbox" bind:checked={active} class="w-5 h-5 accent-emerald-600" />
        </label>

        <div>
            <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700">Contenido (párrafos)</p>
                <Button variant="secondary" size="sm" onclick={addParagraph}><Plus size={14} strokeWidth={3} class="mr-1" /> Párrafo</Button>
            </div>
            <div class="space-y-3 max-h-64 overflow-y-auto pr-1">
                {#each paragraphs as paragraph, i}
                    <div class="p-2 rounded-xl border border-slate-200 bg-white">
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Párrafo {i + 1}</span>
                            <div class="flex gap-1">
                                <button class="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30" onclick={() => moveParagraph(i, -1)} disabled={i === 0} title="Subir">
                                    <ArrowUp size={13} />
                                </button>
                                <button class="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30" onclick={() => moveParagraph(i, 1)} disabled={i === paragraphs.length - 1} title="Bajar">
                                    <ArrowDown size={13} />
                                </button>
                                <button class="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30" onclick={() => removeParagraph(i)} disabled={paragraphs.length <= 1} title="Quitar">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                        <textarea
                            bind:value={paragraphs[i]}
                            rows={3}
                            placeholder="Texto del documento… Ej. …recibí el acceso identificado con el folio &lbrace;folio&rbrace;…"
                            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                        ></textarea>
                        {#if previewing}
                            <p class="mt-1.5 text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap">{previewText(paragraph)}</p>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        <div>
            <p class="text-sm font-medium text-slate-700 mb-2">Insertar campo</p>
            <div class="flex flex-wrap gap-2">
                {#each PLACEHOLDERS as ph}
                    <button
                        type="button"
                        class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        onclick={() => insertPlaceholder(ph.token)}
                        title="Insertar en el último párrafo"
                    >
                        {ph.label}
                    </button>
                {/each}
            </div>
        </div>

        <div class="flex items-center gap-3">
            <Button variant="secondary" size="sm" onclick={() => (previewing = !previewing)}>
                <Eye size={14} class="mr-1" /> {previewing ? "Ocultar vista previa" : "Vista previa"}
            </Button>
            {#if previewing}
                <p class="text-[11px] text-slate-400">Los tokens se muestran reemplazados con datos de ejemplo.</p>
            {/if}
        </div>
    </div>

    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveTemplate}>{editingId ? "Actualizar plantilla" : "Crear plantilla"}</Button>
    {/snippet}
</Modal>

<!-- Confirmar eliminación -->
<DeleteConfirmTypedModal
    bind:isOpen={isDeleteModalOpen}
    title="Eliminar Plantilla"
    targetName={deleteTarget?.name ?? ""}
    confirmText="Eliminar plantilla"
    onConfirm={confirmDelete}
    onCancel={() => (isDeleteModalOpen = false)}
/>
