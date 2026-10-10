import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { CreateCompanyForm } from "@/features/auth/components/create-company-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Criar empresa" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const supabase = await createClient();

  // Se o usuário já criou uma empresa, segue direto para ela (fluxo idempotente).
  const { data: own } = await supabase
    .from("companies")
    .select("slug")
    .eq("created_by", user.id)
    .maybeSingle();
  if (own) redirect(`/app/${own.slug}/dashboard`);

  const { data: auth } = await supabase.auth.getUser();
  const suggested = String(auth.user?.user_metadata?.company_name ?? "").slice(0, 120);

  return (
    <AuthShell
      title="Crie o espaço da sua empresa"
      description="Os dados de cada empresa ficam isolados. Você será o administrador inicial."
    >
      <CreateCompanyForm defaultName={suggested} />
    </AuthShell>
  );
}
