"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/forms/submit-button";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadPicker, type PickedLead } from "@/features/leads/components/lead-picker";
import type { MemberOption } from "@/features/workspace/lookups";
import { isoToLocalInput, localInputToIso } from "@/lib/dates";
import { createTask, updateTask } from "../actions";

export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  due_at: string;
  lead: PickedLead | null;
};

function defaultDue(tz: string) {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return isoToLocalInput(d.toISOString(), tz).slice(0, 11) + "09:00";
}

export function TaskDialog({
  members,
  fixedLead,
  task,
  trigger,
}: {
  members: MemberOption[];
  fixedLead?: PickedLead;
  task?: EditableTask;
  trigger?: React.ReactNode;
}) {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(ws.userId);
  const [due, setDue] = useState("");
  const [lead, setLead] = useState<PickedLead | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const assignable = members.filter((m) => m.status === "active");

  function reset() {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setAssignee(task?.assigned_to ?? ws.userId);
    setDue(task ? isoToLocalInput(task.due_at, ws.timezone) : defaultDue(ws.timezone));
    setLead(task?.lead ?? fixedLead ?? null);
    setErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const dueAt = localInputToIso(due, ws.timezone);
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Informe o título.";
    if (!dueAt) errs.due = "Informe o prazo.";
    setErrors(errs);
    if (Object.keys(errs).length || !dueAt) return;

    startTransition(async () => {
      const payload = {
        title,
        description,
        assignedTo: ws.isAdmin ? assignee : ws.userId,
        dueAt,
        leadId: lead?.id ?? null,
        slug: ws.slug,
      };
      const r = task
        ? await updateTask({ ...payload, taskId: task.id })
        : await createTask({ ...payload, companyId: ws.companyId });
      if (r.ok) {
        toast.success(r.message);
        setOpen(false);
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger ??
          (task ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar tarefa">
              <Pencil />
            </Button>
          ) : (
            <Button>
              <Plus /> Nova tarefa
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
            <DialogDescription>Prazos usam o fuso horário da empresa ({ws.timezone}).</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field data-invalid={Boolean(errors.title)}>
              <FieldLabel htmlFor="task-title">Título</FieldLabel>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                autoFocus
              />
              {errors.title ? <FieldError>{errors.title}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="task-desc">Descrição</FieldLabel>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.due)}>
                <FieldLabel htmlFor="task-due">Prazo</FieldLabel>
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
                {errors.due ? <FieldError>{errors.due}</FieldError> : null}
              </Field>
              {ws.isAdmin ? (
                <Field>
                  <FieldLabel htmlFor="task-assignee">Responsável</FieldLabel>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger id="task-assignee" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name}
                          {m.userId === ws.userId ? " (você)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
            {fixedLead ? null : (
              <Field>
                <FieldLabel htmlFor="task-lead">Lead (opcional)</FieldLabel>
                <LeadPicker id="task-lead" value={lead} onChange={setLead} />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <SubmitButton pending={pending}>{task ? "Salvar" : "Criar tarefa"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
