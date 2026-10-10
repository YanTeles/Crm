"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomFieldDef } from "@/features/workspace/lookups";

export type CustomValueMap = Record<string, string | number | null>;

const NONE = "__none__";

// Renderiza os campos personalizados ativos (e inativos que já tenham valor).
export function CustomFieldInputs({
  fields,
  values,
  onChange,
  errors,
}: {
  fields: CustomFieldDef[];
  values: CustomValueMap;
  onChange: (fieldId: string, value: string | number | null) => void;
  errors?: Record<string, string>;
}) {
  const visible = fields.filter((f) => f.is_active || (values[f.id] !== undefined && values[f.id] !== null));
  if (!visible.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((f) => {
        const id = `cf-${f.id}`;
        const raw = values[f.id];
        const value = raw === null || raw === undefined ? "" : String(raw);
        const disabled = !f.is_active;
        return (
          <Field key={f.id} data-invalid={Boolean(errors?.[f.id])}>
            <FieldLabel htmlFor={id}>
              {f.label}
              {f.is_required && f.is_active ? (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              ) : null}
            </FieldLabel>
            {f.field_type === "select" ? (
              <Select
                value={value || NONE}
                onValueChange={(v) => onChange(f.id, v === NONE ? null : v)}
                disabled={disabled}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {f.options
                    .filter((o) => o.is_active || o.id === value)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                        {!o.is_active ? " (desativada)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                disabled={disabled}
                type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                inputMode={f.field_type === "number" ? "decimal" : undefined}
                step={f.field_type === "number" ? "any" : undefined}
                value={value}
                aria-invalid={Boolean(errors?.[f.id])}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return onChange(f.id, null);
                  onChange(f.id, f.field_type === "number" ? Number(v) : v);
                }}
              />
            )}
            {disabled ? <FieldDescription>Campo desativado.</FieldDescription> : null}
            {errors?.[f.id] ? <p className="text-destructive text-sm">{errors[f.id]}</p> : null}
          </Field>
        );
      })}
    </div>
  );
}

export function initialCustomValues(
  rows: {
    field_id: string;
    value_text: string | null;
    value_number: number | null;
    value_date: string | null;
    option_id: string | null;
  }[],
): CustomValueMap {
  const map: CustomValueMap = {};
  for (const r of rows) map[r.field_id] = r.value_text ?? r.value_number ?? r.value_date ?? r.option_id;
  return map;
}
