import { personnelService } from "../services/personnel";
import { cardService } from "../services/cards";
import { toast } from "svelte-sonner";
import { handleError } from "../utils/error";
import { personnelState } from "../stores/personnel.svelte";
import type { Person } from "../types";

export const personnelActions = {
    async handleBlockPerson(person: Person, onSuccess?: () => Promise<void>) {
        const oldStatusRaw = person.status_raw;
        const newStatus = oldStatusRaw === "blocked" ? "active" : "blocked";

        // Optimistic UI Update
        const localPerson = personnelState.personnel.find(p => p.id === person.id);
        if (localPerson) localPerson.status_raw = newStatus;

        try {
            await personnelService.updateStatus(person.id, newStatus);
            toast.success(
                newStatus === "blocked" ? "Persona Bloqueada" : "Persona Reactivada"
            );
            await onSuccess?.();
        } catch (e) {
            // Revert on error
            if (localPerson) localPerson.status_raw = oldStatusRaw;
            handleError(e, "Error al actualizar estado");
        }
    },

    async handleDeactivatePerson(person: Person, onSuccess?: () => Promise<void>) {
        const oldStatusRaw = person.status_raw;

        // Optimistic UI Update
        const localPerson = personnelState.personnel.find(p => p.id === person.id);
        if (localPerson) localPerson.status_raw = "inactive";

        try {
            await personnelService.updateStatus(person.id, "inactive");
            toast.success("Persona dada de baja");
            await onSuccess?.();
        } catch (e) {
            // Revert on error
            if (localPerson) localPerson.status_raw = oldStatusRaw;
            handleError(e, "Error al dar de baja");
        }
    },

    async handleReactivatePerson(person: Person, onSuccess?: () => Promise<void>) {
        const oldStatusRaw = person.status_raw;

        // Optimistic UI Update
        const localPerson = personnelState.personnel.find(p => p.id === person.id);
        if (localPerson) localPerson.status_raw = "active";

        try {
            await personnelService.updateStatus(person.id, "active");
            toast.success("Persona reactivada");
            await onSuccess?.();
        } catch (e) {
            // Revert on error
            if (localPerson) localPerson.status_raw = oldStatusRaw;
            handleError(e, "Error al reactivar");
        }
    },

    async handleDeletePersonPermanent(person: Person, cardActionMap?: Record<string, "delete" | "keep">, onSuccess?: () => Promise<void>) {
        try {
            await personnelService.delete(person.id, cardActionMap);
            toast.success("Registro eliminado");
            await onSuccess?.();
        } catch (e) {
            handleError(e, "Error al eliminar");
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
            handleError(e, "Error al guardar tarjeta");
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
            handleError(e, "Error al actualizar tarjeta");
        }
    },

    async handleCardUnassign(card: any, onSuccess?: () => Promise<void>) {
        try {
            await cardService.unassign(card.id);
            toast.success("Tarjeta desvinculada");
            await onSuccess?.();
        } catch (e) {
            handleError(e, "Error al desvincular tarjeta");
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
            handleError(e, "Error al programar tarjeta");
        }
    }
};
