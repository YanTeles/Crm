"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/forms/money-input";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadPicker, type PickedLead } from "@/features/leads/components/lead-picker";
import type { MemberOption } from "@/features/workspace/lookups";
import { isoToLocalInput, localDateToIso, todayInZone } from "@/lib/dates";
import { createSale, updateSale } from "../actions";

export type EditableSale = {
  id: string;
  description: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
  seller_id: string;
  row_version: number;
};

function today(tz: string) {
  const t = todayInZone(tz);
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

// Data informada (dia) → meio-dia no fuso da empresa; hoje → agora (evita data futura).
function dateToIso(value: string, tz: string) {
  if (value === today(tz)) return new Date().toISOString();
  const start = localDateToIso(value, tz);
  return start ? new Date(new Date(start).getTime() + 12 * 3600 * 1000).toISOString() : null;
}

export function SaleDialog({
  members,
  fixedLead,
  defaultSeller,
  sale,
}: {
  members: MemberOption[];
  fixedLead?: PickedLead;
  defaultSeller?: string | null;
  sale?: EditableSale;
}) {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [lead, setLead] = useState<PickedLead | null>(fixedLead ?? null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [status, setStatus] = useState<"pending" | "completed">("completed");
  const [date, setDate] = useState(today(ws.timezone));
  const [seller, setSeller] = useState<string>(defaultSeller ?? ws.userId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);

  function reset() {
    setRequestId(crypto.randomUUID());
    setLead(fixedLead ?? null);
    setDescription(sale?.description ?? "");
    setAmount(sale?.amount ?? null);
    setStatus("completed");
    setDate(
      sale?.completed_at ? isoToLocalInput(sale.completed_at, ws.timezone).slice(0, 10) : today(ws.timezone),
    );
    setSeller(sale?.seller_id ?? defaultSeller ?? ws.userId);
    setErrors({});
    setFormKey((k) => k + 1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!sale && !lead) errs.lead = "Selecione o lead.";
    if (!description.trim()) errs.description = "Informe a descrição.";
    if (amount === null || amount <= 0) errs.amount = "Informe um valor maior que zero.";
    const completedAt = (sale ? sale.status === "completed" : status === "completed")
      ? dateToIso(date, ws.timezone)
      : null;
    setErrors(errs);
    if (Object.keys(errs).length || amount === null) return;

    startTransition(async () => {
      const r = sale
        ? await updateSale({
            saleId: sale.id,
            description,
            amount,
            completedAt,
            sellerId: ws.isAdmin ? seller : null,
            version: sale.row_version,
            slug: ws.slug,
          })
        : await createSale({
            leadId: lead!.id,
            description,
            amount,
            status,
            completedAt,
            sellerId: ws.isAdmin ? seller : null,
            clientRequestId: requestId,
            slug: ws.slug,
          });
      if (r.ok) {
        toast.success(r.message);
        setOpen(false);
      } else toast.error(r.error);
    });
  }

  const sellers = members.filter((m) => m.status === "active");
  const showDate = sale ? sale.status === "completed" : status === "completed";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {sale ? (
          <Button variant="ghost" size="icon-sm" aria-label="Editar venda">
            <Pencil />
          </Button>
        ) : (
          <Button variant={fixedLead ? "outline" : "default"}>
            <Plus /> Registrar venda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate key={formKey}>
          <DialogHeader>
            <DialogTitle>{sale ? "Editar venda" : "Registrar venda"}</DialogTitle>
            <DialogDescription>
              Cada venda é uma transação independente. Apenas vendas concluídas entram no faturamento.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            {!sale && !fixedLead ? (
              <Field data-invalid={Boolean(errors.lead)}>
                <FieldLabel htmlFor="sale-lead">Lead</FieldLabel>
                <LeadPicker id="sale-lead" value={lead} onChange={setLead} allowEmpty={false} />
                {errors.lead ? <FieldError>{errors.lead}</FieldError> : null}
              </Field>
            ) : null}
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="sale-desc">Produto ou serviço</FieldLabel>
              <Input
                id="sale-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
              {errors.description ? <FieldError>{errors.description}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="sale-amount">Valor</FieldLabel>
              <MoneyInput
                id="sale-amount"
                value={amount}
                onChange={setAmount}
                invalid={Boolean(errors.amount)}
              />
              {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
            </Field>
            {!sale ? (
              <RadioGroup
                value={status}
                onValueChange={(v) => setStatus(v as "pending" | "completed")}
                className="flex gap-6"
              >
                <Field orientation="horizontal">
                  <RadioGroupItem value="completed" id="sale-completed" />
                  <FieldLabel htmlFor="sale-completed" className="font-normal">
                    Concluída
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="pending" id="sale-pending" />
                  <FieldLabel htmlFor="sale-pending" className="font-normal">
                    Pendente
                  </FieldLabel>
                </Field>
              </RadioGroup>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {showDate ? (
                <Field>
                  <FieldLabel htmlFor="sale-date">Data de conclusão</FieldLabel>
                  <Input
                    id="sale-date"
                    type="date"
                    max={today(ws.timezone)}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              ) : null}
              {ws.isAdmin ? (
                <Field>
                  <FieldLabel htmlFor="sale-seller">Vendedor</FieldLabel>
                  <Select value={seller} onValueChange={setSeller}>
                    <SelectTrigger id="sale-seller" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          </FieldGroup>
          <DialogFooter>
            <SubmitButton pending={pending}>{sale ? "Salvar" : "Registrar venda"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
