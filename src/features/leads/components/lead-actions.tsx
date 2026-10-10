"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  MessageCircle,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  UserRoundCog,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClientLookups } from "@/features/workspace/lookups";
import { whatsappUrl } from "@/lib/phone";
import type { Tables } from "@/types/database";
import { assignLead, moveLeadStage, reopenLead, setLeadArchived } from "../actions";
import { LostDialog, WonDialog } from "./close-dialogs";

type Lead = Pick<
  Tables<"leads">,
  "id" | "name" | "stage_id" | "outcome" | "assigned_to" | "archived_at" | "row_version" | "phone_normalized"
>;

const NONE = "__none__";

export function LeadActions({ lead, lookups }: { lead: Lead; lookups: ClientLookups }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const archived = Boolean(lead.archived_at);
  const openStages = lookups.stages.filter((s) => s.kind === "open" && !s.archived_at);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <a href={whatsappUrl(lead.phone_normalized)} target="_blank" rel="noopener noreferrer">
          <MessageCircle /> WhatsApp
        </a>
      </Button>

      {!archived && lead.outcome === "open" ? (
        <>
          <Select
            value={lead.stage_id}
            disabled={pending}
            onValueChange={(stageId) =>
              run(
                () => moveLeadStage({ leadId: lead.id, stageId, version: lead.row_version, slug: ws.slug }),
                {
                  successMessage: "Etapa atualizada.",
                },
              )
            }
          >
            <SelectTrigger className="w-44" aria-label="Etapa do funil">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {openStages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setWonOpen(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-600/90"
          >
            <ThumbsUp /> Ganho
          </Button>
          <Button variant="destructive" onClick={() => setLostOpen(true)}>
            <ThumbsDown /> Perdido
          </Button>
        </>
      ) : null}

      {!archived && lead.outcome !== "open" ? <ReopenDialog lead={lead} lookups={lookups} /> : null}
      {ws.isAdmin && !archived ? <AssignDialog lead={lead} lookups={lookups} /> : null}

      {ws.isAdmin ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" disabled={pending}>
              {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restaurar" : "Arquivar"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{archived ? "Restaurar lead?" : "Arquivar lead?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {archived
                  ? "O lead volta a aparecer nas listas e no funil."
                  : "O lead sai das listas e do funil, mas o histórico, tarefas e vendas são preservados."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(() =>
                    setLeadArchived({
                      leadId: lead.id,
                      archived: !archived,
                      version: lead.row_version,
                      slug: ws.slug,
                    }),
                  )
                }
              >
                {archived ? "Restaurar" : "Arquivar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <WonDialog lead={lead} open={wonOpen} onOpenChange={setWonOpen} />
      <LostDialog lead={lead} reasons={lookups.reasons} open={lostOpen} onOpenChange={setLostOpen} />
    </div>
  );
}

function ReopenDialog({ lead, lookups }: { lead: Lead; lookups: ClientLookups }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const stages = lookups.stages.filter((s) => s.kind === "open" && !s.archived_at);
  const [stageId, setStageId] = useState(stages.find((s) => s.is_default)?.id ?? stages[0]?.id ?? "");

  if (!ws.isAdmin && lead.assigned_to !== ws.userId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw /> Reabrir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir oportunidade</DialogTitle>
          <DialogDescription>O fechamento anterior fica registrado no histórico.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="reopen-stage">Voltar para a etapa</FieldLabel>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger id="reopen-stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => reopenLead({ leadId: lead.id, stageId, version: lead.row_version, slug: ws.slug }), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ lead, lookups }: { lead: Lead; lookups: ClientLookups }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState(lead.assigned_to ?? NONE);
  const [transferTasks, setTransferTasks] = useState(true);
  const sellers = lookups.members.filter((m) => m.role === "seller" && m.status === "active");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setAssignee(lead.assigned_to ?? NONE);
          setTransferTasks(true);
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserRoundCog /> {lead.assigned_to ? "Transferir" : "Atribuir"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsável pelo lead</DialogTitle>
          <DialogDescription>A atribuição manual não altera a ordem do rodízio automático.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="assign-to">Vendedor</FieldLabel>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger id="assign-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {sellers.map((s) => (
                  <SelectItem key={s.userId} value={s.userId}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {lead.assigned_to && assignee !== NONE ? (
            <Field orientation="horizontal">
              <Checkbox
                id="transfer-tasks"
                checked={transferTasks}
                onCheckedChange={(v) => setTransferTasks(v === true)}
              />
              <FieldLabel htmlFor="transfer-tasks" className="font-normal">
                Transferir também as tarefas pendentes deste lead
              </FieldLabel>
            </Field>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={pending || assignee === (lead.assigned_to ?? NONE)}
            onClick={() =>
              run(
                () =>
                  assignLead({
                    leadId: lead.id,
                    assignee: assignee === NONE ? null : assignee,
                    version: lead.row_version,
                    transferTasks,
                    slug: ws.slug,
                  }),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
