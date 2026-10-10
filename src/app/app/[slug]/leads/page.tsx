import type { Metadata } from "next";
import { Pagination } from "@/components/data/url-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LeadFilters } from "@/features/leads/components/lead-filters";
import { LeadSheet } from "@/features/leads/components/lead-sheet";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { LEADS_PAGE_SIZE, listLeads, parseLeadFilters } from "@/features/leads/queries";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ params, searchParams }: PageProps<"/app/[slug]/leads">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug);
  const filters = parseLeadFilters(await searchParams);
  const lookups = await getLookups(ws.company.id);
  const { rows, total, error } = await listLeads(ws.company.id, filters, lookups.customFields);
  const filtered = Boolean(
    filters.q ||
    filters.stage ||
    filters.assignee ||
    filters.source ||
    filters.field ||
    filters.status !== "open",
  );

  return (
    <>
      <PageHeader
        title={ws.isAdmin ? "Leads" : "Meus leads"}
        description={ws.isAdmin ? "Todos os leads da empresa." : "Leads atribuídos a você."}
        actions={<LeadSheet lookups={clientLookups(lookups)} />}
      />
      <LeadFilters lookups={clientLookups(lookups)} />
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Não foi possível carregar os leads. Tente novamente.</AlertDescription>
        </Alert>
      ) : null}
      <LeadsTable rows={rows} lookups={clientLookups(lookups)} filtered={filtered} />
      <Pagination page={filters.page ?? 1} pageSize={LEADS_PAGE_SIZE} total={total} />
    </>
  );
}
