import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  CalendarCheck,
  CircleDollarSign,
  Percent,
  Receipt,
  UserSquare2,
} from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { OutcomeBadge } from "@/components/data/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/features/reports/components/charts";
import { getMonthly, getSummary } from "@/features/reports/queries";
import { countTasks, listTasks } from "@/features/tasks/queries";
import { TaskList } from "@/features/tasks/components/task-list";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";
import { periodRange } from "@/lib/dates";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/app/[slug]/dashboard">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug);
  const tz = ws.company.timezone;
  const month = periodRange("this_month", tz);
  const year = periodRange("last_12m", tz);
  const seller = ws.isAdmin ? null : ws.user.id;
  const onlyUser = ws.isAdmin ? undefined : ws.user.id;
  const supabase = await createClient();

  const [lookups, summary, monthly, counts, todayTasks, recent, unassigned] = await Promise.all([
    getLookups(ws.company.id),
    getSummary(ws.company.id, { from: month.from.toISOString(), to: month.to.toISOString(), seller }),
    getMonthly(ws.company.id, { from: year.from.toISOString(), to: year.to.toISOString(), seller }),
    countTasks(ws.company.id, tz, onlyUser),
    listTasks(ws.company.id, tz, "hoje", { onlyUser: ws.user.id }),
    supabase
      .from("leads")
      .select("id, name, outcome, created_at, archived_at, customer_company")
      .eq("company_id", ws.company.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    ws.isAdmin
      ? supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("company_id", ws.company.id)
          .is("assigned_to", null)
          .is("archived_at", null)
          .eq("outcome", "open")
      : Promise.resolve({ count: 0 }),
  ]);
  const cl = clientLookups(lookups);
  const base = `/app/${slug}`;
  const firstName = ws.user.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={ws.isAdmin ? "Visão geral da empresa neste mês." : "Seus resultados neste mês."}
      />

      {ws.isAdmin && (unassigned.count ?? 0) > 0 ? (
        <Link
          href={`${base}/leads?responsavel=none`}
          className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <span>
            <strong>{unassigned.count}</strong> lead(s) em aberto sem responsável.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento no mês"
          value={formatCurrency(summary.revenue)}
          icon={CircleDollarSign}
          tone="success"
        />
        <StatCard label="Vendas concluídas" value={formatNumber(summary.sales_count)} icon={Receipt} />
        <StatCard label="Leads criados" value={formatNumber(summary.leads_created)} icon={UserSquare2} />
        <StatCard
          label="Conversão"
          value={formatPercent(summary.conversion_rate)}
          hint="Leads criados no mês que estão ganhos"
          icon={Percent}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento — últimos 12 meses</CardTitle>
            <CardDescription>Vendas concluídas, pela data de conclusão.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`${base}/relatorios`}>
                  Relatórios <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <RevenueChart data={monthly} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Minhas tarefas de hoje</CardTitle>
              <CardDescription className="flex gap-4">
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="size-3.5" /> {counts.today} hoje
                </span>
                <Link
                  href={`${base}/tarefas?visao=atrasadas`}
                  className={
                    counts.overdue
                      ? "inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"
                      : "inline-flex items-center gap-1"
                  }
                >
                  <AlarmClock className="size-3.5" /> {counts.overdue} atrasada(s)
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskList
                tasks={todayTasks.slice(0, 5)}
                members={cl.members}
                emptyText="Nenhuma tarefa para hoje."
                now={new Date().toISOString()}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Leads recentes</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${base}/leads`}>
                    Ver todos <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {recent.data?.length ? (
                <ul className="divide-y">
                  {recent.data.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`${base}/leads/${l.id}`}
                        className="hover:bg-muted/50 -mx-2 flex items-center gap-2 rounded-md px-2 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{l.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {formatDate(l.created_at, tz)}
                          </span>
                        </span>
                        <OutcomeBadge outcome={l.outcome} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">Nenhum lead ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
