"use client";

import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionSubmit } from "@/components/forms/use-action-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resendConfirmation, signUp } from "../actions";
import { signUpCompanySchema, signUpSchema, type SignUpInput } from "../schemas";
import { Turnstile } from "./turnstile";

export function SignUpForm({
  invitationToken,
  turnstileSiteKey,
}: {
  invitationToken?: string;
  turnstileSiteKey: string | null;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(invitationToken ? signUpSchema : signUpCompanySchema),
    defaultValues: { fullName: "", email: "", password: "", companyName: "", invitationToken },
  });
  const { pending, onSubmit } = useActionSubmit(form, signUp, { onSuccess: (d) => setSentTo(d.email) });
  const onToken = useCallback((t: string | undefined) => form.setValue("captchaToken", t), [form]);

  if (sentTo) {
    return (
      <div className="space-y-4">
        <Alert>
          <MailCheck />
          <AlertTitle>Confirme seu e-mail</AlertTitle>
          <AlertDescription>
            Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra-o para ativar sua conta
            {invitationToken ? " e aceitar o convite." : " e criar sua empresa."}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            const r = await resendConfirmation(sentTo);
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
          }}
        >
          Reenviar e-mail
        </Button>
      </div>
    );
  }

  const text = (
    name: keyof SignUpInput,
    label: string,
    type = "text",
    autoComplete?: string,
    required = true,
  ) => (
    <FormField control={form.control} name={name} label={label} required={required}>
      {(f) => (
        <Input
          {...f}
          value={(f.value as string) ?? ""}
          onChange={(e) => f.onChange(e.target.value)}
          type={type}
          autoComplete={autoComplete}
        />
      )}
    </FormField>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {text("fullName", "Seu nome", "text", "name")}
        {text("email", "E-mail", "email", "email")}
        <FormField
          control={form.control}
          name="password"
          label="Senha"
          required
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
        {invitationToken ? null : text("companyName", "Nome da empresa", "text", "organization")}
        <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
        <SubmitButton pending={pending} className="w-full" size="lg">
          {invitationToken ? "Criar conta" : "Criar conta e empresa"}
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
