"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionSubmit } from "@/components/forms/use-action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, updatePassword } from "../actions";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "../schemas";
import { Turnstile } from "./turnstile";

export function ForgotPasswordForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { pending, onSubmit } = useActionSubmit(form, async (v) => {
    const r = await requestPasswordReset(v);
    if (r.ok) setMessage(r.message ?? null);
    return r.ok ? { ok: true as const, data: undefined } : r;
  });
  const onToken = useCallback((t: string | undefined) => form.setValue("captchaToken", t), [form]);

  if (message) {
    return (
      <Alert>
        <MailCheck />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

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
        <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
        <SubmitButton pending={pending} className="w-full" size="lg">
          Enviar link de redefinição
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

export function ResetPasswordForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { pending, onSubmit } = useActionSubmit(form, updatePassword, {
    onSuccess: () => {
      form.reset();
      if (redirectTo) router.push(redirectTo);
    },
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormField
          control={form.control}
          name="password"
          label="Nova senha"
          description="Mínimo de 8 caracteres, com letras e números."
        >
          {(f) => (
            <Input
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          )}
        </FormField>
        <FormField control={form.control} name="confirm" label="Confirmar nova senha">
          {(f) => (
            <Input
              {...f}
              value={(f.value as string) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          )}
        </FormField>
        <SubmitButton pending={pending} className="w-full" size="lg">
          Salvar nova senha
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
