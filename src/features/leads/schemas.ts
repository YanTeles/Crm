import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const customValuesSchema = z.record(
  z.string().uuid(),
  z.union([z.string().max(2000), z.number(), z.null()]),
);

// Campos do formulário (sem transformações, usado também no cliente).
export const leadFormFields = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(200),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o telefone/WhatsApp.")
    .max(40)
    .refine((v) => normalizePhone(v) !== null, "Telefone inválido. Inclua o DDD."),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("E-mail inválido.").max(254)]),
  customerCompany: z.string().trim().max(200, "Máximo de 200 caracteres."),
  sourceId: z.union([z.literal(""), z.string().uuid()]),
  notes: z.string().trim().max(5000, "Máximo de 5000 caracteres."),
  customValues: customValuesSchema,
});

// Versão do servidor: converte vazios em null.
export const leadFormSchema = leadFormFields.transform((v) => ({
  ...v,
  email: v.email || null,
  customerCompany: v.customerCompany || null,
  sourceId: v.sourceId || null,
  notes: v.notes || null,
}));

export type LeadFormInput = z.infer<typeof leadFormFields>;
export type LeadFormValues = z.output<typeof leadFormSchema>;

export const assignmentSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("auto") }),
  z.object({ mode: z.literal("manual"), assignee: z.string().uuid("Selecione o vendedor.") }),
]);
export type Assignment = z.infer<typeof assignmentSchema>;

export const uuid = z.string().uuid();
export const version = z.number().int().positive().optional();

export const wonSchema = z.object({
  leadId: uuid,
  amount: z
    .number({ error: "Informe o valor." })
    .min(0, "O valor não pode ser negativo.")
    .max(999999999999.99),
  version,
});

export const lostSchema = z.object({
  leadId: uuid,
  reasonId: z.string().uuid("Selecione o motivo."),
  note: z.string().trim().max(1000).optional(),
  version,
});

export const interactionSchema = z.object({
  leadId: uuid,
  kind: z.enum(["note", "contact"]),
  channel: z.enum(["phone", "whatsapp", "email", "meeting", "other"]).optional(),
  content: z.string().trim().min(1, "Escreva o conteúdo.").max(5000),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});
