import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { documentService } from "./documents";
import { RESPONSIVA_LEGAL_TEXTS } from "../constants/legal";
import type { SignedDocument } from "../types";

function normalizeDocument(d: SignedDocument) {
    const template = d.document_templates as any;
    return {
        id: d.id,
        person_id: d.person_id,
        folio: (d.content?.folio as string) ?? d.access_media?.identifier ?? "",
        card_type: template?.access_media_types?.name ?? template?.name ?? "",
        data: d.content ?? {},
        signature: d.signature,
        legal_hash: d.legal_hash,
        legal_snapshot: d.legal_snapshot,
        created_at: d.created_at,
    };
}

/**
 * Texto legal de la responsiva. Acepta un id de tipo de medio (uuid) o el
 * nombre mostrado (ej. "P2000"). Fuente: document_templates.content
 * (JSON, arreglo de párrafos); cae a las constantes locales si la plantilla
 * no tiene contenido.
 */
export async function fetchLegalText(typeOrMediaTypeId: string): Promise<string[]> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        typeOrMediaTypeId || "",
    );
    try {
        if (isUuid) {
            const { data } = await supabase
                .from("document_templates")
                .select("content")
                .eq("media_type_id", typeOrMediaTypeId)
                .limit(1)
                .maybeSingle();
            if (data?.content) {
                const parsed = JSON.parse(data.content);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
            }
        } else {
            const { data } = await supabase
                .from("document_templates")
                .select("content, access_media_types!inner(name)")
                .ilike("access_media_types.name", typeOrMediaTypeId)
                .limit(1)
                .maybeSingle();
            if (data?.content) {
                const parsed = JSON.parse(data.content);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
            }
        }
    } catch {
        // Fallback abajo
    }
    const key = (typeOrMediaTypeId || "").toUpperCase();
    const typeKey = key === "P2000" ? "P2000" : key === "ACCESSPRO" ? "AccessPRO" : "KONE";
    return RESPONSIVA_LEGAL_TEXTS[typeKey as keyof typeof RESPONSIVA_LEGAL_TEXTS];
}

export const responsivaService = {
    /**
     * Lee las responsivas desde el modelo nuevo (signed_documents).
     */
    async fetchByPerson(personId: string) {
        const docs = await documentService.fetchByPerson(personId);
        return docs.map(normalizeDocument).sort((a, b) =>
            String(b.created_at).localeCompare(String(a.created_at)),
        );
    },

    async save(payload: {
        person_id: string;
        folio: string;
        card_type: string;
        access_media_id?: string | null;
        data: any;
        signature: string;
        legal_hash?: string;
        legal_snapshot?: string;
    }) {
        // Resolver el medio de acceso (por id directo o por folio + tipo).
        let mediaTypeId: string | null = null;
        let mediaId: string | null = payload.access_media_id ?? null;

        if (mediaId) {
            const { data: media } = await supabase
                .from("access_media")
                .select("id, media_type_id")
                .eq("id", mediaId)
                .maybeSingle();
            mediaTypeId = media?.media_type_id ?? null;
        } else if (payload.folio) {
            const { data: typeRow } = await supabase
                .from("access_media_types")
                .select("id")
                .ilike("name", payload.card_type)
                .limit(1)
                .maybeSingle();
            if (typeRow) {
                const { data: media } = await supabase
                    .from("access_media")
                    .select("id")
                    .eq("media_type_id", typeRow.id)
                    .eq("person_id", payload.person_id)
                    .eq("identifier", payload.folio)
                    .maybeSingle();
                if (media) {
                    mediaId = media.id;
                    mediaTypeId = typeRow.id;
                }
            }
        }

        // Plantilla vinculada al tipo de medio concreto.
        const { data: template } = mediaTypeId
            ? await supabase
                  .from("document_templates")
                  .select("id")
                  .eq("media_type_id", mediaTypeId)
                  .maybeSingle()
            : { data: null };

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
        await documentService.delete(id);

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
