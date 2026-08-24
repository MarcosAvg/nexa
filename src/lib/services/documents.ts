import { supabase } from "../supabase";
import { withErrorHandlingSafe, withErrorHandling } from "../utils";
import type { DocumentTemplate, SignedDocument } from "../types";

export type SignedDocumentInput = {
    person_id: string;
    access_media_id?: string | null;
    template_id?: string | null;
    document_type?: string;
    content?: Record<string, unknown> | null;
    signature: string;
    legal_hash?: string | null;
    legal_snapshot?: string | null;
};

export type DocumentTemplateInput = {
    key?: string;
    name: string;
    document_type?: string;
    media_type_id?: string | null;
    active?: boolean;
    /** Arreglo de párrafos; se serializa como JSON en `content`. */
    paragraphs: string[];
};

export const documentService = {
    async fetchTemplates(throwOnError: boolean = false): Promise<DocumentTemplate[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("document_templates")
                .select("*")
                .eq("active", true)
                .order("name", { ascending: true });
            if (error) throw error;
            return (data || []) as DocumentTemplate[];
        }, "Fetch Document Templates", []);
    },

    /** Todos los templates (incluidos inactivos) para la gestión. */
    async fetchAllTemplates(): Promise<DocumentTemplate[]> {
        return withErrorHandling(async () => {
            const { data, error } = await supabase
                .from("document_templates")
                .select("*")
                .order("name", { ascending: true });
            if (error) throw error;
            return (data || []) as DocumentTemplate[];
        }, "Fetch All Document Templates");
    },

    async fetchByPerson(personId: string): Promise<SignedDocument[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("signed_documents")
                .select("*, document_templates(*), access_media(*, access_media_types(*))")
                .eq("person_id", personId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data || []) as SignedDocument[];
        }, "Fetch Person Signed Documents", []);
    },

    async save(payload: SignedDocumentInput): Promise<SignedDocument> {
        const { data, error } = await supabase
            .from("signed_documents")
            .insert([{
                person_id: payload.person_id,
                access_media_id: payload.access_media_id ?? null,
                template_id: payload.template_id ?? null,
                document_type: payload.document_type ?? "responsiva",
                content: payload.content ?? null,
                signature: payload.signature,
                legal_hash: payload.legal_hash ?? null,
                legal_snapshot: payload.legal_snapshot ?? null,
            }])
            .select()
            .single();
        if (error) throw error;
        return data as SignedDocument;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from("signed_documents")
            .delete()
            .eq("id", id);
        if (error) throw error;
    },

    // ─── Gestión de plantillas (editor) ──────────────────────────────

    async createTemplate(input: DocumentTemplateInput): Promise<DocumentTemplate> {
        return withErrorHandling(async () => {
            const slugify = (s: string) =>
                s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
            const key = slugify(input.key?.trim() || input.name);
            const { data, error } = await supabase
                .from("document_templates")
                .insert([{
                    key,
                    name: input.name.trim(),
                    document_type: input.document_type ?? "responsiva",
                    media_type_id: input.media_type_id ?? null,
                    active: input.active !== false,
                    version: 1,
                    content: JSON.stringify(input.paragraphs),
                }])
                .select()
                .single();
            if (error) throw error;
            return data as DocumentTemplate;
        }, "Create Document Template");
    },

    /** Actualiza una plantilla, subiendo `version` en cada edición. */
    async updateTemplate(id: string, input: DocumentTemplateInput): Promise<DocumentTemplate> {
        return withErrorHandling(async () => {
            const { data: current, error: fetchErr } = await supabase
                .from("document_templates")
                .select("version")
                .eq("id", id)
                .single();
            if (fetchErr) throw fetchErr;
            const nextVersion = (current?.version ?? 0) + 1;
            const payload: Record<string, unknown> = {
                name: input.name.trim(),
                document_type: input.document_type ?? "responsiva",
                media_type_id: input.media_type_id ?? null,
                active: input.active !== false,
                version: nextVersion,
                content: JSON.stringify(input.paragraphs),
            };
            if (input.key?.trim()) payload.key = input.key.trim();
            const { data, error } = await supabase
                .from("document_templates")
                .update(payload)
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data as DocumentTemplate;
        }, "Update Document Template");
    },

    async setTemplateActive(id: string, active: boolean): Promise<void> {
        return withErrorHandling(async () => {
            const { error } = await supabase
                .from("document_templates")
                .update({ active })
                .eq("id", id);
            if (error) throw error;
        }, "Set Document Template Active");
    },

    async deleteTemplate(id: string): Promise<void> {
        return withErrorHandling(async () => {
            const { error } = await supabase
                .from("document_templates")
                .delete()
                .eq("id", id);
            if (error) throw error;
        }, "Delete Document Template");
    },
};
