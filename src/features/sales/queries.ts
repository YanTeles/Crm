import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export const SALES_PAGE_SIZE = 25;

export type SaleRow = Pick<
  Tables<"sales">,
  | "id"
  | "description"
  | "amount"
  | "status"
  | "completed_at"
  | "created_at"
  | "seller_id"
  | "row_version"
  | "cancel_reason"
> & { lead: { id: string; name: string } | null };

export type SaleFilters = {
  status: "all" | "pending" | "completed" | "cancelled";
  seller?: string;
  from: string;
  to: string;
  page: number;
};

// Concluídas filtram pela data de conclusão; demais situações, pela data de registro.
export async function listSales(companyId: string, f: SaleFilters) {
  const supabase = await createClient();
  let q = supabase
    .from("sales")
    .select(
      "id, description, amount, status, completed_at, created_at, seller_id, row_version, cancel_reason, lead:leads!sales_lead_fk(id, name)",
      { count: "exact" },
    )
    .eq("company_id", companyId);

  if (f.seller) q = q.eq("seller_id", f.seller);
  if (f.status === "completed")
    q = q.eq("status", "completed").gte("completed_at", f.from).lt("completed_at", f.to);
  else if (f.status === "all")
    q = q.or(
      `and(status.eq.completed,completed_at.gte."${f.from}",completed_at.lt."${f.to}"),and(status.neq.completed,created_at.gte."${f.from}",created_at.lt."${f.to}")`,
    );
  else q = q.eq("status", f.status).gte("created_at", f.from).lt("created_at", f.to);

  const from = (f.page - 1) * SALES_PAGE_SIZE;
  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(from, from + SALES_PAGE_SIZE - 1);
  if (error) console.error("[sales.list]", error.code, error.message);
  return { rows: (data ?? []) as unknown as SaleRow[], total: count ?? 0 };
}
