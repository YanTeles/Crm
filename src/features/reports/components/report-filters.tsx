"use client";

import { PeriodFilter } from "@/components/data/period-filter";
import { useUrlState } from "@/components/data/url-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MemberOption, NamedOption } from "@/features/workspace/lookups";

const ALL = "__all__";

export function ReportFilters({
  members,
  sources,
  isAdmin,
}: {
  members: MemberOption[];
  sources: NamedOption[];
  isAdmin: boolean;
}) {
  const { params, set } = useUrlState();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <PeriodFilter />
      {isAdmin ? (
        <Select
          value={params.get("vendedor") ?? ALL}
          onValueChange={(v) => set({ vendedor: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-48" aria-label="Vendedor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda a empresa</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={params.get("origem") ?? ALL}
        onValueChange={(v) => set({ origem: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-44" aria-label="Origem">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as origens</SelectItem>
          {sources.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
