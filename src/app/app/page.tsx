import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPlatformAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Empresas" };

export default async function CompanyChooserPage() {
  const user = await requireUser("/app");
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("company_members")
    .select("role, status, companies(name, slug, status, created_by)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at");

  const companies = (memberships ?? []).flatMap((m) =>
    m.companies ? [{ ...m.companies, role: m.role }] : [],
  );
  const platformAdmin = await isPlatformAdmin();
  const ownsCompany = companies.some((c) => c.created_by === user.id);

  if (companies.length === 1 && !platformAdmin) redirect(`/app/${companies[0].slug}/dashboard`);
  if (companies.length === 0 && !platformAdmin) redirect("/onboarding");

  return (
    <AuthShell title="Escolha a empresa" description={`Conectado como ${user.email}`}>
      <ul className="flex flex-col gap-2">
        {companies.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/app/${c.slug}/dashboard`}
              className="hover:bg-muted flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <Building2 className="text-muted-foreground size-5" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">
                  {c.role === "admin" ? "Administrador" : "Vendedor"}
                </span>
              </span>
              {c.status === "suspended" ? <Badge variant="destructive">Suspensa</Badge> : null}
              <ChevronRight className="text-muted-foreground size-4" aria-hidden />
            </Link>
          </li>
        ))}
        {platformAdmin ? (
          <li>
            <Link href="/plataforma" className="hover:bg-muted flex items-center gap-3 rounded-lg border p-3">
              <ShieldCheck className="text-primary size-5" aria-hidden />
              <span className="flex-1 font-medium">Administração da plataforma</span>
              <ChevronRight className="text-muted-foreground size-4" aria-hidden />
            </Link>
          </li>
        ) : null}
      </ul>
      {!ownsCompany ? (
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/onboarding">
            <Plus /> Criar minha própria empresa
          </Link>
        </Button>
      ) : null}
    </AuthShell>
  );
}
