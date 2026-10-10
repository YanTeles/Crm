import { periodRange, type PeriodKey } from "@/lib/dates";

const KEYS: PeriodKey[] = ["this_month", "last_month", "last_90", "this_year", "last_12m", "custom"];

// Lê período dos searchParams (padrão: mês corrente no fuso da empresa).
export function periodFromParams(sp: Record<string, string | string[] | undefined>, timezone: string) {
  const raw = typeof sp.periodo === "string" ? sp.periodo : "this_month";
  const key = (KEYS.includes(raw as PeriodKey) ? raw : "this_month") as PeriodKey;
  const de = typeof sp.de === "string" ? sp.de : undefined;
  const ate = typeof sp.ate === "string" ? sp.ate : undefined;
  const range = periodRange(key, timezone, { from: de, to: ate });
  return { key, from: range.from.toISOString(), to: range.to.toISOString() };
}
