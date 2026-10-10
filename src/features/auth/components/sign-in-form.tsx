"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionSubmit } from "@/components/forms/use-action-form";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "../actions";
import { signInSchema, type SignInInput } from "../schemas";

export function SignInForm({ next }: { next?: string }) {
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });
  const { pending, onSubmit } = useActionSubmit(form, signIn);

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormField control={form.control} name="email" label="E-mail">
          {(f) => (
            <Input
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              type="email"
              autoComplete="email"
              autoFocus
            />
          )}
        </FormField>
        <FormField
          control={form.control}
          name="password"
          label={<span className="flex w-full items-center justify-between">Senha</span>}
        >
          {(f) => (
            <Input
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          )}
        </FormField>
        <div className="-mt-2 text-right text-sm">
          <Link
            href="/esqueci-senha"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <SubmitButton pending={pending} className="w-full" size="lg">
          Entrar
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
