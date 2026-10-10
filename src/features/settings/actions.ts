"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, invalid, ok, type ActionResult } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

function refresh(slug: string) {
  if (/^[a-z0-9-]{3,48}$/.test(slug)) revalidatePath(`/app/${slug}`, "layout");
}

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------
const companySchema = z.object({
  companyId: uuid,
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$/,
      "Use 3 a 48 caracteres: letras minúsculas, números e hífens.",
    ),
  timezone: z.string().min(1).max(64),
  autoDistribution: z.boolean(),
});

export async function updateCompany(
  input: z.input<typeof companySchema> & { currentSlug: string },
): Promise<ActionResult<undefined>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_company_settings", {
    p_company_id: parsed.data.companyId,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
    p_auto_distribution: parsed.data.autoDistribution,
  });
  if (error) return dbFail(error);
  if (data && data !== input.currentSlug) redirect(`/app/${data}/configuracoes`);
  refresh(input.currentSlug);
  return ok(undefined, "Configurações salvas.");
}

// ---------------------------------------------------------------------------
// Etapas do funil
// ---------------------------------------------------------------------------
const stageName = z.string().trim().min(1, "Informe o nome.").max(60);

export async function createStage(input: {
  companyId: string;
  name: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const name = stageName.safeParse(input.name);
  if (!name.success) return invalid(name.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_stage", { p_company_id: input.companyId, p_name: name.data });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, "Etapa criada.");
}

export async function renameStage(input: {
  stageId: string;
  name: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const name = stageName.safeParse(input.name);
  if (!name.success) return invalid(name.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_stage", { p_stage_id: input.stageId, p_name: name.data });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, "Etapa renomeada.");
}

export async function reorderStages(input: {
  companyId: string;
  stageIds: string[];
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!input.stageIds.every((id) => uuid.safeParse(id).success)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_stages", {
    p_company_id: input.companyId,
    p_stage_ids: input.stageIds,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined);
}

export async function setDefaultStage(input: {
  stageId: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_default_stage", { p_stage_id: input.stageId });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, "Etapa inicial atualizada.");
}

export async function archiveStage(input: {
  stageId: string;
  targetStageId: string | null;
  slug: string;
}): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_stage", {
    p_stage_id: input.stageId,
    p_target_stage_id: input.targetStageId,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(data, data ? `Etapa removida. ${data} lead(s) movido(s).` : "Etapa removida.");
}

// ---------------------------------------------------------------------------
// Origens e motivos de perda
// ---------------------------------------------------------------------------
type OptionTable = "lead_sources" | "lost_reasons";
const optionName = z.string().trim().min(1, "Informe o nome.").max(80);

export async function createOption(input: {
  table: OptionTable;
  companyId: string;
  name: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const name = optionName.safeParse(input.name);
  if (!name.success) return invalid(name.error);
  if (!["lead_sources", "lost_reasons"].includes(input.table)) return fail("Tabela inválida.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from(input.table)
    .select("position")
    .eq("company_id", input.companyId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from(input.table)
    .insert({ company_id: input.companyId, name: name.data, position: (last?.position ?? 0) + 1 });
  if (error) return dbFail(error, "Não foi possível salvar. Verifique se o nome já existe.");
  refresh(input.slug);
  return ok(undefined, "Item adicionado.");
}

export async function updateOption(input: {
  table: OptionTable;
  id: string;
  name?: string;
  isActive?: boolean;
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!["lead_sources", "lost_reasons"].includes(input.table) || !uuid.safeParse(input.id).success) {
    return fail("Dados inválidos.");
  }
  const patch: { name?: string; is_active?: boolean } = {};
  if (input.name !== undefined) {
    const name = optionName.safeParse(input.name);
    if (!name.success) return invalid(name.error);
    patch.name = name.data;
  }
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const supabase = await createClient();
  const { data, error } = await supabase.from(input.table).update(patch).eq("id", input.id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Item não encontrado.");
  refresh(input.slug);
  return ok(undefined, input.isActive === false ? "Item desativado." : "Item atualizado.");
}

export async function deleteOption(input: {
  table: OptionTable;
  id: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!["lead_sources", "lost_reasons"].includes(input.table) || !uuid.safeParse(input.id).success) {
    return fail("Dados inválidos.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from(input.table).delete().eq("id", input.id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Item não encontrado.");
  refresh(input.slug);
  return ok(undefined, "Item excluído.");
}

// ---------------------------------------------------------------------------
// Campos personalizados
// ---------------------------------------------------------------------------
const fieldSchema = z.object({
  companyId: uuid,
  label: z.string().trim().min(1, "Informe o nome do campo.").max(80),
  fieldType: z.enum(["text", "number", "date", "select"]),
  isRequired: z.boolean(),
});

function keyFromLabel(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "c_$1")
    .slice(0, 34);
  return base || "campo";
}

export async function createField(
  input: z.input<typeof fieldSchema> & { slug: string },
): Promise<ActionResult<undefined>> {
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("custom_fields")
    .select("key, position")
    .eq("company_id", parsed.data.companyId);
  const keys = new Set((existing ?? []).map((f) => f.key));
  const base = keyFromLabel(parsed.data.label);
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;
  const position = Math.max(0, ...(existing ?? []).map((f) => f.position)) + 1;

  const { error } = await supabase.from("custom_fields").insert({
    company_id: parsed.data.companyId,
    label: parsed.data.label,
    key,
    field_type: parsed.data.fieldType,
    is_required: parsed.data.isRequired,
    position,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, "Campo criado.");
}

export async function updateField(input: {
  id: string;
  label?: string;
  isRequired?: boolean;
  isActive?: boolean;
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.id).success) return fail("Campo inválido.");
  const patch: { label?: string; is_required?: boolean; is_active?: boolean } = {};
  if (input.label !== undefined) {
    const label = z.string().trim().min(1).max(80).safeParse(input.label);
    if (!label.success) return fail("Nome inválido.");
    patch.label = label.data;
  }
  if (input.isRequired !== undefined) patch.is_required = input.isRequired;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const supabase = await createClient();
  const { data, error } = await supabase.from("custom_fields").update(patch).eq("id", input.id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Campo não encontrado.");
  refresh(input.slug);
  return ok(undefined, "Campo atualizado.");
}

export async function deleteField(input: { id: string; slug: string }): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.id).success) return fail("Campo inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("custom_fields").delete().eq("id", input.id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Campo não encontrado.");
  refresh(input.slug);
  return ok(undefined, "Campo excluído.");
}

export async function createFieldOption(input: {
  companyId: string;
  fieldId: string;
  label: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const label = optionName.safeParse(input.label);
  if (!label.success) return invalid(label.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_field_options")
    .insert({ company_id: input.companyId, field_id: input.fieldId, label: label.data });
  if (error) return dbFail(error, "Não foi possível adicionar. Verifique se a opção já existe.");
  refresh(input.slug);
  return ok(undefined, "Opção adicionada.");
}

export async function updateFieldOption(input: {
  id: string;
  isActive: boolean;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_field_options")
    .update({ is_active: input.isActive })
    .eq("id", input.id)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Opção não encontrada.");
  refresh(input.slug);
  return ok(undefined, input.isActive ? "Opção reativada." : "Opção desativada.");
}

export async function deleteFieldOption(input: {
  id: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_field_options")
    .delete()
    .eq("id", input.id)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Opção não encontrada.");
  refresh(input.slug);
  return ok(undefined, "Opção excluída.");
}
