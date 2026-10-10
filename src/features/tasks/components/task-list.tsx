"use client";

import Link from "next/link";
import { CalendarClock, ListChecks, Trash2 } from "lucide-react";
import { TaskStatusBadge } from "@/components/data/status-badges";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { MemberOption } from "@/features/workspace/lookups";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteTask, setTaskDone } from "../actions";
import { TaskDialog } from "./task-dialog";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "done";
  due_at: string;
  completed_at: string | null;
  assigned_to: string;
  lead: { id: string; name: string } | null;
};

export function TaskList({
  tasks,
  members,
  showLead = true,
  emptyText = "Nenhuma tarefa.",
  now,
}: {
  tasks: TaskItem[];
  members: MemberOption[];
  showLead?: boolean;
  emptyText?: string;
  now: string;
}) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const nowMs = new Date(now).getTime();

  if (!tasks.length) {
    return (
      <Empty className="rounded-xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>Nada por aqui</EmptyTitle>
          <EmptyDescription>{emptyText}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="bg-card divide-y rounded-xl border">
      {tasks.map((t) => {
        const overdue = t.status === "pending" && new Date(t.due_at).getTime() < nowMs;
        const canEdit = ws.isAdmin || t.assigned_to === ws.userId;
        const assignee = members.find((m) => m.userId === t.assigned_to)?.name;
        return (
          <li key={t.id} className="flex items-start gap-3 p-3 sm:p-4">
            <Checkbox
              className="mt-0.5"
              checked={t.status === "done"}
              disabled={!canEdit || pending}
              aria-label={t.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}
              onCheckedChange={(v) =>
                run(() => setTaskDone({ taskId: t.id, done: v === true, slug: ws.slug }))
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn("font-medium", t.status === "done" && "text-muted-foreground line-through")}
                >
                  {t.title}
                </span>
                <TaskStatusBadge status={t.status} overdue={overdue} />
              </div>
              {t.description ? (
                <p className="text-muted-foreground mt-0.5 text-sm whitespace-pre-line">{t.description}</p>
              ) : null}
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    overdue && "text-rose-600 dark:text-rose-400",
                  )}
                >
                  <CalendarClock className="size-3.5" aria-hidden />
                  {formatDateTime(t.due_at, ws.timezone)}
                </span>
                {showLead && t.lead ? (
                  <Link
                    href={`/app/${ws.slug}/leads/${t.lead.id}`}
                    className="hover:text-foreground underline"
                  >
                    {t.lead.name}
                  </Link>
                ) : null}
                {ws.isAdmin && assignee ? <span>Responsável: {assignee}</span> : null}
              </div>
            </div>
            {canEdit ? (
              <div className="flex items-center gap-1">
                <TaskDialog members={members} task={{ ...t, lead: t.lead }} />
                {ws.isAdmin ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Excluir tarefa">
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => run(() => deleteTask({ taskId: t.id, slug: ws.slug }))}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
