import type { Metadata } from "next";
import {
  CircleDollarSign,
  Percent,
  Receipt,
  Target,
  ThumbsDown,
  TrendingUp,
  Trophy,
  UserSquare2,
} from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadsChart, RankBars, RevenueChart } from "@/features/reports/components/charts";
import { ReportFilters } from "@/features/reports/components/report-filters";
import { getBySeller, getBySource, getLostReasons, getMonthly, getSummary } from "@/features/reports/queries";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { periodFromParams } from "@/lib/period";

export const metadata: Metadata = { title: "Relatórios" };

const uuidParam = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

export default async function ReportsPage({ params, searchParams }: PageProps<"/app/[slug]/relatorios">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug);
  const sp = await searchParams;
  const period = periodFromParams(sp, ws.company.timezone);
  const filters = {
    from: period.from,
    to: period.to,
    seller: ws.isAdmin ? uuidParam(sp.vendedor) : ws.user.id,
    source: uuidParam(sp.origem),
  };

  const [lookups, summary, monthly, sellers, sources, reasons] = await Promise.all([
    getLookups(ws.company.id),
    getSummary(ws.company.id, filters),
    getMonthly(ws.company.id, filters),
    ws.isAdmin ? getBySeller(ws.company.id, filters) : Promise.resolve([]),
    getBySource(ws.company.id, filters),
    getLostReasons(ws.company.id, filters),
  ]);
  const cl = clientLookups(lookups);

  return (
    <>
      <PageHeader
        title={ws.isAdmin ? "Relatórios" : "Meus resultados"}
        description={`Períodos no fuso ${ws.company.timezone}. Faturamento usa a data de conclusão das vendas.`}
      />
      <ReportFilters members={cl.members} sources={cl.sources} isAdmin={ws.isAdmin} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatCurrency(summary.revenue)}
          icon={CircleDollarSign}
          tone="success"
        />
        <StatCard label="Vendas concluídas" value={formatNumber(summary.sales_count)} icon={Receipt} />
        <StatCard
          label="Ticket médio"
          value={summary.average_ticket === null ? "—" : formatCurrency(summary.average_ticket)}
          icon={TrendingUp}
        />
        <StatCard
          label="Taxa de conversão"
          value={formatPercent(summary.conversion_rate)}
          hint={`${summary.leads_converted} de ${summary.leads_created} leads criados no período estão ganhos`}
          icon={Percent}
        />
        <StatCard label="Leads criados" value={formatNumber(summary.leads_created)} icon={UserSquare2} />
        <StatCard
          label="Oportunidades ganhas"
          value={formatNumber(summary.won_count)}
          hint={`Valor de ganho: ${formatCurrency(summary.won_amount)} (não soma no faturamento)`}
          icon={Trophy}
        />
        <StatCard
          label="Oportunidades perdidas"
          value={formatNumber(summary.lost_count)}
          icon={ThumbsDown}
          tone="danger"
        />
        <StatCard
          label="Vendas pendentes"
          value={formatCurrency(summary.pending_amount)}
          hint={`${summary.pending_count} a concluir (todas as datas)`}
          icon={Target}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução do faturamento</CardTitle>
            <CardDescription>Vendas concluídas por mês de conclusão.</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leads criados × ganhos</CardTitle>
            <CardDescription>Criados pela data de criação; ganhos pela data do ganho.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsChart data={monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Origem dos leads</CardTitle>
            <CardDescription>Leads criados no período.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankBars
              data={sources.map((s) => ({ name: s.name, value: s.leads }))}
              valueLabel="leads"
              empty="Nenhum lead no período."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Motivos de perda</CardTitle>
            <CardDescription>Oportunidades perdidas no período.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankBars
              data={reasons.map((r) => ({ name: r.name, value: r.total }))}
              valueLabel="perdas"
              empty="Nenhuma perda no período."
            />
          </CardContent>
        </Card>
      </div>

      {ws.isAdmin ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Ranking de vendedores</CardTitle>
            <CardDescription>
              Faturamento pelo vendedor da venda; leads pelo responsável atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Leads criados</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Ganhos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((s, i) => (
                  <TableRow key={s.userId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      {s.name}
                      {s.status === "inactive" ? (
                        <span className="text-muted-foreground"> (inativo)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(s.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(s.sales)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatNumber(s.leads)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatNumber(s.won)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
