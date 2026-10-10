"use client";

import { useState } from "react";
import { Ban, CheckCircle2, MoreHorizontal } from "lucide-react";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { MemberOption } from "@/features/workspace/lookups";
import { cancelSale, completeSale } from "../actions";
import { SaleDialog, type EditableSale } from "./sale-dialog";

// D2: vendedor altera só as próprias vendas pendentes; admin altera qualquer venda não cancelada.
export function SaleRowActions({ sale, members }: { sale: EditableSale; members: MemberOption[] }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canEdit =
    sale.status !== "cancelled" &&
    (ws.isAdmin || (sale.status === "pending" && sale.seller_id === ws.userId));
  if (!canEdit) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      <SaleDialog members={members} sale={sale} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Mais ações" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sale.status === "pending" ? (
            <DropdownMenuItem
              onSelect={() =>
                run(() => completeSale({ saleId: sale.id, version: sale.row_version, slug: ws.slug }))
              }
            >
              <CheckCircle2 /> Marcar como concluída
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setCancelOpen(true)}>
            <Ban /> Cancelar venda
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda</AlertDialogTitle>
            <AlertDialogDescription>
              O registro é preservado e deixa de compor o faturamento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={`cancel-${sale.id}`}>Motivo</FieldLabel>
            <Textarea
              id={`cancel-${sale.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!reason.trim() || pending}
              onClick={() =>
                run(() => cancelSale({ saleId: sale.id, reason, version: sale.row_version, slug: ws.slug }), {
                  onSuccess: () => setCancelOpen(false),
                })
              }
            >
              Cancelar venda
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
