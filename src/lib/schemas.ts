import { z } from "zod";

/**
 * Esquema de validación para el Personal
 * Basado en los requerimientos del usuario:
 * - Nombres y apellidos obligatorios
 * - Dependencia, Edificio, Piso Base obligatorios
 * - Horario (días, entrada y salida) obligatorio
 * - Correo opcional pero validado si existe
 */
export const personnelSchema = z.object({
    first_name: z.string()
        .min(2, "El nombre debe tener al menos 2 caracteres")
        .trim(),
    last_name: z.string()
        .min(2, "Los apellidos deben tener al menos 2 caracteres")
        .trim(),
    dependency: z.string()
        .min(1, "La dependencia es obligatoria"),
    building: z.string()
        .min(1, "El edificio es obligatorio"),
    floor: z.string()
        .min(1, "El piso base es obligatorio"),
    schedule_days: z.string()
        .min(1, "El horario de días es obligatorio"),
    entry_time: z.string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora de entrada inválido"),
    exit_time: z.string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora de salida inválido"),
    email: z.string()
        .trim()
        .email("El formato del correo electrónico no es válido")
        .or(z.literal("")), // Permite vacío
    employee_no: z.string().optional(),
    area: z.string().optional(),
    position: z.string().optional(),
});

export type PersonnelSchema = z.infer<typeof personnelSchema>;
