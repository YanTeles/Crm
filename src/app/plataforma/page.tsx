import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, PauseCircle, Users } from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { BrandMark } from "@/components/layout/brand-mark";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyStatusButton } from "@/features/platform/components/company-status-button";
import { isPlatformAdmin, requireUser } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plataforma" };

// Superadministrador: gerencia empresas sem acesso aos dados comerciais (D8).
export default async function PlatformPage({ searchParams }: PageProps<"/plataforma">) {
  const user = await requireUser("/plataforma");
  if (!(await isPlatformAdmin())) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";

  const supabase = await createClient();
  const { data: companies = [] } = await supabase.rpc("platform_overview", { p_search: q || null });
  const list = companies ?? [];
  const suspended = list.filter((c) => c.status === "suspended").length;
  const members = list.reduce((s, c) => s + Number(c.active_members), 0);

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Link href="/app">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={user.fullName} email={user.email} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <PageHeader
          title="Administração da plataforma"
          description="Indicadores operacionais agregados. Dados comerciais das empresas não são exibidos."
        />
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Empresas" value={formatNumber(list.length)} icon={Building2} />
          <StatCard
            label="Suspensas"
            value={formatNumber(suspended)}
            icon={PauseCircle}
            tone={suspended ? "danger" : "default"}
          />
          <StatCard label="Usuários ativos" value={formatNumber(members)} icon={Users} />
        </div>
        <form className="mb-4 max-w-sm">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Pesquisar por nome ou endereço…"
            aria-label="Pesquisar empresas"
          />
        </form>
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Empresa</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="hidden md:table-cell">Criada em</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Usuários ativos</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Leads</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.company_id}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground block text-xs">/{c.slug}</span>
                    </TableCell>
                    <TableCell>
                      {c.status === "active" ? (
                        <Badge variant="secondary">Ativa</Badge>
                      ) : (
                        <Badge variant="destructive" title={c.suspended_reason ?? undefined}>
                          Suspensa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(c.created_at, "America/Sao_Paulo")}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatNumber(Number(c.active_members))}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatNumber(Number(c.leads_total))}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <CompanyStatusButton companyId={c.company_id} name={c.name} status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {!list.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      Nenhuma empresa encontrada.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
