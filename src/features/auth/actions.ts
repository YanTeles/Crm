"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dbFail, fail, invalid, ok, type ActionResult } from "@/lib/action";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import {
  companyNameSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpCompanySchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "./schemas";

export async function signIn(input: SignInInput): Promise<ActionResult<never>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
    }
    if (error.status === 429) return fail("Muitas tentativas. Aguarde alguns minutos.");
    return fail("E-mail ou senha incorretos.");
  }
  redirect(safeNextPath(parsed.data.next));
}

export async function signUp(input: SignUpInput): Promise<ActionResult<{ email: string }>> {
  const schema = input.invitationToken ? signUpSchema : signUpCompanySchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const next = data.invitationToken ? `/convite/${data.invitationToken}` : "/onboarding";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${env.siteUrl}${next}`,
      captchaToken: data.captchaToken,
      data: {
        full_name: data.fullName,
        ...(data.companyName ? { company_name: data.companyName } : {}),
      },
    },
  });
  if (error) {
    if (error.code === "weak_password")
      return fail("Senha fraca. Use letras e números, com 8 ou mais caracteres.");
    if (error.status === 429) return fail("Muitas tentativas. Aguarde alguns minutos.");
    if (error.code === "captcha_failed") return fail("Falha na verificação anti-robô. Tente novamente.");
    console.error("[auth.signUp]", error.code, error.status);
    return fail("Não foi possível concluir o cadastro. Tente novamente.");
  }
  // Mesma resposta para e-mail novo ou existente (evita enumeração de contas).
  return ok({ email: data.email });
}

export async function resendConfirmation(email: string): Promise<ActionResult<undefined>> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email: parsed.data.email });
  return ok(undefined, "Se houver um cadastro pendente, enviaremos um novo link.");
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult<undefined>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/redefinir-senha`,
    captchaToken: parsed.data.captchaToken,
  });
  if (error?.status === 429) return fail("Muitas solicitações. Aguarde alguns minutos.");
  return ok(undefined, "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult<undefined>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return fail("Link expirado. Solicite uma nova redefinição de senha.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("A nova senha precisa ser diferente da atual.");
    if (error.code === "weak_password")
      return fail("Senha fraca. Use letras e números, com 8 ou mais caracteres.");
    if (error.code === "reauthentication_needed")
      return fail("Por segurança, entre novamente antes de trocar a senha.");
    return fail("Não foi possível alterar a senha.");
  }
  return ok(undefined, "Senha alterada com sucesso.");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function createCompany(input: { name: string }): Promise<ActionResult<never>> {
  const parsed = companyNameSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bootstrap_company", { p_name: parsed.data.name });
  if (error || !data?.[0]) return dbFail(error);
  redirect(`/app/${data[0].slug}/dashboard`);
}

export async function acceptInvitation(token: string): Promise<ActionResult<never>> {
  if (!/^[a-f0-9]{64}$/.test(token)) return fail("Convite inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) return dbFail(error);
  redirect(`/app/${data}/dashboard`);
}
