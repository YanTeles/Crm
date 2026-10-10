"use client";

import { useUrlState } from "@/components/data/url-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MemberOption } from "@/features/workspace/lookups";

const ALL = "__all__";

export function AssigneeFilter({ members }: { members: MemberOption[] }) {
  const { params, set } = useUrlState();
  return (
    <Select
      value={params.get("responsavel") ?? ALL}
      onValueChange={(v) => set({ responsavel: v === ALL ? null : v })}
    >
      <SelectTrigger className="w-48" aria-label="Filtrar por responsável">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
        <SelectItem value="none">Sem responsável</SelectItem>
        {members
          .filter((m) => m.role === "seller" || m.status === "inactive")
          .map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name}
              {m.status === "inactive" ? " (inativo)" : ""}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
