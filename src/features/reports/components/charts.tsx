"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatMonth, formatNumber } from "@/lib/format";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };
const compactBRL = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  style: "currency",
  currency: "BRL",
});

function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color: string }[];
}) {
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: r.color }} aria-hidden />
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto font-medium tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

type Monthly = { month: string; revenue: number; sales: number; leads: number; won: number };

// Faturamento mensal (série única, por data de conclusão da venda).
export function RevenueChart({ data }: { data: Monthly[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Faturamento por mês">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => compactBRL.format(v)}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={formatMonth(String(label))}
                  rows={[
                    {
                      label: "Faturamento",
                      value: formatCurrency(Number(payload[0].value)),
                      color: "var(--series-1)",
                    },
                    {
                      label: "Vendas",
                      value: formatNumber((payload[0].payload as Monthly).sales),
                      color: "transparent",
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="revenue"
            name="Faturamento"
            fill="var(--series-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Leads criados x leads ganhos por mês (mesma unidade: quantidade).
export function LeadsChart({ data }: { data: Monthly[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Leads criados e ganhos por mês">
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barGap={2}
          barCategoryGap="25%"
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)", paddingBottom: 8 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={formatMonth(String(label))}
                  rows={payload.map((p) => ({
                    label: String(p.name),
                    value: formatNumber(Number(p.value)),
                    color: String(p.color),
                  }))}
                />
              ) : null
            }
          />
          <Bar
            dataKey="leads"
            name="Leads criados"
            fill="var(--series-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="won"
            name="Leads ganhos"
            fill="var(--series-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Barras horizontais de série única com rótulo direto (origens, motivos de perda).
export function RankBars({
  data,
  valueLabel,
  empty,
}: {
  data: { name: string; value: number }[];
  valueLabel: string;
  empty: string;
}) {
  if (!data.length) return <p className="text-muted-foreground py-10 text-center text-sm">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  // Lista acessível com barras proporcionais: os números ficam sempre visíveis.
  return (
    <ul className="space-y-2.5" aria-label={valueLabel}>
      {data.slice(0, 10).map((d) => (
        <li key={d.name} className="text-sm" title={`${d.name}: ${formatNumber(d.value)} ${valueLabel}`}>
          <div className="mb-1 flex justify-between gap-2">
            <span className="truncate">{d.name}</span>
            <span className="text-muted-foreground tabular-nums">{formatNumber(d.value)}</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: "var(--series-1)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
