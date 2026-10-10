"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data/data-table";
import { SaleStatusBadge } from "@/components/data/status-badges";
import { useWorkspace } from "@/components/layout/workspace-context";
import type { MemberOption } from "@/features/workspace/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SaleRow } from "../queries";
import { SaleRowActions } from "./sale-row-actions";

export function SalesTable({ rows, members }: { rows: SaleRow[]; members: MemberOption[] }) {
  const ws = useWorkspace();
  const member = (id: string) => members.find((m) => m.userId === id)?.name ?? "—";

  const columns: ColumnDef<SaleRow>[] = [
    {
      header: "Descrição",
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.description}</span>
          <span className="text-muted-foreground block text-xs">
            {row.original.lead ? (
              <Link href={`/app/${ws.slug}/leads/${row.original.lead.id}`} className="hover:underline">
                {row.original.lead.name}
              </Link>
            ) : (
              "Lead de outro responsável"
            )}
          </span>
        </div>
      ),
    },
    ...(ws.isAdmin
      ? [
          {
            header: "Vendedor",
            cell: ({ row }) => member(row.original.seller_id),
            meta: { className: "hidden md:table-cell" },
          } satisfies ColumnDef<SaleRow>,
        ]
      : []),
    { header: "Situação", cell: ({ row }) => <SaleStatusBadge status={row.original.status} /> },
    {
      header: "Data",
      cell: ({ row }) =>
        row.original.status === "completed"
          ? formatDate(row.original.completed_at, ws.timezone)
          : formatDate(row.original.created_at, ws.timezone),
      meta: { className: "hidden sm:table-cell" },
    },
    {
      header: () => <span className="block text-right">Valor</span>,
      id: "amount",
      cell: ({ row }) => (
        <span className="block text-right font-medium tabular-nums">
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => (
        <SaleRowActions
          members={members}
          sale={{
            id: row.original.id,
            description: row.original.description,
            amount: Number(row.original.amount),
            status: row.original.status,
            completed_at: row.original.completed_at,
            seller_id: row.original.seller_id,
            row_version: row.original.row_version,
          }}
        />
      ),
    },
  ];

  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty="Nenhuma venda no período." />;
}
