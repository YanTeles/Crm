"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, invalid, ok, type ActionResult } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

const money = z
  .number({ error: "Informe o valor." })
  .gt(0, "O valor precisa ser maior que zero.")
  .max(999999999999.99)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Use no máximo duas casas decimais.");

const saleSchema = z.object({
  leadId: z.string().uuid("Selecione o lead."),
  description: z.string().trim().min(1, "Informe a descrição.").max(500),
  amount: money,
  status: z.enum(["pending", "completed"]),
  completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
  clientRequestId: z.string().uuid(),
});
export type SaleInput = z.input<typeof saleSchema>;

const editSchema = z.object({
  saleId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição.").max(500),
  amount: money,
  completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export type SaleEditInput = z.input<typeof editSchema>;

function refresh(slug: string) {
  if (/^[a-z0-9-]{3,48}$/.test(slug)) revalidatePath(`/app/${slug}`, "layout");
}

export async function createSale(input: SaleInput & { slug: string }): Promise<ActionResult<string>> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", {
    p_lead_id: d.leadId,
    p_description: d.description,
    p_amount: d.amount,
    p_status: d.status,
    p_completed_at: d.status === "completed" ? (d.completedAt ?? null) : null,
    p_seller_id: d.sellerId ?? null,
    p_client_request_id: d.clientRequestId,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Venda registrada.");
}

export async function updateSale(input: SaleEditInput & { slug: string }): Promise<ActionResult<number>> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_sale", {
    p_sale_id: d.saleId,
    p_description: d.description,
    p_amount: d.amount,
    p_completed_at: d.completedAt ?? null,
    p_seller_id: d.sellerId ?? null,
    p_expected_version: d.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Venda atualizada.");
}

export async function completeSale(input: {
  saleId: string;
  completedAt?: string | null;
  version?: number;
  slug: string;
}): Promise<ActionResult<number>> {
  if (!z.string().uuid().safeParse(input.saleId).success) return fail("Venda inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", {
    p_sale_id: input.saleId,
    p_completed_at: input.completedAt ?? null,
    p_expected_version: input.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Venda concluída.");
}

export async function cancelSale(input: {
  saleId: string;
  reason: string;
  version?: number;
  slug: string;
}): Promise<ActionResult<number>> {
  if (!z.string().uuid().safeParse(input.saleId).success) return fail("Venda inválida.");
  const reason = input.reason.trim();
  if (!reason) return fail("Informe o motivo do cancelamento.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_sale", {
    p_sale_id: input.saleId,
    p_reason: reason.slice(0, 1000),
    p_expected_version: input.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Venda cancelada.");
}
