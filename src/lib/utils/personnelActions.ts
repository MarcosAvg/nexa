import { personnelService } from "../services/personnel";
import { cardService } from "../services/cards";
import { toast } from "svelte-sonner";
import type { Person } from "../types";

export const personnelActions = {
    async handleBlockPerson(person: Person, onSuccess?: () => Promise<void>) {
        try {
            const newStatus = person.status_raw === "blocked" ? "active" : "blocked";
            await personnelService.updateStatus(person.id, newStatus);
            toast.success(
                newStatus === "blocked" ? "Persona Bloqueada" : "Persona Reactivada"
            );
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al actualizar estado");
        }
    },

    async handleDeactivatePerson(person: Person, onSuccess?: () => Promise<void>) {
        try {
            await personnelService.updateStatus(person.id, "inactive");
            toast.success("Persona dada de baja");
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al dar de baja");
        }
    },

    async handleReactivatePerson(person: Person, onSuccess?: () => Promise<void>) {
        try {
            await personnelService.updateStatus(person.id, "active");
            toast.success("Persona reactivada");
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al reactivar");
        }
    },

    async handleDeletePersonPermanent(person: Person, onSuccess?: () => Promise<void>) {
        try {
            await personnelService.delete(person.id);
            toast.success("Registro eliminado");
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al eliminar");
        }
    },

    async handleCardSave(
        cardData: { type: string; folio: string },
        personId: string,
        onSuccess?: () => Promise<void>,
        replacementOptions?: { oldCardStatus: string }
    ) {
        try {
            await cardService.save({
                ...cardData,
                person_id: personId,
            }, replacementOptions);
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    async handleCardBlock(card: any, onSuccess?: () => Promise<void>) {
        try {
            const newStatus =
                card.status === "blocked" || card.status === "inactive"
                    ? "active"
                    : "blocked";
            await cardService.updateStatus(card.id, newStatus);
            toast.success(
                newStatus === "blocked" ? "Tarjeta Bloqueada" : "Tarjeta Reactivada"
            );
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al actualizar tarjeta");
        }
    },

    async handleCardUnassign(card: any, onSuccess?: () => Promise<void>) {
        try {
            await cardService.unassign(card.id);
            toast.success("Tarjeta desvinculada");
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al desvincular tarjeta");
        }
    },

    async handleCardProgram(card: any, onSuccess?: () => Promise<void>) {
        try {
            await cardService.updateProgrammingStatus(card.id, "done");

            // Look for any pending "Programación" ticket for this card and complete it
            const { supabase: sb } = await import("../supabase");
            const { data: tickets } = await sb
                .from("tickets")
                .select("id")
                .eq("card_id", card.id)
                .eq("type", "Programación")
                .eq("status", "pending");

            if (tickets && tickets.length > 0) {
                const { ticketService } = await import("../services/tickets");
                for (const t of tickets) {
                    await ticketService.delete(t.id);
                }
                toast.success("Tarjeta programada y ticket completado");
            } else {
                toast.success("Tarjeta programada exitosamente");
            }
            await onSuccess?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al programar tarjeta");
        }
    }
};
