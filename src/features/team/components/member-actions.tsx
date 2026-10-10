"use client";

import { useState } from "react";
import { ArrowRightLeft, MoreHorizontal, ShieldCheck, UserCheck, UserRound, UserX } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transferMemberLeads } from "@/features/leads/actions";
import type { MemberOption } from "@/features/workspace/lookups";
import { setMemberRole, setMemberStatus } from "../actions";

const NONE = "__none__";

export function MemberActions({
  member,
  members,
  leadCount,
}: {
  member: MemberOption;
  members: MemberOption[];
  leadCount: number;
}) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [confirm, setConfirm] = useState<null | "deactivate" | "promote" | "demote">(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [target, setTarget] = useState(NONE);
  const [transferTasks, setTransferTasks] = useState(true);
  const isSelf = member.userId === ws.userId;
  const sellers = members.filter(
    (m) => m.role === "seller" && m.status === "active" && m.userId !== member.userId,
  );

  const confirmText = {
    deactivate: {
      title: `Desativar ${member.name}?`,
      body: `O acesso é bloqueado imediatamente. ${leadCount ? `${leadCount} lead(s) continuam atribuídos a esta pessoa até você transferi-los.` : ""} O histórico é preservado.`,
      action: () => setMemberStatus({ memberId: member.memberId, status: "inactive", slug: ws.slug }),
    },
    promote: {
      title: `Promover ${member.name} a administrador?`,
      body: "Administradores veem todos os dados da empresa e gerenciam equipe e configurações. Os leads do vendedor precisam ser redistribuídos antes.",
      action: () => setMemberRole({ memberId: member.memberId, role: "admin", slug: ws.slug }),
    },
    demote: {
      title: `Alterar ${member.name} para vendedor?`,
      body: "A pessoa passará a ver somente os leads atribuídos a ela.",
      action: () => setMemberRole({ memberId: member.memberId, role: "seller", slug: ws.slug }),
    },
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${member.name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {member.status === "active" && member.role === "seller" ? (
            <DropdownMenuItem onSelect={() => setConfirm("promote")}>
              <ShieldCheck /> Promover a administrador
            </DropdownMenuItem>
          ) : null}
          {member.status === "active" && member.role === "admin" ? (
            <DropdownMenuItem onSelect={() => setConfirm("demote")}>
              <UserRound /> Alterar para vendedor
            </DropdownMenuItem>
          ) : null}
          {leadCount > 0 ? (
            <DropdownMenuItem
              onSelect={() => {
                setTarget(NONE);
                setTransferTasks(true);
                setTransferOpen(true);
              }}
            >
              <ArrowRightLeft /> Transferir leads ({leadCount})
            </DropdownMenuItem>
          ) : null}
          {!isSelf ? <DropdownMenuSeparator /> : null}
          {!isSelf && member.status === "active" ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("deactivate")}>
              <UserX /> Desativar acesso
            </DropdownMenuItem>
          ) : null}
          {member.status === "inactive" ? (
            <DropdownMenuItem
              onSelect={() =>
                run(() => setMemberStatus({ memberId: member.memberId, status: "active", slug: ws.slug }))
              }
            >
              <UserCheck /> Reativar acesso
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmText[confirm].title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmText[confirm].body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(confirmText[confirm].action)}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir leads de {member.name}</DialogTitle>
            <DialogDescription>
              {leadCount} lead(s) serão transferidos. Cada transferência fica registrada no histórico do lead.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="transfer-target">Novo responsável</FieldLabel>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="transfer-target" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Deixar sem responsável</SelectItem>
                  {sellers.map((s) => (
                    <SelectItem key={s.userId} value={s.userId}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {target !== NONE ? (
              <Field orientation="horizontal">
                <Checkbox
                  id="transfer-member-tasks"
                  checked={transferTasks}
                  onCheckedChange={(v) => setTransferTasks(v === true)}
                />
                <FieldLabel htmlFor="transfer-member-tasks" className="font-normal">
                  Transferir também as tarefas pendentes desses leads
                </FieldLabel>
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    transferMemberLeads({
                      companyId: ws.companyId,
                      fromUser: member.userId,
                      toUser: target === NONE ? null : target,
                      transferTasks,
                      slug: ws.slug,
                    }),
                  { onSuccess: () => setTransferOpen(false) },
                )
              }
            >
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
