import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Cadastro" };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const sp = await searchParams;
  const invitationToken =
    typeof sp.convite === "string" && /^[a-f0-9]{64}$/.test(sp.convite) ? sp.convite : undefined;
  if (await getCurrentUser()) redirect(invitationToken ? `/convite/${invitationToken}` : "/app");

  return (
    <AuthShell
      title={invitationToken ? "Criar conta" : "Cadastre sua empresa"}
      description={
        invitationToken
          ? "Crie sua conta com o e-mail que recebeu o convite."
          : "Crie sua conta de administrador. Você poderá convidar sua equipe em seguida."
      }
      footer={
        <span>
          Já tem conta?{" "}
          <Link
            href={invitationToken ? `/entrar?next=/convite/${invitationToken}` : "/entrar"}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </span>
      }
    >
      <SignUpForm invitationToken={invitationToken} turnstileSiteKey={env.turnstileSiteKey} />
    </AuthShell>
  );
}
