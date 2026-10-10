import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Summary = {
  leads_created: number;
  leads_converted: number;
  conversion_rate: number | null;
  sales_count: number;
  revenue: number;
  average_ticket: number | null;
  won_count: number;
  won_amount: number;
  lost_count: number;
  pending_count: number;
  pending_amount: number;
};

export type ReportFilters = {
  from: string;
  to: string;
  seller?: string | null;
  source?: string | null;
  stage?: string | null;
};

const EMPTY: Summary = {
  leads_created: 0,
  leads_converted: 0,
  conversion_rate: null,
  sales_count: 0,
  revenue: 0,
  average_ticket: null,
  won_count: 0,
  won_amount: 0,
  lost_count: 0,
  pending_count: 0,
  pending_amount: 0,
};

// Todas as funções de relatório rodam com a RLS do usuário; vendedor é
// automaticamente restrito aos próprios indicadores no banco.
export async function getSummary(companyId: string, f: ReportFilters): Promise<Summary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_summary", {
    p_company_id: companyId,
    p_from: f.from,
    p_to: f.to,
    p_seller_id: f.seller ?? null,
    p_source_id: f.source ?? null,
    p_stage_id: f.stage ?? null,
  });
  if (error) {
    console.error("[report.summary]", error.code, error.message);
    return EMPTY;
  }
  const raw = data as Record<string, number | string | null>;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    leads_created: Number(raw.leads_created ?? 0),
    leads_converted: Number(raw.leads_converted ?? 0),
    conversion_rate: num(raw.conversion_rate),
    sales_count: Number(raw.sales_count ?? 0),
    revenue: Number(raw.revenue ?? 0),
    average_ticket: num(raw.average_ticket),
    won_count: Number(raw.won_count ?? 0),
    won_amount: Number(raw.won_amount ?? 0),
    lost_count: Number(raw.lost_count ?? 0),
    pending_count: Number(raw.pending_count ?? 0),
    pending_amount: Number(raw.pending_amount ?? 0),
  };
}

export async function getMonthly(companyId: string, f: ReportFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_monthly", {
    p_company_id: companyId,
    p_from: f.from,
    p_to: f.to,
    p_seller_id: f.seller ?? null,
  });
  if (error) console.error("[report.monthly]", error.code, error.message);
  return (data ?? []).map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    sales: Number(r.sales_count),
    leads: Number(r.leads_created),
    won: Number(r.leads_won),
  }));
}

export async function getBySeller(companyId: string, f: ReportFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_by_seller", {
    p_company_id: companyId,
    p_from: f.from,
    p_to: f.to,
  });
  if (error) console.error("[report.seller]", error.code, error.message);
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.full_name,
    status: r.member_status,
    revenue: Number(r.revenue),
    sales: Number(r.sales_count),
    leads: Number(r.leads_assigned),
    won: Number(r.leads_won),
  }));
}

export async function getBySource(companyId: string, f: ReportFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_by_source", {
    p_company_id: companyId,
    p_from: f.from,
    p_to: f.to,
    p_seller_id: f.seller ?? null,
  });
  if (error) console.error("[report.source]", error.code, error.message);
  return (data ?? []).map((r) => ({
    name: r.source_name,
    leads: Number(r.leads_created),
    won: Number(r.leads_won),
  }));
}

export async function getLostReasons(companyId: string, f: ReportFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_lost_reasons", {
    p_company_id: companyId,
    p_from: f.from,
    p_to: f.to,
    p_seller_id: f.seller ?? null,
  });
  if (error) console.error("[report.lost]", error.code, error.message);
  return (data ?? []).map((r) => ({ name: r.reason_name, total: Number(r.total) }));
}
