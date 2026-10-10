"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, invalid, ok, type ActionResult } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => v || null),
  assignedTo: z.string().uuid("Selecione o responsável."),
  dueAt: z.string().datetime({ offset: true, message: "Informe o prazo." }),
  leadId: z.string().uuid().nullable().optional(),
});
export type TaskInput = z.input<typeof taskSchema>;

const uuid = z.string().uuid();

function refresh(slug: string) {
  if (/^[a-z0-9-]{3,48}$/.test(slug)) revalidatePath(`/app/${slug}`, "layout");
}

export async function createTask(
  input: TaskInput & { companyId: string; slug: string },
): Promise<ActionResult<undefined>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!uuid.safeParse(input.companyId).success) return fail("Requisição inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    company_id: input.companyId,
    lead_id: parsed.data.leadId ?? null,
    title: parsed.data.title,
    description: parsed.data.description,
    assigned_to: parsed.data.assignedTo,
    due_at: parsed.data.dueAt,
  });
  if (error) return dbFail(error, "Não foi possível criar a tarefa. Verifique o responsável e o lead.");
  refresh(input.slug);
  return ok(undefined, "Tarefa criada.");
}

export async function updateTask(
  input: TaskInput & { taskId: string; slug: string },
): Promise<ActionResult<undefined>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!uuid.safeParse(input.taskId).success) return fail("Tarefa inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      assigned_to: parsed.data.assignedTo,
      due_at: parsed.data.dueAt,
      lead_id: parsed.data.leadId ?? null,
    })
    .eq("id", input.taskId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Tarefa não encontrada ou sem permissão.");
  refresh(input.slug);
  return ok(undefined, "Tarefa atualizada.");
}

export async function setTaskDone(input: {
  taskId: string;
  done: boolean;
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.taskId).success) return fail("Tarefa inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: input.done ? "done" : "pending" })
    .eq("id", input.taskId)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Tarefa não encontrada ou sem permissão.");
  refresh(input.slug);
  return ok(undefined, input.done ? "Tarefa concluída." : "Tarefa reaberta.");
}

export async function deleteTask(input: { taskId: string; slug: string }): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.taskId).success) return fail("Tarefa inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", input.taskId).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail("Somente administradores excluem tarefas.");
  refresh(input.slug);
  return ok(undefined, "Tarefa excluída.");
}
