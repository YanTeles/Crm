"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/forms/submit-button";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateCompany } from "../actions";

const TIMEZONES = [
  ["America/Sao_Paulo", "Brasília (SP, RJ, MG, Sul, GO, DF…)"],
  ["America/Bahia", "Bahia"],
  ["America/Fortaleza", "Fortaleza (CE, RN, PB, PI, MA)"],
  ["America/Recife", "Recife (PE)"],
  ["America/Maceio", "Maceió (AL, SE)"],
  ["America/Belem", "Belém (PA leste, AP)"],
  ["America/Santarem", "Santarém (PA oeste)"],
  ["America/Araguaina", "Araguaína (TO)"],
  ["America/Manaus", "Manaus (AM)"],
  ["America/Cuiaba", "Cuiabá (MT)"],
  ["America/Campo_Grande", "Campo Grande (MS)"],
  ["America/Porto_Velho", "Porto Velho (RO)"],
  ["America/Boa_Vista", "Boa Vista (RR)"],
  ["America/Rio_Branco", "Rio Branco (AC)"],
  ["America/Noronha", "Fernando de Noronha"],
  ["Europe/Lisbon", "Lisboa"],
  ["UTC", "UTC"],
] as const;

export function CompanyForm() {
  const ws = useWorkspace();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(ws.companyName);
  const [slug, setSlug] = useState(ws.slug);
  const [timezone, setTimezone] = useState(ws.timezone);
  const [auto, setAuto] = useState(ws.autoDistribution);
  const known = TIMEZONES.some(([tz]) => tz === ws.timezone);

  return (
    <form
      className="max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateCompany({
            companyId: ws.companyId,
            name,
            slug,
            timezone,
            autoDistribution: auto,
            currentSlug: ws.slug,
          });
          if (!r) return;
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="company-name">Nome da empresa</FieldLabel>
          <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field>
          <FieldLabel htmlFor="company-slug">Endereço</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>/app/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="company-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              maxLength={48}
            />
          </InputGroup>
          <FieldDescription>
            Alterar o endereço invalida links antigos. Os dados não são afetados.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="company-tz">Fuso horário</FieldLabel>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="company-tz" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!known ? <SelectItem value={ws.timezone}>{ws.timezone}</SelectItem> : null}
              {TIMEZONES.map(([tz, label]) => (
                <SelectItem key={tz} value={tz}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Usado em prazos de tarefas, “hoje” e agrupamentos mensais dos relatórios.
          </FieldDescription>
        </Field>
        <Field orientation="horizontal" className="rounded-lg border p-4">
          <FieldContent>
            <FieldLabel htmlFor="company-auto">Distribuição automática (rodízio)</FieldLabel>
            <FieldDescription>
              Leads cadastrados por administradores podem ser distribuídos entre vendedores ativos, em ordem
              estável.
            </FieldDescription>
          </FieldContent>
          <Switch id="company-auto" checked={auto} onCheckedChange={setAuto} />
        </Field>
        <div>
          <SubmitButton pending={pending}>Salvar</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
