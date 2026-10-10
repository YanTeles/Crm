"use client";

import type { ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

type RenderProps = {
  id: string;
  value: unknown;
  onChange: (...event: unknown[]) => void;
  onBlur: () => void;
  name: string;
  "aria-invalid": boolean;
};

// Campo controlado padrão: rótulo, controle, descrição e mensagem de erro acessíveis.
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  children,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  children: (field: RenderProps) => ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const id = `field-${name.replace(/\./g, "-")}`;
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id}>
              {label}
              {required ? (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              ) : null}
            </FieldLabel>
            {children({
              id,
              value: field.value,
              onChange: field.onChange,
              onBlur: field.onBlur,
              name: field.name,
              "aria-invalid": fieldState.invalid,
            })}
            {description ? <FieldDescription>{description}</FieldDescription> : null}
            {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        );
      }}
    />
  );
}
