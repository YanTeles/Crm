import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/password-forms";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      description="Informe seu e-mail para receber um link de redefinição."
      footer={
        <Link href="/entrar" className="text-foreground font-medium underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <ForgotPasswordForm turnstileSiteKey={env.turnstileSiteKey} />
    </AuthShell>
  );
}
