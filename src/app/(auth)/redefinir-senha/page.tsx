import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/password-forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Redefinir senha" };

// Acessada pelo link de recuperação (/auth/confirm cria a sessão antes).
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect("/entrar?erro=link");
  return (
    <AuthShell title="Definir nova senha" description="Escolha uma nova senha para sua conta.">
      <ResetPasswordForm redirectTo="/app" />
    </AuthShell>
  );
}
