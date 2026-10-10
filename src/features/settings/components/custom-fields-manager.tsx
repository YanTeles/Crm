"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CustomFieldDef } from "@/features/workspace/lookups";
import {
  createField,
  createFieldOption,
  deleteField,
  deleteFieldOption,
  updateField,
  updateFieldOption,
} from "../actions";

const TYPE_LABEL = { text: "Texto", number: "Número", date: "Data", select: "Lista de opções" } as const;

export function CustomFieldsManager({ fields }: { fields: CustomFieldDef[] }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<keyof typeof TYPE_LABEL>("text");
  const [required, setRequired] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-muted-foreground text-sm">
        Campos exclusivos desta empresa. Campos e opções já usados não podem ser excluídos nem mudar de tipo —
        desative-os. Tornar um campo obrigatório não invalida leads antigos: a regra vale ao criar ou editar.
      </p>

      <form
        className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createField({
                companyId: ws.companyId,
                label,
                fieldType: type,
                isRequired: required,
                slug: ws.slug,
              }),
            {
              onSuccess: () => {
                setLabel("");
                setRequired(false);
              },
            },
          );
        }}
      >
        <Field>
          <FieldLabel htmlFor="cf-label">Nome do campo</FieldLabel>
          <Input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cf-type">Tipo</FieldLabel>
          <Select value={type} onValueChange={(v) => setType(v as keyof typeof TYPE_LABEL)}>
            <SelectTrigger id="cf-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal" className="sm:pb-2">
          <Checkbox id="cf-required" checked={required} onCheckedChange={(v) => setRequired(v === true)} />
          <FieldLabel htmlFor="cf-required" className="font-normal">
            Obrigatório
          </FieldLabel>
        </Field>
        <Button type="submit" disabled={pending || !label.trim()}>
          <Plus /> Criar campo
        </Button>
      </form>

      {fields.map((f) => (
        <Card key={f.id} className={f.is_active ? "" : "opacity-70"}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {f.label}
              <Badge variant="outline">{TYPE_LABEL[f.field_type]}</Badge>
              {f.is_required ? <Badge variant="secondary">Obrigatório</Badge> : null}
              {!f.is_active ? <Badge variant="outline">Desativado</Badge> : null}
            </CardTitle>
            <CardAction className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.is_required}
                  disabled={pending}
                  onCheckedChange={(v) =>
                    run(() => updateField({ id: f.id, isRequired: v === true, slug: ws.slug }))
                  }
                />
                Obrigatório
              </label>
              <Switch
                checked={f.is_active}
                disabled={pending}
                aria-label={f.is_active ? "Desativar campo" : "Ativar campo"}
                onCheckedChange={(v) => run(() => updateField({ id: f.id, isActive: v, slug: ws.slug }))}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Excluir campo"
                title="Só é possível excluir campos sem valores e sem opções"
                disabled={pending}
                onClick={() => run(() => deleteField({ id: f.id, slug: ws.slug }))}
              >
                <Trash2 />
              </Button>
            </CardAction>
          </CardHeader>
          {f.field_type === "select" ? (
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {f.options.map((o) => (
                  <li key={o.id}>
                    <Badge variant={o.is_active ? "secondary" : "outline"} className="gap-1 py-1 pr-1">
                      <span className={o.is_active ? "" : "line-through"}>{o.label}</span>
                      <button
                        type="button"
                        className="hover:text-foreground text-muted-foreground rounded px-1 text-xs"
                        disabled={pending}
                        onClick={() =>
                          run(() => updateFieldOption({ id: o.id, isActive: !o.is_active, slug: ws.slug }))
                        }
                      >
                        {o.is_active ? "desativar" : "ativar"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir opção ${o.label}`}
                        className="hover:text-destructive text-muted-foreground rounded px-1"
                        disabled={pending}
                        onClick={() => run(() => deleteFieldOption({ id: o.id, slug: ws.slug }))}
                      >
                        ×
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () =>
                      createFieldOption({
                        companyId: ws.companyId,
                        fieldId: f.id,
                        label: optionDrafts[f.id] ?? "",
                        slug: ws.slug,
                      }),
                    { onSuccess: () => setOptionDrafts((d) => ({ ...d, [f.id]: "" })) },
                  );
                }}
              >
                <Input
                  placeholder="Nova opção"
                  value={optionDrafts[f.id] ?? ""}
                  onChange={(e) => setOptionDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                  maxLength={80}
                  aria-label={`Nova opção para ${f.label}`}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending || !(optionDrafts[f.id] ?? "").trim()}
                >
                  <Plus /> Opção
                </Button>
              </form>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
