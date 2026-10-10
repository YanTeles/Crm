import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StageOption } from "@/features/workspace/lookups";

export const KANBAN_PAGE = 30;

export type KanbanCard = {
  id: string;
  name: string;
  customer_company: string | null;
  assigned_to: string | null;
  stage_id: string;
  outcome: "open" | "won" | "lost";
  won_amount: number | null;
  row_version: number;
  updated_at: string;
};

export const CARD_COLUMNS =
  "id, name, customer_company, assigned_to, stage_id, outcome, won_amount, row_version, updated_at";

// Primeira página de cada coluna. Colunas de Ganho/Perdido mostram fechamentos dos últimos 30 dias.
export async function getBoard(
  companyId: string,
  stages: StageOption[],
  filters: { assignee?: string },
): Promise<Record<string, { cards: KanbanCard[]; total: number }>> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const active = stages.filter((s) => !s.archived_at);

  const results = await Promise.all(
    active.map(async (s) => {
      let q = supabase
        .from("leads")
        .select(CARD_COLUMNS, { count: "exact" })
        .eq("company_id", companyId)
        .eq("stage_id", s.id)
        .is("archived_at", null);
      if (s.kind !== "open") q = q.gte("closed_at", since);
      if (filters.assignee === "none") q = q.is("assigned_to", null);
      else if (filters.assignee) q = q.eq("assigned_to", filters.assignee);
      const { data, count } = await q.order("updated_at", { ascending: false }).range(0, KANBAN_PAGE - 1);
      return [s.id, { cards: (data ?? []) as KanbanCard[], total: count ?? 0 }] as const;
    }),
  );
  return Object.fromEntries(results);
}
