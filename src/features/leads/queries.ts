import "server-only";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, normalizeSearch } from "@/lib/text";
import type { Tables } from "@/types/database";
import type { CustomFieldDef } from "@/features/workspace/lookups";

export const LEADS_PAGE_SIZE = 25;

export type LeadFilters = {
  q?: string;
  stage?: string;
  assignee?: string; // uuid | "none"
  source?: string;
  status?: "open" | "won" | "lost" | "archived" | "all";
  field?: string; // id do campo personalizado
  value?: string; // valor para o filtro do campo
  page?: number;
};

export function parseLeadFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const isUuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  const status = one("status");
  return {
    q: one("q")?.slice(0, 100),
    stage: isUuid(one("etapa")),
    assignee: one("responsavel") === "none" ? "none" : isUuid(one("responsavel")),
    source: isUuid(one("origem")),
    status: (["open", "won", "lost", "archived", "all"] as const).find((s) => s === status) ?? "open",
    field: isUuid(one("campo")),
    value: one("valor")?.slice(0, 200),
    page: Math.max(1, Number(one("pagina")) || 1),
  };
}

export type LeadRow = Pick<
  Tables<"leads">,
  | "id"
  | "name"
  | "phone_normalized"
  | "email"
  | "customer_company"
  | "outcome"
  | "stage_id"
  | "source_id"
  | "assigned_to"
  | "won_amount"
  | "created_at"
  | "updated_at"
  | "archived_at"
  | "row_version"
>;

const LEAD_COLUMNS =
  "id, name, phone_normalized, email, customer_company, outcome, stage_id, source_id, assigned_to, won_amount, created_at, updated_at, archived_at, row_version";

export async function listLeads(companyId: string, f: LeadFilters, fields: CustomFieldDef[]) {
  const supabase = await createClient();
  const field = f.field ? fields.find((x) => x.id === f.field) : undefined;
  const select = field && f.value ? `${LEAD_COLUMNS}, lead_custom_values!inner(field_id)` : LEAD_COLUMNS;

  let query = supabase.from("leads").select(select, { count: "exact" }).eq("company_id", companyId);

  if (f.status === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    if (f.status && f.status !== "all") query = query.eq("outcome", f.status);
  }
  if (f.stage) query = query.eq("stage_id", f.stage);
  if (f.source) query = query.eq("source_id", f.source);
  if (f.assignee === "none") query = query.is("assigned_to", null);
  else if (f.assignee) query = query.eq("assigned_to", f.assignee);

  if (f.q) {
    const text = escapeLike(normalizeSearch(f.q));
    const digits = f.q.replace(/\D/g, "");
    query =
      digits.length >= 4
        ? query.or(`search_text.ilike.%${text}%,phone_normalized.ilike.%${digits}%`)
        : query.ilike("search_text", `%${text}%`);
  }

  if (field && f.value) {
    query = query.eq("lead_custom_values.field_id", field.id);
    switch (field.field_type) {
      case "select":
        if (/^[0-9a-f-]{36}$/i.test(f.value)) query = query.eq("lead_custom_values.option_id", f.value);
        break;
      case "number":
        if (!Number.isNaN(Number(f.value)))
          query = query.eq("lead_custom_values.value_number", Number(f.value));
        break;
      case "date":
        if (/^\d{4}-\d{2}-\d{2}$/.test(f.value)) query = query.eq("lead_custom_values.value_date", f.value);
        break;
      default:
        query = query.ilike("lead_custom_values.value_text", `%${escapeLike(f.value)}%`);
    }
  }

  const page = f.page ?? 1;
  const from = (page - 1) * LEADS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + LEADS_PAGE_SIZE - 1);

  if (error) {
    console.error("[leads.list]", error.code, error.message);
    return { rows: [] as LeadRow[], total: 0, error: true };
  }
  return { rows: (data ?? []) as unknown as LeadRow[], total: count ?? 0, error: false };
}

export async function getLead(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  return data;
}

export async function getLeadDetail(leadId: string) {
  const supabase = await createClient();
  const [values, events, interactions, tasks, sales] = await Promise.all([
    supabase.from("lead_custom_values").select("*").eq("lead_id", leadId),
    supabase
      .from("lead_events")
      .select("*")
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("lead_interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase.from("tasks").select("*").eq("lead_id", leadId).order("due_at"),
    supabase.from("sales").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
  ]);
  return {
    customValues: values.data ?? [],
    events: events.data ?? [],
    interactions: interactions.data ?? [],
    tasks: tasks.data ?? [],
    sales: sales.data ?? [],
  };
}
