import { supabase } from "../supabase";
import { withErrorHandlingSafe } from "../utils";
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
};
