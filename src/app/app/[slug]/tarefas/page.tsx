import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskList } from "@/features/tasks/components/task-list";
import { countTasks, listTasks, TASK_VIEWS, type TaskView } from "@/features/tasks/queries";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tarefas" };

const EMPTY: Record<TaskView, string> = {
  hoje: "Nenhuma tarefa para hoje.",
  atrasadas: "Nenhuma tarefa atrasada. Muito bem!",
  proximas: "Nenhuma tarefa futura.",
  concluidas: "Nenhuma tarefa concluída ainda.",
};

export default async function TasksPage({ params, searchParams }: PageProps<"/app/[slug]/tarefas">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug);
  const sp = await searchParams;
  const view = (TASK_VIEWS.find((v) => v.value === sp.visao)?.value ?? "hoje") as TaskView;
  const assignee =
    ws.isAdmin && typeof sp.responsavel === "string" && /^[0-9a-f-]{36}$/i.test(sp.responsavel)
      ? sp.responsavel
      : undefined;
  const onlyUser = ws.isAdmin ? assignee : ws.user.id;

  const [lookups, tasks, counts] = await Promise.all([
    getLookups(ws.company.id),
    listTasks(ws.company.id, ws.company.timezone, view, { onlyUser }),
    countTasks(ws.company.id, ws.company.timezone, onlyUser),
  ]);
  const cl = clientLookups(lookups);

  return (
    <>
      <PageHeader
        title={ws.isAdmin ? "Tarefas" : "Minhas tarefas"}
        description="Prazos no fuso horário da empresa. Tarefas atrasadas geram alertas internos."
        actions={<TaskDialog members={cl.members} />}
      />
      <TaskFilters views={TASK_VIEWS} counts={counts} members={cl.members} isAdmin={ws.isAdmin} />
      <TaskList tasks={tasks} members={cl.members} emptyText={EMPTY[view]} now={new Date().toISOString()} />
    </>
  );
}
