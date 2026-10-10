"use client";

import { useUrlState } from "@/components/data/url-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PERIOD_OPTIONS = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_90", label: "Últimos 90 dias" },
  { value: "this_year", label: "Este ano" },
  { value: "last_12m", label: "Últimos 12 meses" },
  { value: "custom", label: "Personalizado" },
] as const;

export function PeriodFilter() {
  const { params, set } = useUrlState();
  const period = params.get("periodo") ?? "this_month";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period} onValueChange={(v) => set({ periodo: v === "this_month" ? null : v })}>
        <SelectTrigger className="w-44" aria-label="Período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" ? (
        <>
          <Input
            type="date"
            className="w-40"
            aria-label="Data inicial"
            defaultValue={params.get("de") ?? ""}
            onChange={(e) => set({ de: e.target.value })}
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            className="w-40"
            aria-label="Data final"
            defaultValue={params.get("ate") ?? ""}
            onChange={(e) => set({ ate: e.target.value })}
          />
        </>
      ) : null}
    </div>
  );
}
