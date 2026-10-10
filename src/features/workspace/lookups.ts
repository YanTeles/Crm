import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";

export type StageOption = Pick<
  Tables<"pipeline_stages">,
  "id" | "name" | "kind" | "position" | "is_default" | "archived_at"
>;
export type NamedOption = { id: string; name: string; is_active: boolean };
export type MemberOption = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: Enums<"member_role">;
  status: Enums<"member_status">;
};
export type CustomFieldDef = Pick<
  Tables<"custom_fields">,
  "id" | "label" | "key" | "field_type" | "is_required" | "is_active" | "position"
> & { options: { id: string; label: string; is_active: boolean }[] };

// Dados de apoio da empresa (RLS garante o escopo). Deduplicado por requisição.
export const getLookups = cache(async (companyId: string) => {
  const supabase = await createClient();
  const [stages, sources, reasons, members, fields, options] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, kind, position, is_default, archived_at")
      .eq("company_id", companyId)
      .order("position"),
    supabase
      .from("lead_sources")
      .select("id, name, is_active")
      .eq("company_id", companyId)
      .order("position")
      .order("name"),
    supabase
      .from("lost_reasons")
      .select("id, name, is_active")
      .eq("company_id", companyId)
      .order("position")
      .order("name"),
    supabase
      .from("company_members")
      .select("id, user_id, role, status, profiles!company_members_user_id_fkey(full_name, email)")
      .eq("company_id", companyId)
      .order("joined_at"),
    supabase
      .from("custom_fields")
      .select("id, label, key, field_type, is_required, is_active, position")
      .eq("company_id", companyId)
      .order("position")
      .order("label"),
    supabase
      .from("custom_field_options")
      .select("id, field_id, label, is_active, position")
      .eq("company_id", companyId)
      .order("position")
      .order("label"),
  ]);

  const memberList: MemberOption[] = (members.data ?? []).map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    name: m.profiles?.full_name ?? "—",
    email: m.profiles?.email ?? "",
    role: m.role,
    status: m.status,
  }));

  const customFields: CustomFieldDef[] = (fields.data ?? []).map((f) => ({
    ...f,
    options: (options.data ?? []).filter((o) => o.field_id === f.id),
  }));

  return {
    stages: (stages.data ?? []) as StageOption[],
    sources: (sources.data ?? []) as NamedOption[],
    reasons: (reasons.data ?? []) as NamedOption[],
    members: memberList,
    customFields,
    memberName: (userId: string | null) => memberList.find((m) => m.userId === userId)?.name ?? null,
  };
});

export type Lookups = Awaited<ReturnType<typeof getLookups>>;

// Versão serializável para Client Components.
export function clientLookups(l: Lookups) {
  return {
    stages: l.stages,
    sources: l.sources,
    reasons: l.reasons,
    members: l.members,
    customFields: l.customFields,
  };
}
export type ClientLookups = ReturnType<typeof clientLookups>;
