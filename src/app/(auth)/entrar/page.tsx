import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Entrar" };

// Tela de login. Se a pessoa já estiver logada, vai direto para o sistema.
export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthShell
      title="Entrar"
      description="Acesse o CRM da sua empresa."
      footer={
        <span>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-foreground font-medium underline-offset-4 hover:underline">
            Cadastre sua empresa
          </Link>
        </span>
      }
    >
      {/* Aviso quando a pessoa chegou por um link de e-mail vencido ou inválido. */}
      {sp.erro === "link" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>O link é inválido ou expirou. Solicite um novo.</AlertDescription>
        </Alert>
      ) : null}
      <SignInForm next={next} />
    </AuthShell>
  );
}
