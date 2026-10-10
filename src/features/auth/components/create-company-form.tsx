"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionSubmit } from "@/components/forms/use-action-form";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCompany } from "../actions";
import { companyNameSchema } from "../schemas";

export function CreateCompanyForm({ defaultName }: { defaultName: string }) {
  const form = useForm<{ name: string }>({
    resolver: zodResolver(companyNameSchema),
    defaultValues: { name: defaultName },
  });
  const { pending, onSubmit } = useActionSubmit(form, createCompany);

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormField
          control={form.control}
          name="name"
          label="Nome da empresa"
          description="O endereço do seu espaço é gerado a partir do nome e pode ser alterado depois."
        >
          {(f) => (
            <Input
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              autoComplete="organization"
              autoFocus
            />
          )}
        </FormField>
        <SubmitButton pending={pending} className="w-full" size="lg">
          Criar empresa
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
