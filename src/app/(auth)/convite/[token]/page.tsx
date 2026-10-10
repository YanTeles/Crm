import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AcceptInvitationButton } from "@/features/auth/components/accept-invitation-button";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Convite" };

const STATUS_MESSAGE: Record<string, string> = {
  accepted: "Este convite já foi utilizado.",
  revoked: "Este convite foi revogado pelo administrador.",
  expired: "Este convite expirou. Peça um novo ao administrador.",
  company_suspended: "A empresa deste convite está suspensa.",
};

export default async function InvitationPage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const valid = /^[a-f0-9]{64}$/.test(token);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthShell
        title="Você recebeu um convite"
        description="Entre ou crie sua conta com o e-mail convidado para continuar."
      >
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href={`/cadastro?convite=${token}`}>Criar conta</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/entrar?next=${encodeURIComponent(`/convite/${token}`)}`}>Já tenho conta</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const supabase = await createClient();
  const { data } = valid ? await supabase.rpc("get_invitation", { p_token: token }) : { data: null };
  const invitation = data?.[0];

  if (!invitation || invitation.status !== "pending") {
    return (
      <AuthShell title="Convite indisponível">
        <Alert variant="destructive">
          <AlertDescription>
            {invitation ? STATUS_MESSAGE[invitation.status] : "Convite inválido."}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/app">Ir para o CRM</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Entrar em ${invitation.company_name}`}
      description={`Você foi convidado como ${invitation.role === "admin" ? "administrador" : "vendedor"}. Conectado como ${user.email}.`}
    >
      <AcceptInvitationButton token={token} />
    </AuthShell>
  );
}
