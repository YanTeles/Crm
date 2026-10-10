import type { Metadata } from "next";
import { CircleDollarSign, Clock, Receipt, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { Pagination } from "@/components/data/url-state";
import { PageHeader } from "@/components/layout/page-header";
import { getSummary } from "@/features/reports/queries";
import { SaleDialog } from "@/features/sales/components/sale-dialog";
import { SalesFilters } from "@/features/sales/components/sales-filters";
import { SalesTable } from "@/features/sales/components/sales-table";
import { listSales, SALES_PAGE_SIZE, type SaleFilters } from "@/features/sales/queries";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";
import { formatCurrency, formatNumber } from "@/lib/format";
import { periodFromParams } from "@/lib/period";

export const metadata: Metadata = { title: "Vendas" };

export default async function SalesPage({ params, searchParams }: PageProps<"/app/[slug]/vendas">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug);
  const sp = await searchParams;
  const period = periodFromParams(sp, ws.company.timezone);
  const status = (["pending", "completed", "cancelled"] as const).find((s) => s === sp.status) ?? "all";
  const seller =
    ws.isAdmin && typeof sp.vendedor === "string" && /^[0-9a-f-]{36}$/i.test(sp.vendedor)
      ? sp.vendedor
      : undefined;
  const filters: SaleFilters = {
    status,
    seller: ws.isAdmin ? seller : ws.user.id,
    from: period.from,
    to: period.to,
    page: Math.max(1, Number(sp.pagina) || 1),
  };

  const [lookups, list, summary] = await Promise.all([
    getLookups(ws.company.id),
    listSales(ws.company.id, filters),
    getSummary(ws.company.id, { from: period.from, to: period.to, seller: filters.seller }),
  ]);
  const cl = clientLookups(lookups);

  return (
    <>
      <PageHeader
        title={ws.isAdmin ? "Vendas" : "Minhas vendas"}
        description="Faturamento considera somente vendas concluídas, pela data de conclusão."
        actions={<SaleDialog members={cl.members} />}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Pendentes (carteira)"
          value={formatCurrency(summary.pending_amount)}
          hint={`${summary.pending_count} venda(s) a concluir`}
          icon={Clock}
        />
      </div>
      <SalesFilters members={cl.members} isAdmin={ws.isAdmin} />
      <SalesTable rows={list.rows} members={cl.members} />
      <Pagination page={filters.page} pageSize={SALES_PAGE_SIZE} total={list.total} />
    </>
  );
}
