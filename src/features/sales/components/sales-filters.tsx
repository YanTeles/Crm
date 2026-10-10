"use client";

import { PeriodFilter } from "@/components/data/period-filter";
import { useUrlState } from "@/components/data/url-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MemberOption } from "@/features/workspace/lookups";

const ALL = "__all__";

export function SalesFilters({ members, isAdmin }: { members: MemberOption[]; isAdmin: boolean }) {
  const { params, set } = useUrlState();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <PeriodFilter />
      <Select
        value={params.get("status") ?? "all"}
        onValueChange={(v) => set({ status: v === "all" ? null : v })}
      >
        <SelectTrigger className="w-40" aria-label="Situação">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="completed">Concluídas</SelectItem>
          <SelectItem value="pending">Pendentes</SelectItem>
          <SelectItem value="cancelled">Canceladas</SelectItem>
        </SelectContent>
      </Select>
      {isAdmin ? (
        <Select
          value={params.get("vendedor") ?? ALL}
          onValueChange={(v) => set({ vendedor: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-48" aria-label="Vendedor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os vendedores</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
