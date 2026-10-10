"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/forms/money-input";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { NamedOption } from "@/features/workspace/lookups";
import { markLeadLost, markLeadWon } from "../actions";

type LeadRef = { id: string; name: string; row_version: number };

export function WonDialog({
  lead,
  open,
  onOpenChange,
  onDone,
}: {
  lead: LeadRef | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [amount, setAmount] = useState<number | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setAmount(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como ganho</DialogTitle>
          <DialogDescription>
            {lead?.name}. O valor do ganho é usado nos indicadores de oportunidades e não entra no faturamento
            — registre as vendas separadamente.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-2">
          <Field>
            <FieldLabel htmlFor="won-amount">Valor do ganho</FieldLabel>
            {open ? <MoneyInput id="won-amount" value={amount} onChange={setAmount} autoFocus /> : null}
            <FieldDescription>Obrigatório. Informe 0,00 se não houver valor.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={amount === null || pending || !lead}
            onClick={() =>
              lead &&
              amount !== null &&
              run(() => markLeadWon({ leadId: lead.id, amount, version: lead.row_version, slug: ws.slug }), {
                onSuccess: () => {
                  onOpenChange(false);
                  onDone?.();
                },
              })
            }
          >
            {pending ? <Spinner /> : null} Confirmar ganho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LostDialog({
  lead,
  reasons,
  open,
  onOpenChange,
  onDone,
}: {
  lead: LeadRef | null;
  reasons: NamedOption[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const active = reasons.filter((r) => r.is_active);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setReasonId("");
          setNote("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como perdido</DialogTitle>
          <DialogDescription>
            {lead?.name}. O motivo é obrigatório e alimenta o relatório de perdas.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-2">
          <Field>
            <FieldLabel htmlFor="lost-reason">Motivo</FieldLabel>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger id="lost-reason" className="w-full">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {active.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!active.length ? (
              <FieldDescription>
                Nenhum motivo ativo. Um administrador precisa cadastrar motivos.
              </FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="lost-note">Observação (opcional)</FieldLabel>
            <Textarea
              id="lost-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!reasonId || pending || !lead}
            onClick={() =>
              lead &&
              run(
                () =>
                  markLeadLost({ leadId: lead.id, reasonId, note, version: lead.row_version, slug: ws.slug }),
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    onDone?.();
                  },
                },
              )
            }
          >
            {pending ? <Spinner /> : null} Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
