"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, invalid, ok, type ActionResult } from "@/lib/action";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  assignmentSchema,
  interactionSchema,
  leadFormSchema,
  lostSchema,
  uuid,
  version,
  wonSchema,
  type Assignment,
  type LeadFormInput,
  type LeadFormValues,
} from "./schemas";

function refresh(slug: string) {
  if (/^[a-z0-9-]{3,48}$/.test(slug)) revalidatePath(`/app/${slug}`, "layout");
}

function toPayload(v: LeadFormValues) {
  return {
    name: v.name,
    phone_raw: v.phone,
    phone_normalized: normalizePhone(v.phone),
    email: v.email,
    customer_company: v.customerCompany,
    source_id: v.sourceId,
    notes: v.notes,
  };
}

export type CreateLeadResult = {
  lead_id: string;
  assigned_to: string | null;
  method: string | null;
  no_active_sellers: boolean;
  replayed: boolean;
};

export async function createLead(input: {
  companyId: string;
  slug: string;
  values: LeadFormInput;
  assignment: Assignment;
  clientRequestId: string;
}): Promise<ActionResult<CreateLeadResult>> {
  const values = leadFormSchema.safeParse(input.values);
  if (!values.success) return invalid(values.error);
  const assignment = assignmentSchema.safeParse(input.assignment);
  if (!assignment.success) return invalid(assignment.error);
  if (!uuid.safeParse(input.companyId).success || !uuid.safeParse(input.clientRequestId).success) {
    return fail("Requisição inválida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lead", {
    p_company_id: input.companyId,
    p_data: toPayload(values.data) as Json,
    p_custom_values: values.data.customValues as Json,
    p_assignment_mode: assignment.data.mode,
    p_assignee: assignment.data.mode === "manual" ? assignment.data.assignee : null,
    p_client_request_id: input.clientRequestId,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  const result = data as unknown as CreateLeadResult;
  return ok(
    result,
    result.no_active_sellers
      ? "Lead cadastrado sem responsável: não há vendedores ativos para o rodízio."
      : "Lead cadastrado.",
  );
}

export async function updateLead(input: {
  leadId: string;
  slug: string;
  values: LeadFormInput;
  version?: number;
}): Promise<ActionResult<number>> {
  const values = leadFormSchema.safeParse(input.values);
  if (!values.success) return invalid(values.error);
  if (!uuid.safeParse(input.leadId).success) return fail("Lead inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_lead", {
    p_lead_id: input.leadId,
    p_data: toPayload(values.data) as Json,
    p_custom_values: values.data.customValues as Json,
    p_expected_version: input.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Lead atualizado.");
}

export type DuplicateCheck = {
  visible: {
    id: string;
    name: string;
    outcome: string;
    archived: boolean;
    assigned_name: string | null;
    created_at: string;
  }[];
  hidden_count: number;
};

export async function checkDuplicates(input: {
  companyId: string;
  phone: string;
  excludeLeadId?: string;
}): Promise<ActionResult<DuplicateCheck>> {
  const phone = normalizePhone(input.phone);
  if (!phone || !uuid.safeParse(input.companyId).success) return ok({ visible: [], hidden_count: 0 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_possible_duplicates", {
    p_company_id: input.companyId,
    p_phone_normalized: phone,
    p_exclude_lead_id: input.excludeLeadId ?? null,
  });
  if (error) return dbFail(error);
  return ok(data as unknown as DuplicateCheck);
}

const assignInput = z.object({
  leadId: uuid,
  assignee: uuid.nullable(),
  version,
  transferTasks: z.boolean().default(true),
});

export async function assignLead(
  input: z.input<typeof assignInput> & { slug: string },
): Promise<ActionResult<number>> {
  const parsed = assignInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_lead", {
    p_lead_id: parsed.data.leadId,
    p_assignee: parsed.data.assignee,
    p_expected_version: parsed.data.version ?? null,
    p_transfer_tasks: parsed.data.transferTasks,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, parsed.data.assignee ? "Responsável atualizado." : "Lead ficou sem responsável.");
}

const transferInput = z.object({
  companyId: uuid,
  fromUser: uuid,
  toUser: uuid.nullable(),
  transferTasks: z.boolean().default(true),
});

export async function transferMemberLeads(
  input: z.input<typeof transferInput> & { slug: string },
): Promise<ActionResult<number>> {
  const parsed = transferInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transfer_member_leads", {
    p_company_id: parsed.data.companyId,
    p_from_user: parsed.data.fromUser,
    p_to_user: parsed.data.toUser,
    p_transfer_tasks: parsed.data.transferTasks,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, `${data} lead(s) transferido(s).`);
}

export async function moveLeadStage(input: {
  leadId: string;
  stageId: string;
  version?: number;
  slug: string;
}): Promise<ActionResult<number>> {
  if (!uuid.safeParse(input.leadId).success || !uuid.safeParse(input.stageId).success)
    return fail("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_lead_stage", {
    p_lead_id: input.leadId,
    p_to_stage_id: input.stageId,
    p_expected_version: input.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data);
}

export async function markLeadWon(
  input: z.input<typeof wonSchema> & { slug: string },
): Promise<ActionResult<number>> {
  const parsed = wonSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_lead_won", {
    p_lead_id: parsed.data.leadId,
    p_amount: parsed.data.amount,
    p_expected_version: parsed.data.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Oportunidade marcada como ganha.");
}

export async function markLeadLost(
  input: z.input<typeof lostSchema> & { slug: string },
): Promise<ActionResult<number>> {
  const parsed = lostSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_lead_lost", {
    p_lead_id: parsed.data.leadId,
    p_reason_id: parsed.data.reasonId,
    p_note: parsed.data.note ?? null,
    p_expected_version: parsed.data.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Oportunidade marcada como perdida.");
}

export async function reopenLead(input: {
  leadId: string;
  stageId?: string | null;
  version?: number;
  slug: string;
}): Promise<ActionResult<number>> {
  if (!uuid.safeParse(input.leadId).success) return fail("Lead inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reopen_lead", {
    p_lead_id: input.leadId,
    p_to_stage_id: input.stageId ?? null,
    p_expected_version: input.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, "Oportunidade reaberta.");
}

export async function setLeadArchived(input: {
  leadId: string;
  archived: boolean;
  version?: number;
  slug: string;
}): Promise<ActionResult<number>> {
  if (!uuid.safeParse(input.leadId).success) return fail("Lead inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_lead_archived", {
    p_lead_id: input.leadId,
    p_archived: input.archived,
    p_expected_version: input.version ?? null,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, input.archived ? "Lead arquivado." : "Lead restaurado.");
}

export async function addInteraction(
  input: z.input<typeof interactionSchema> & { companyId: string; slug: string },
): Promise<ActionResult<undefined>> {
  const parsed = interactionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!uuid.safeParse(input.companyId).success) return fail("Requisição inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_interactions").insert({
    company_id: input.companyId,
    lead_id: parsed.data.leadId,
    kind: parsed.data.kind,
    channel: parsed.data.kind === "contact" ? (parsed.data.channel ?? null) : null,
    content: parsed.data.content,
    ...(parsed.data.occurredAt ? { occurred_at: parsed.data.occurredAt } : {}),
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, parsed.data.kind === "contact" ? "Contato registrado." : "Observação registrada.");
}
