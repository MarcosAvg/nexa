import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { documentService } from "./documents";
import type { SignedDocument } from "../types";

function normalizeDocument(d: SignedDocument) {
    return {
        id: d.id,
        person_id: d.person_id,
        folio: (d.content?.folio as string) ?? d.access_media?.identifier ?? "",
        card_type: d.document_templates?.legacy_key ?? "",
        data: d.content ?? {},
        signature: d.signature,
        legal_hash: d.legal_hash,
        legal_snapshot: d.legal_snapshot,
        created_at: d.created_at,
    };
}

export const responsivaService = {
    /**
     * Dual-read: lee el modelo nuevo (signed_documents) y completa con las
     * responsivas legacy que aún no fueron migradas (huérfanas sin tarjeta).
     */
    async fetchByPerson(personId: string) {
        const docs = await documentService.fetchByPerson(personId);
        const newItems = docs.map(normalizeDocument);
        const migratedLegacyIds = new Set(
            docs.map((d) => d.legacy_responsiva_id).filter(Boolean),
        );

        const { data: legacy, error } = await supabase
            .from("signed_responsivas")
            .select("*")
            .eq("person_id", personId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const orphans = (legacy || []).filter((r) => !migratedLegacyIds.has(r.id));
        return [...newItems, ...orphans].sort((a, b) =>
            String(b.created_at).localeCompare(String(a.created_at)),
        );
    },

    async save(payload: {
        person_id: string;
        folio: string;
        card_type: string;
        data: any;
        signature: string;
        legal_hash?: string;
        legal_snapshot?: string;
    }) {
        // Resolver plantilla por tipo legacy.
        const { data: template } = await supabase
            .from("document_templates")
            .select("id")
            .eq("legacy_key", payload.card_type)
            .maybeSingle();

        // Resolver el medio de acceso asociado (opcional: se conserva el
        // documento aunque no se encuentre un medio).
        let mediaId: string | null = null;
        if (payload.folio) {
            const { data: typeRow } = await supabase
                .from("access_media_types")
                .select("id")
                .eq("legacy_key", payload.card_type)
                .maybeSingle();
            if (typeRow) {
                const { data: media } = await supabase
                    .from("access_media")
                    .select("id")
                    .eq("media_type_id", typeRow.id)
                    .eq("person_id", payload.person_id)
                    .eq("identifier", payload.folio)
                    .maybeSingle();
                if (media) mediaId = media.id;
            }
        }

        const doc = await documentService.save({
            person_id: payload.person_id,
            access_media_id: mediaId,
            template_id: template?.id ?? null,
            document_type: "responsiva",
            content: payload.data,
            signature: payload.signature,
            legal_hash: payload.legal_hash ?? null,
            legal_snapshot: payload.legal_snapshot ?? null,
        });

        const { data: person } = await supabase
            .from("personnel")
            .select("first_name, last_name")
            .eq("id", payload.person_id)
            .single();
        const personName = person
            ? `${person.first_name} ${person.last_name}`
            : `Personal (${payload.person_id})`;

        await HistoryService.log("PERSONNEL", payload.person_id, "SIGN_RESPONSIVA", {
            message: `Responsiva firmada para tarjeta ${payload.folio}`,
            responsiva_id: doc.id,
            entityName: personName,
        });

        return doc;
    },

    async delete(id: string, personId: string) {
        // Si es un documento del modelo nuevo, se elimina junto con su
        // responsiva legacy correspondiente (evita "resucitar" el registro).
        const { data: doc } = await supabase
            .from("signed_documents")
            .select("legacy_responsiva_id")
            .eq("id", id)
            .maybeSingle();

        if (doc) {
            await documentService.delete(id);
            if (doc.legacy_responsiva_id) {
                await supabase
                    .from("signed_responsivas")
                    .delete()
                    .eq("id", doc.legacy_responsiva_id);
            }
        } else {
            // Huérfana legacy: eliminar directamente.
            const { data: deleted, error } = await supabase
                .from("signed_responsivas")
                .delete()
                .eq("id", id)
                .select();
            if (error) throw error;
            if (!deleted || deleted.length === 0) {
                throw new Error("No se pudo eliminar la responsiva. Verifique permisos (RLS).");
            }
        }

        const { data: person } = await supabase
            .from("personnel")
            .select("first_name, last_name")
            .eq("id", personId)
            .single();
        const personName = person
            ? `${person.first_name} ${person.last_name}`
            : `Personal (${personId})`;

        await HistoryService.log("PERSONNEL", personId, "DELETE_RESPONSIVA", {
            message: `Responsiva eliminada`,
            entityName: personName,
        });
    }
};
