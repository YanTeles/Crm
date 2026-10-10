"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { UserSquare2 } from "lucide-react";
import { DataTable } from "@/components/data/data-table";
import { OutcomeBadge } from "@/components/data/status-badges";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { ClientLookups } from "@/features/workspace/lookups";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { LeadRow } from "../queries";

export function LeadsTable({
  rows,
  lookups,
  filtered,
}: {
  rows: LeadRow[];
  lookups: ClientLookups;
  filtered: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const stage = (id: string) => lookups.stages.find((s) => s.id === id)?.name ?? "—";
  const source = (id: string | null) => lookups.sources.find((s) => s.id === id)?.name ?? "—";
  const member = (id: string | null) => lookups.members.find((m) => m.userId === id)?.name;

  const columns: ColumnDef<LeadRow>[] = [
    {
      header: "Nome",
      cell: ({ row }) => (
        <Link
          href={`/app/${ws.slug}/leads/${row.original.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.name}
          {row.original.customer_company ? (
            <span className="text-muted-foreground block text-xs font-normal">
              {row.original.customer_company}
            </span>
          ) : null}
        </Link>
      ),
    },
    {
      header: "Telefone",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatPhone(row.original.phone_normalized)}</span>
      ),
      meta: { className: "hidden md:table-cell" },
    },
    { header: "Etapa", cell: ({ row }) => stage(row.original.stage_id) },
    {
      header: "Situação",
      cell: ({ row }) => (
        <OutcomeBadge outcome={row.original.outcome} archived={Boolean(row.original.archived_at)} />
      ),
    },
    ...(ws.isAdmin
      ? [
          {
            header: "Responsável",
            cell: ({ row }) =>
              member(row.original.assigned_to) ?? (
                <span className="text-muted-foreground">Sem responsável</span>
              ),
            meta: { className: "hidden lg:table-cell" },
          } satisfies ColumnDef<LeadRow>,
        ]
      : []),
    {
      header: "Origem",
      cell: ({ row }) => source(row.original.source_id),
      meta: { className: "hidden lg:table-cell" },
    },
    {
      header: "Criado em",
      cell: ({ row }) => formatDate(row.original.created_at, ws.timezone),
      meta: { className: "hidden sm:table-cell" },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      onRowClick={(r) => router.push(`/app/${ws.slug}/leads/${r.id}`)}
      empty={
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserSquare2 />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "Nenhum lead encontrado" : "Nenhum lead ainda"}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Ajuste os filtros para ver outros resultados."
                : "Cadastre o primeiro lead para começar."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
