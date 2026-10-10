"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ClientLookups } from "@/features/workspace/lookups";
import { checkDuplicates, createLead, updateLead, type DuplicateCheck } from "../actions";
import { leadFormFields, type Assignment, type LeadFormInput } from "../schemas";
import { CustomFieldInputs, type CustomValueMap } from "./custom-field-inputs";

const NONE = "__none__";

export function LeadForm({
  lookups,
  lead,
  initialCustom = {},
  onDone,
}: {
  lookups: ClientLookups;
  lead?: {
    id: string;
    name: string;
    phone_raw: string;
    email: string | null;
    customer_company: string | null;
    source_id: string | null;
    notes: string | null;
    row_version: number;
  };
  initialCustom?: CustomValueMap;
  onDone?: (leadId: string) => void;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requestId] = useState(() => crypto.randomUUID());
  const [duplicates, setDuplicates] = useState<DuplicateCheck | null>(null);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [assignment, setAssignment] = useState<Assignment>(
    ws.isAdmin && ws.autoDistribution ? { mode: "auto" } : { mode: "none" },
  );

  const form = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormFields),
    defaultValues: {
      name: lead?.name ?? "",
      phone: lead?.phone_raw ?? "",
      email: lead?.email ?? "",
      customerCompany: lead?.customer_company ?? "",
      sourceId: lead?.source_id ?? "",
      notes: lead?.notes ?? "",
      customValues: initialCustom,
    },
  });
  const customValues = (useWatch({ control: form.control, name: "customValues" }) ?? {}) as CustomValueMap;

  const sellers = lookups.members.filter((m) => m.role === "seller" && m.status === "active");
  const sources = lookups.sources.filter((s) => s.is_active || s.id === lead?.source_id);

  async function onPhoneBlur(phone: string) {
    if (!phone) return setDuplicates(null);
    const r = await checkDuplicates({ companyId: ws.companyId, phone, excludeLeadId: lead?.id });
    if (r.ok) setDuplicates(r.data.visible.length || r.data.hidden_count ? r.data : null);
  }

  const onSubmit = form.handleSubmit((values) => {
    // Validação local de obrigatórios dos campos personalizados (o banco valida de novo).
    const missing: Record<string, string> = {};
    for (const f of lookups.customFields) {
      const v = values.customValues?.[f.id];
      if (f.is_active && f.is_required && (v === null || v === undefined || v === "")) {
        missing[f.id] = "Campo obrigatório.";
      }
    }
    setCustomErrors(missing);
    if (Object.keys(missing).length) return;

    if (assignment.mode === "manual" && !assignment.assignee) {
      toast.error("Selecione o vendedor responsável.");
      return;
    }

    startTransition(async () => {
      const result = lead
        ? await updateLead({ leadId: lead.id, slug: ws.slug, values, version: lead.row_version })
        : await createLead({
            companyId: ws.companyId,
            slug: ws.slug,
            values,
            assignment,
            clientRequestId: requestId,
          });
      if (!result.ok) {
        for (const [k, msgs] of Object.entries(result.fieldErrors ?? {})) {
          if (k in values) form.setError(k as keyof LeadFormInput, { message: msgs[0] });
        }
        toast.error(result.error);
        return;
      }
      if (result.message) {
        if (
          !lead &&
          "no_active_sellers" in (result.data as object) &&
          (result.data as { no_active_sellers: boolean }).no_active_sellers
        ) {
          toast.warning(result.message);
        } else toast.success(result.message);
      }
      const id = lead ? lead.id : (result.data as { lead_id: string }).lead_id;
      router.refresh();
      onDone?.(id);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormField control={form.control} name="name" label="Nome" required>
          {(f) => (
            <Input
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="phone" label="Telefone / WhatsApp" required>
            {(f) => (
              <Input
                {...f}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={(e) => {
                  f.onBlur();
                  void onPhoneBlur(e.target.value);
                }}
                type="tel"
                inputMode="tel"
                placeholder="(11) 99999-0000"
              />
            )}
          </FormField>
          <FormField control={form.control} name="email" label="E-mail">
            {(f) => (
              <Input
                {...f}
                value={(f.value as string) ?? ""}
                onChange={(e) => f.onChange(e.target.value)}
                type="email"
              />
            )}
          </FormField>
        </div>

        {duplicates ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Possível duplicidade</AlertTitle>
            <AlertDescription>
              <p>Já existe lead com este telefone. Você pode continuar mesmo assim.</p>
              <ul className="mt-1 list-disc pl-4">
                {duplicates.visible.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/${ws.slug}/leads/${d.id}`} className="underline" target="_blank">
                      {d.name}
                    </Link>
                    {d.assigned_name ? ` — ${d.assigned_name}` : " — sem responsável"}
                    {d.archived ? " (arquivado)" : ""}
                  </li>
                ))}
              </ul>
              {duplicates.hidden_count ? (
                <p className="mt-1">
                  {duplicates.hidden_count} lead(s) de outros vendedores com este telefone.
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="customerCompany" label="Empresa do cliente">
            {(f) => (
              <Input {...f} value={(f.value as string) ?? ""} onChange={(e) => f.onChange(e.target.value)} />
            )}
          </FormField>
          <FormField control={form.control} name="sourceId" label="Origem">
            {(f) => (
              <Select
                value={(f.value as string) || NONE}
                onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
              >
                <SelectTrigger id={f.id} className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem origem</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
        <FormField control={form.control} name="notes" label="Observações">
          {(f) => (
            <Textarea
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              rows={3}
            />
          )}
        </FormField>
      </FieldGroup>

      {lookups.customFields.length ? (
        <>
          <Separator />
          <FieldSet>
            <FieldLegend>Campos personalizados</FieldLegend>
            <CustomFieldInputs
              fields={lookups.customFields}
              values={customValues}
              errors={customErrors}
              onChange={(id, v) =>
                form.setValue("customValues", { ...customValues, [id]: v }, { shouldDirty: true })
              }
            />
          </FieldSet>
        </>
      ) : null}

      {!lead && ws.isAdmin ? (
        <>
          <Separator />
          <FieldSet>
            <FieldLegend>Responsável</FieldLegend>
            <RadioGroup
              value={assignment.mode}
              onValueChange={(mode) =>
                setAssignment(
                  mode === "manual"
                    ? { mode: "manual", assignee: sellers[0]?.userId ?? "" }
                    : { mode: mode as "auto" | "none" },
                )
              }
            >
              <Field orientation="horizontal">
                <RadioGroupItem value="auto" id="assign-auto" disabled={!ws.autoDistribution} />
                <FieldLabel htmlFor="assign-auto" className="font-normal">
                  Distribuição automática (rodízio)
                  {!ws.autoDistribution ? <span className="text-muted-foreground"> — desativada</span> : null}
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem value="manual" id="assign-manual" disabled={!sellers.length} />
                <FieldLabel htmlFor="assign-manual" className="font-normal">
                  Escolher vendedor
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem value="none" id="assign-none" />
                <FieldLabel htmlFor="assign-none" className="font-normal">
                  Deixar sem responsável
                </FieldLabel>
              </Field>
            </RadioGroup>
            {assignment.mode === "manual" ? (
              <Select
                value={assignment.assignee}
                onValueChange={(v) => setAssignment({ mode: "manual", assignee: v })}
              >
                <SelectTrigger className="w-full" aria-label="Vendedor responsável">
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((s) => (
                    <SelectItem key={s.userId} value={s.userId}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {!sellers.length ? (
              <p className="text-muted-foreground text-sm">
                Nenhum vendedor ativo. Convide vendedores na página Equipe.
              </p>
            ) : null}
          </FieldSet>
        </>
      ) : null}

      <div className="flex justify-end gap-2">
        <SubmitButton pending={pending}>{lead ? "Salvar alterações" : "Cadastrar lead"}</SubmitButton>
      </div>
    </form>
  );
}
