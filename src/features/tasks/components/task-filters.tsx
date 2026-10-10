"use client";

import { useUrlState } from "@/components/data/url-state";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MemberOption } from "@/features/workspace/lookups";

const ALL = "__all__";

export function TaskFilters({
  views,
  counts,
  members,
  isAdmin,
}: {
  views: { value: string; label: string }[];
  counts: { overdue: number; today: number };
  members: MemberOption[];
  isAdmin: boolean;
}) {
  const { params, set } = useUrlState();
  const view = params.get("visao") ?? "hoje";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <Tabs value={view} onValueChange={(v) => set({ visao: v })}>
        <TabsList>
          {views.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
              {v.value === "atrasadas" && counts.overdue ? (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                  {counts.overdue}
                </Badge>
              ) : null}
              {v.value === "hoje" && counts.today ? (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {counts.today}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {isAdmin ? (
        <Select
          value={params.get("responsavel") ?? ALL}
          onValueChange={(v) => set({ responsavel: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-52" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.name}
                {m.status === "inactive" ? " (inativo)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
