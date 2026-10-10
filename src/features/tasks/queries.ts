import "server-only";
import { dayRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { TaskItem } from "./components/task-list";

export type TaskView = "hoje" | "proximas" | "atrasadas" | "concluidas";
export const TASK_VIEWS: { value: TaskView; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "atrasadas", label: "Atrasadas" },
  { value: "proximas", label: "Próximas" },
  { value: "concluidas", label: "Concluídas" },
];

const COLUMNS =
  "id, title, description, status, due_at, completed_at, assigned_to, lead:leads!tasks_lead_fk(id, name)";

export async function listTasks(
  companyId: string,
  timezone: string,
  view: TaskView,
  opts: { assignee?: string; onlyUser?: string },
) {
  const supabase = await createClient();
  const now = new Date();
  const today = dayRange(timezone, 0, now);

  let q = supabase.from("tasks").select(COLUMNS).eq("company_id", companyId);
  if (opts.onlyUser) q = q.eq("assigned_to", opts.onlyUser);
  else if (opts.assignee) q = q.eq("assigned_to", opts.assignee);

  switch (view) {
    case "hoje":
      q = q
        .eq("status", "pending")
        .gte("due_at", today.from.toISOString())
        .lt("due_at", today.to.toISOString());
      q = q.order("due_at");
      break;
    case "atrasadas":
      q = q.eq("status", "pending").lt("due_at", now.toISOString()).order("due_at");
      break;
    case "proximas":
      q = q.eq("status", "pending").gte("due_at", today.to.toISOString()).order("due_at");
      break;
    case "concluidas":
      q = q.eq("status", "done").order("completed_at", { ascending: false });
      break;
  }
  const { data, error } = await q.limit(200);
  if (error) console.error("[tasks.list]", error.code, error.message);
  return (data ?? []) as unknown as TaskItem[];
}

export async function countTasks(companyId: string, timezone: string, onlyUser?: string) {
  const supabase = await createClient();
  const now = new Date();
  const today = dayRange(timezone, 0, now);
  const base = () => {
    let q = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");
    if (onlyUser) q = q.eq("assigned_to", onlyUser);
    return q;
  };
  const [overdue, todayCount] = await Promise.all([
    base().lt("due_at", now.toISOString()),
    base().gte("due_at", today.from.toISOString()).lt("due_at", today.to.toISOString()),
  ]);
  return { overdue: overdue.count ?? 0, today: todayCount.count ?? 0 };
}
